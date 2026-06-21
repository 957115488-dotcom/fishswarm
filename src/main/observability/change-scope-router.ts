import { execFileSync } from 'child_process';

export type ChangeScope =
  | 'frontend'
  | 'backend'
  | 'prompts'
  | 'tests'
  | 'docs'
  | 'config'
  | 'migrations'
  | 'api'
  | 'auth'
  | 'security'
  | 'mcp'
  | 'remote'
  | 'packaging';

export interface ChangeScopeReport {
  cwd: string;
  files: string[];
  scopes: Record<ChangeScope, boolean>;
  recommendedSkills: string[];
  recommendedCommands: string[];
}

const ALL_SCOPES: ChangeScope[] = [
  'frontend',
  'backend',
  'prompts',
  'tests',
  'docs',
  'config',
  'migrations',
  'api',
  'auth',
  'security',
  'mcp',
  'remote',
  'packaging',
];

export function analyzeChangeScope(cwd: string, files = getChangedFiles(cwd)): ChangeScopeReport {
  const scopes = Object.fromEntries(ALL_SCOPES.map((scope) => [scope, false])) as Record<
    ChangeScope,
    boolean
  >;

  for (const file of files) {
    classifyFile(file, scopes);
  }

  const recommendedSkills = new Set<string>();
  const recommendedCommands = new Set<string>();

  if (scopes.security || scopes.auth || scopes.remote || scopes.mcp) {
    recommendedSkills.add('gstack-cso');
  }
  if (scopes.frontend) {
    recommendedSkills.add('gstack-qa');
  }
  if (scopes.backend || scopes.api || scopes.mcp || scopes.remote) {
    recommendedSkills.add('gstack-review');
  }
  if (scopes.packaging || scopes.config) {
    recommendedCommands.add('npm run pre-build-check');
  }
  if (scopes.tests || scopes.backend || scopes.frontend || scopes.mcp || scopes.security) {
    recommendedCommands.add('npm test');
  }
  if (scopes.backend || scopes.frontend || scopes.config || scopes.mcp || scopes.remote) {
    recommendedCommands.add('npm run typecheck');
  }
  if (files.length > 0) {
    recommendedSkills.add('gstack-ship');
  }

  return {
    cwd,
    files,
    scopes,
    recommendedSkills: [...recommendedSkills],
    recommendedCommands: [...recommendedCommands],
  };
}

export function getChangedFiles(cwd: string): string[] {
  const files = new Set<string>();
  for (const args of [
    ['diff', '--name-only', 'HEAD'],
    ['diff', '--name-only', '--cached'],
  ]) {
    try {
      const stdout = execFileSync('git', args, { cwd, encoding: 'utf-8', timeout: 5000 });
      stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((file) => files.add(file));
    } catch {
      // Ignore git failures; the caller still gets an empty report.
    }
  }

  try {
    const stdout = execFileSync('git', ['status', '--porcelain'], {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
    });
    stdout
      .split(/\r?\n/)
      .map((line) => line.slice(3).trim())
      .filter(Boolean)
      .forEach((file) => files.add(file.replace(/^"|"$/g, '')));
  } catch {
    // Ignore.
  }

  return [...files].sort();
}

function classifyFile(file: string, scopes: Record<ChangeScope, boolean>): void {
  const lower = file.toLowerCase();
  const ext = lower.split('.').pop() || '';

  if (/\.(tsx|jsx|vue|svelte|astro|css|scss|sass|less|html)$/.test(lower)) scopes.frontend = true;
  if (/\.(ts|js|mts|cts|mjs|cjs|py|go|rs|java|rb|php)$/.test(lower)) scopes.backend = true;
  if (/\.(test|spec)\.|(^|\/)(__tests__|tests|test|e2e|cypress)\//.test(lower)) scopes.tests = true;
  if (/\.(md|mdx|rst)$/.test(lower) || lower.startsWith('docs/')) scopes.docs = true;
  if (/(package(-lock)?\.json|pnpm-lock|bun\.lock|vite\.config|tsconfig|electron-builder|\.ya?ml$|\.json$|\.env)/.test(lower)) scopes.config = true;
  if (/(migration|migrations|prisma\/migrations|db\/migrate)/.test(lower)) scopes.migrations = true;
  if (/(route|router|controller|endpoint|openapi|swagger|graphql|\/api\/)/.test(lower)) scopes.api = true;
  if (/(auth|oauth|jwt|session|permission|role|policy)/.test(lower)) scopes.auth = true;
  if (/(security|redact|prompt-injection|token-scope|guard|sandbox)/.test(lower)) scopes.security = true;
  if (/(^|\/)(mcp|modelcontextprotocol)(\/|\.|-)/.test(lower)) scopes.mcp = true;
  if (/(^|\/)remote(\/|\.|-)|tunnel|websocket|feishu|gateway/.test(lower)) scopes.remote = true;
  if (/(electron-builder|dist-mcp|resources\/|scripts\/pre-build|scripts\/build|download-node|prepare-)/.test(lower)) scopes.packaging = true;

  if (ext === 'md' && /(skill|prompt|claude|agent)/.test(lower)) scopes.prompts = true;
  if (/(prompt|system-message|skill\.md|\.claude\/skills)/.test(lower)) scopes.prompts = true;
}
