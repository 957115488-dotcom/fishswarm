/**
 * Shared runner for FishSwarm's GStack Browse integration.
 *
 * The MCP adapter and Browser Skill Runtime both need the same small contract:
 * resolve the browse binary, run an allowlisted browse command, redact command
 * arguments before logging, sanitize model-visible output, and write timeline
 * events. Keeping that contract here prevents Browser Skill Runtime from
 * depending on the MCP stdio server module.
 */
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

export interface GStackBrowseRunOptions {
  cwd?: string;
  timeoutMs?: number;
  maxOutputChars?: number;
  source?: string;
  toolName?: string;
  env?: NodeJS.ProcessEnv;
  eventPrefix?: string;
}

function projectRootFromCwd(cwd = process.cwd()): string {
  let current = path.resolve(cwd);
  for (;;) {
    if (fs.existsSync(path.join(current, 'package.json')) || fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(cwd);
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

export function resolveGStackBrowseBinary(cwd = process.cwd()): string | null {
  const envPath = process.env.GSTACK_BROWSE_BIN || process.env.BROWSE_BIN;
  if (envPath && executableExists(envPath)) return envPath;

  const exeName = process.platform === 'win32' ? 'browse.exe' : 'browse';
  const root = projectRootFromCwd(cwd);
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

export function gstackBrowseUnavailableMessage(): string {
  return [
    'gstack browse binary not found.',
    'Set GSTACK_BROWSE_BIN to the compiled browse executable, or build gstack browse first.',
    'Preferred bundled path: resources/gstack-browse/<platform>-<arch>/browse(.exe).',
    'gstack requires Bun for building; run setup/build from the gstack repo after installing Bun.',
  ].join('\n');
}

export function redactGStackBrowseArgs(command: string, args: string[]): string[] {
  if (['fill', 'type'].includes(command)) {
    return args.map((arg, index) => (index === args.length - 1 ? '<REDACTED>' : arg));
  }
  return args.map((arg) =>
    /\b(token|password|secret|key|auth|bearer|cookie)\b/i.test(arg) ? '<REDACTED>' : arg
  );
}

export async function runGStackBrowseCommand(
  command: string,
  args: string[],
  options: GStackBrowseRunOptions = {}
): Promise<string> {
  const cwd = options.cwd || process.env.WORKSPACE_DIR || process.cwd();
  const browseBin = resolveGStackBrowseBinary(cwd);
  if (!browseBin) {
    throw new Error(gstackBrowseUnavailableMessage());
  }

  const source = options.source || 'gstack-browse-runner';
  const toolName = options.toolName || `gstack_browse_${command}`;
  const eventPrefix = options.eventPrefix || 'gstack_browse';
  const safeArgs = redactGStackBrowseArgs(command, args);
  const start = Date.now();

  writeMCPLog(`Running gstack browse: ${command} ${safeArgs.join(' ')}`, 'GStack Browse');
  appendProjectTimelineEvent({
    cwd,
    category: 'browse',
    event: `${eventPrefix}.command_started`,
    source,
    status: 'started',
    command,
    toolName,
    metadata: { args: safeArgs },
  });

  let stdout = '';
  let stderr = '';
  try {
    const baseEnv = options.env || process.env;
    const result = await execFileAsync(browseBin, [command, ...args], {
      cwd,
      timeout: options.timeoutMs || Number(process.env.GSTACK_BROWSE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
      maxBuffer: MAX_BUFFER,
      env: {
        ...baseEnv,
        BROWSE_PARENT_PID: baseEnv.BROWSE_PARENT_PID || process.env.BROWSE_PARENT_PID || '0',
      },
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendProjectTimelineEvent({
      cwd,
      category: 'browse',
      event: `${eventPrefix}.command_failed`,
      source,
      status: 'error',
      durationMs: Date.now() - start,
      command,
      toolName,
      summary: message,
      metadata: { args: safeArgs },
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
    maxChars: options.maxOutputChars || Number(process.env.GSTACK_BROWSE_MAX_OUTPUT_CHARS || 180_000),
  });

  appendProjectTimelineEvent({
    cwd,
    category: 'browse',
    event: `${eventPrefix}.command_completed`,
    source,
    status: 'ok',
    durationMs: Date.now() - start,
    command,
    toolName,
    summary: sanitized.warnings.length
      ? `Completed with sanitizer warnings: ${sanitized.warnings.join(', ')}`
      : `Completed ${command}`,
    metadata: {
      args: safeArgs,
      outputChars: sanitized.text.length,
      originalOutputChars: sanitized.originalLength,
      sanitizerWarnings: sanitized.warnings,
    },
  });

  return sanitized.text;
}
