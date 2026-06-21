/**
 * GStack Browse MCP Server
 *
 * Thin MCP adapter around the gstack browse CLI. It intentionally exposes a
 * small allowlist of browser actions instead of arbitrary command execution.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeMCPLog } from './mcp-logger';
import { appendProjectTimelineEvent } from '../observability/project-timeline';
import { sanitizeModelTextOutput } from '../observability/output-sanitizer';

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_BUFFER = 20 * 1024 * 1024;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArg(args: JsonObject, key: string, required = true): string | undefined {
  const value = args[key];
  if (typeof value === 'string' && value.length > 0) return value;
  if (!required && (value === undefined || value === null || value === '')) return undefined;
  throw new Error(`Expected non-empty string argument: ${key}`);
}

function requiredStringArg(args: JsonObject, key: string): string {
  return stringArg(args, key, true) as string;
}

function booleanArg(args: JsonObject, key: string): boolean {
  return args[key] === true;
}

function stringArrayArg(args: JsonObject, key: string): string[] {
  const value = args[key];
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`Expected string array argument: ${key}`);
  }
  return value;
}

function projectRootFromCwd(cwd = process.cwd()): string {
  let current = cwd;
  for (;;) {
    if (fs.existsSync(path.join(current, 'package.json')) || fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return cwd;
    current = parent;
  }
}

function executableExists(candidate: string): boolean {
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function resolveBrowseBinary(): string | null {
  const envPath = process.env.GSTACK_BROWSE_BIN || process.env.BROWSE_BIN;
  if (envPath && executableExists(envPath)) return envPath;

  const exeName = process.platform === 'win32' ? 'browse.exe' : 'browse';
  const root = projectRootFromCwd();
  const platformArch = `${process.platform}-${process.arch}`;
  const resourcesRoots = [
    process.env.FISHSWARM_RESOURCES_PATH,
    process.env.OPEN_COWORK_RESOURCES_PATH,
    process.resourcesPath,
    path.join(root, 'resources'),
  ].filter((item): item is string => Boolean(item));
  const candidates = [
    ...resourcesRoots.flatMap((resourcesRoot) => [
      path.join(resourcesRoot, 'gstack-browse', platformArch, exeName),
      path.join(resourcesRoot, 'gstack-browse', exeName),
    ]),
    path.join(root, '.claude', 'skills', 'gstack', 'browse', 'dist', exeName),
    path.join(root, '.agents', 'skills', 'gstack', 'browse', 'dist', exeName),
    path.join(os.homedir(), '.claude', 'skills', 'gstack', 'browse', 'dist', exeName),
    path.join(os.homedir(), '.agents', 'skills', 'gstack', 'browse', 'dist', exeName),
  ];

  return candidates.find(executableExists) || null;
}

function browseUnavailableMessage(): string {
  return [
    'gstack browse binary not found.',
    'Set GSTACK_BROWSE_BIN to the compiled browse executable, or build gstack browse first.',
    'Preferred bundled path: resources/gstack-browse/<platform>-<arch>/browse(.exe).',
    'gstack requires Bun for building; run setup/build from the gstack repo after installing Bun.',
  ].join('\n');
}

function redactBrowseArgs(command: string, args: string[]): string[] {
  if (['fill', 'type'].includes(command)) {
    return args.map((arg, index) => (index === args.length - 1 ? '<REDACTED>' : arg));
  }
  return args.map((arg) =>
    /\b(token|password|secret|key|auth|bearer|cookie)\b/i.test(arg) ? '<REDACTED>' : arg
  );
}

async function runBrowse(command: string, args: string[]): Promise<string> {
  const browseBin = resolveBrowseBinary();
  if (!browseBin) {
    throw new Error(browseUnavailableMessage());
  }

  writeMCPLog(`Running gstack browse: ${command} ${args.join(' ')}`, 'GStack Browse');
  const cwd = process.env.WORKSPACE_DIR || process.cwd();
  const start = Date.now();
  appendProjectTimelineEvent({
    cwd,
    category: 'browse',
    event: 'gstack_browse.command_started',
    source: 'gstack-browse-mcp',
    status: 'started',
    command,
    toolName: `gstack_browse_${command}`,
    metadata: { args: redactBrowseArgs(command, args) },
  });

  let stdout = '';
  let stderr = '';
  try {
    const result = await execFileAsync(browseBin, [command, ...args], {
      cwd,
      timeout: Number(process.env.GSTACK_BROWSE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
      maxBuffer: MAX_BUFFER,
      env: {
        ...process.env,
        BROWSE_PARENT_PID: process.env.BROWSE_PARENT_PID || '0',
      },
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendProjectTimelineEvent({
      cwd,
      category: 'browse',
      event: 'gstack_browse.command_failed',
      source: 'gstack-browse-mcp',
      status: 'error',
      durationMs: Date.now() - start,
      command,
      toolName: `gstack_browse_${command}`,
      summary: message,
      metadata: { args: redactBrowseArgs(command, args) },
    });
    throw error;
  }

  const trimmedStdout = stdout.trim();
  const trimmedStderr = stderr.trim();
  const combined = [trimmedStdout, trimmedStderr ? `stderr:\n${trimmedStderr}` : '']
    .filter(Boolean)
    .join('\n\n');
  const sanitized = sanitizeModelTextOutput(combined, {
    label: `gstack browse ${command}`,
    maxChars: Number(process.env.GSTACK_BROWSE_MAX_OUTPUT_CHARS || 180_000),
  });
  appendProjectTimelineEvent({
    cwd,
    category: 'browse',
    event: 'gstack_browse.command_completed',
    source: 'gstack-browse-mcp',
    status: 'ok',
    durationMs: Date.now() - start,
    command,
    toolName: `gstack_browse_${command}`,
    summary: sanitized.warnings.length
      ? `Completed with sanitizer warnings: ${sanitized.warnings.join(', ')}`
      : `Completed ${command}`,
    metadata: {
      args: redactBrowseArgs(command, args),
      outputChars: sanitized.text.length,
      originalOutputChars: sanitized.originalLength,
      sanitizerWarnings: sanitized.warnings,
    },
  });
  return sanitized.text;
}

function buildCommand(toolName: string, rawArgs: unknown): { command: string; args: string[] } {
  const args = isObject(rawArgs) ? rawArgs : {};

  switch (toolName) {
    case 'gstack_browse_open':
      return { command: 'goto', args: [requiredStringArg(args, 'url')] };
    case 'gstack_browse_snapshot': {
      const flags = stringArrayArg(args, 'flags');
      if (booleanArg(args, 'interactive')) flags.push('-i');
      if (booleanArg(args, 'compact')) flags.push('-c');
      return { command: 'snapshot', args: flags };
    }
    case 'gstack_browse_text': {
      const selector = stringArg(args, 'selector', false);
      return { command: 'text', args: selector ? [selector] : [] };
    }
    case 'gstack_browse_click':
      return { command: 'click', args: [requiredStringArg(args, 'selector')] };
    case 'gstack_browse_fill':
      return {
        command: 'fill',
        args: [requiredStringArg(args, 'selector'), requiredStringArg(args, 'value')],
      };
    case 'gstack_browse_type':
      return { command: 'type', args: [requiredStringArg(args, 'text')] };
    case 'gstack_browse_press':
      return { command: 'press', args: [requiredStringArg(args, 'key')] };
    case 'gstack_browse_wait':
      return { command: 'wait', args: [requiredStringArg(args, 'target')] };
    case 'gstack_browse_screenshot': {
      const outPath = stringArg(args, 'path', false);
      const selector = stringArg(args, 'selector', false);
      const commandArgs: string[] = [];
      if (booleanArg(args, 'base64')) commandArgs.push('--base64');
      if (booleanArg(args, 'viewport')) commandArgs.push('--viewport');
      if (selector) commandArgs.push('--selector', selector);
      if (outPath) commandArgs.push(outPath);
      return { command: 'screenshot', args: commandArgs };
    }
    case 'gstack_browse_status':
      return { command: 'status', args: [] };
    case 'gstack_browse_stop':
      return { command: 'stop', args: [] };
    default:
      throw new Error(`Unknown gstack browse tool: ${toolName}`);
  }
}

const server = new Server(
  {
    name: 'fishswarm-gstack-browse',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'gstack_browse_open',
      description: 'Open a URL in the persistent gstack browser session.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL to open.' } },
        required: ['url'],
      },
    },
    {
      name: 'gstack_browse_snapshot',
      description: 'Return an accessibility snapshot with gstack @e refs for interaction.',
      inputSchema: {
        type: 'object',
        properties: {
          interactive: { type: 'boolean', description: 'Only include interactive elements.' },
          compact: { type: 'boolean', description: 'Use compact snapshot output.' },
          flags: { type: 'array', items: { type: 'string' }, description: 'Advanced snapshot flags.' },
        },
      },
    },
    {
      name: 'gstack_browse_text',
      description: 'Read visible page text, optionally scoped to a selector or @ref.',
      inputSchema: {
        type: 'object',
        properties: { selector: { type: 'string' } },
      },
    },
    {
      name: 'gstack_browse_click',
      description: 'Click a CSS selector or gstack @ref from a prior snapshot.',
      inputSchema: {
        type: 'object',
        properties: { selector: { type: 'string' } },
        required: ['selector'],
      },
    },
    {
      name: 'gstack_browse_fill',
      description: 'Fill an input selected by CSS selector or @ref.',
      inputSchema: {
        type: 'object',
        properties: { selector: { type: 'string' }, value: { type: 'string' } },
        required: ['selector', 'value'],
      },
    },
    {
      name: 'gstack_browse_type',
      description: 'Type text into the focused element.',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
    {
      name: 'gstack_browse_press',
      description: 'Press a keyboard key such as Enter, Escape, or Tab.',
      inputSchema: {
        type: 'object',
        properties: { key: { type: 'string' } },
        required: ['key'],
      },
    },
    {
      name: 'gstack_browse_wait',
      description: 'Wait for a selector, URL, timeout, or gstack wait target.',
      inputSchema: {
        type: 'object',
        properties: { target: { type: 'string' } },
        required: ['target'],
      },
    },
    {
      name: 'gstack_browse_screenshot',
      description: 'Capture a screenshot from the persistent gstack browser session.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Optional output file path.' },
          selector: { type: 'string', description: 'Optional selector or @ref to capture.' },
          viewport: { type: 'boolean', description: 'Capture viewport only.' },
          base64: { type: 'boolean', description: 'Return base64 output when supported by gstack.' },
        },
      },
    },
    {
      name: 'gstack_browse_status',
      description: 'Return gstack browse daemon status.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'gstack_browse_stop',
      description: 'Stop the gstack browse daemon.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { command, args } = buildCommand(request.params.name, request.params.arguments);
    const text = await runBrowse(command, args);
    return {
      content: [{ type: 'text', text: text || 'OK' }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeMCPLog(message, 'GStack Browse Error');
    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  writeMCPLog('GStack Browse MCP server started', 'GStack Browse');
}

main().catch((error) => {
  writeMCPLog(error instanceof Error ? error.stack || error.message : String(error), 'Fatal');
  process.exit(1);
});
