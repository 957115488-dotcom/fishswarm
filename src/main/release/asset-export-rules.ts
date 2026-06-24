import type { ExportBlocker, RedactionFinding } from './asset-export-types';

export const DEFAULT_EXPORT_DENYLIST = [
  '.env',
  '.env.*',
  '.git/**',
  'node_modules/**',
  'dist/**',
  'dist-electron/**',
  'dist-mcp/**',
  'dist-wsl-agent/**',
  'dist-lima-agent/**',
  'release/**',
  '**/*.pem',
  '**/*.key',
  '**/*cookie*',
  '**/*token*',
  '**/*credential*',
  '**/*.sqlite',
  '**/*.sqlite3',
  '**/*.db',
] as const;

interface RedactionPattern {
  type: RedactionFinding['type'];
  regex: RegExp;
  severity: RedactionFinding['severity'];
  message: string;
}

const REDACTION_PATTERNS: RedactionPattern[] = [
  { type: 'private_key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, severity: 'blocker', message: 'Private key material detected.' },
  { type: 'api_key', regex: /\bsk-[A-Za-z0-9_-]{16,}\b/g, severity: 'blocker', message: 'OpenAI-style API key detected.' },
  { type: 'api_key', regex: /\bAIza[0-9A-Za-z_-]{16,}\b/g, severity: 'blocker', message: 'Google API key detected.' },
  { type: 'token', regex: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g, severity: 'blocker', message: 'GitHub token detected.' },
  { type: 'token', regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/g, severity: 'blocker', message: 'Bearer token detected.' },
  { type: 'credential', regex: /\b(api[_-]?key|token|secret|password|auth)\b\s*[:=]\s*['"]?[^\s'"`]{8,}/gi, severity: 'warning', message: 'Credential-like assignment detected.' },
];

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/g, '');
}

function matchPattern(relativePath: string, pattern: string): boolean {
  const file = normalizePath(relativePath);
  const normalizedPattern = normalizePath(pattern);
  if (!normalizedPattern) return false;
  if (normalizedPattern === '**' || normalizedPattern === '*') return true;
  if (normalizedPattern.startsWith('**/*.')) {
    return file.endsWith(normalizedPattern.slice(4));
  }
  if (normalizedPattern.startsWith('**/*') && normalizedPattern.endsWith('*')) {
    const token = normalizedPattern.slice(4, -1).toLowerCase();
    return file.toLowerCase().includes(token);
  }
  if (normalizedPattern.endsWith('/**')) {
    const prefix = normalizedPattern.slice(0, -3);
    return file === prefix || file.startsWith(`${prefix}/`);
  }
  if (normalizedPattern.endsWith('.*')) {
    const prefix = normalizedPattern.slice(0, -2);
    return file === prefix || file.startsWith(`${prefix}.`);
  }
  return file === normalizedPattern;
}

export function getExportDenylistBlocker(relativePath: string): ExportBlocker | null {
  const matched = DEFAULT_EXPORT_DENYLIST.find((pattern) => matchPattern(relativePath, pattern));
  if (!matched) return null;
  return {
    code: 'denylist.path',
    severity: 'blocker',
    path: relativePath,
    message: `Path is excluded by export denylist rule: ${matched}`,
  };
}

export function isExportPathDenied(relativePath: string): boolean {
  return getExportDenylistBlocker(relativePath) !== null;
}

export function matchesExportRule(relativePath: string, rule: string): boolean {
  return matchPattern(relativePath, rule);
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

export function detectRedactionFindings(relativePath: string, content: string): RedactionFinding[] {
  const findings: RedactionFinding[] = [];
  for (const pattern of REDACTION_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of content.matchAll(pattern.regex)) {
      findings.push({
        type: pattern.type,
        path: relativePath,
        line: lineNumberAt(content, match.index || 0),
        severity: pattern.severity,
        message: pattern.message,
      });
    }
  }
  return findings;
}
