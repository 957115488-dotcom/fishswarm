import crypto from 'node:crypto';
import path from 'node:path';
import type {
  ArtifactSourceRef,
  PatchProposalArtifact,
  SecretScanFinding,
} from '../../shared/development-artifact-types';
import { buildArtifactLineage } from '../../shared/development-artifact-types';
import {
  saveWorkflowArtifact,
  type WorkflowArtifactEnvelope,
} from '../workflows/workflow-artifact-store';

export interface CreatePatchProposalInput {
  cwd?: string;
  title?: string;
  diff: string;
  baseCommit: string;
  baseDirtyHash?: string;
  allowedPaths?: string[];
  deniedPaths?: string[];
  parentArtifactIds?: string[];
  sourceRefs?: ArtifactSourceRef[];
  roleRefs?: string[];
  conceptRefs?: string[];
  sessionId?: string;
  createdBy?: string;
}

export interface PatchPathValidationResult {
  files: string[];
  blocked: Array<{ file: string; reason: string }>;
}

export interface SecretScanResult {
  status: 'pass' | 'warn' | 'blocked';
  findings: SecretScanFinding[];
}

interface SecretPattern {
  type: SecretScanFinding['type'];
  regex: RegExp;
  severity: SecretScanFinding['severity'];
}

const SECRET_PATTERNS: SecretPattern[] = [
  { type: 'private_key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, severity: 'blocker' },
  { type: 'api_key', regex: /\bsk-[A-Za-z0-9_-]{16,}\b/g, severity: 'blocker' },
  { type: 'api_key', regex: /\bAIza[0-9A-Za-z_-]{16,}\b/g, severity: 'blocker' },
  { type: 'token', regex: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g, severity: 'blocker' },
  { type: 'token', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g, severity: 'blocker' },
  { type: 'token', regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/g, severity: 'blocker' },
  {
    type: 'unknown',
    regex: /\b(api[_-]?key|token|secret|password|auth)\b\s*[:=]\s*['"]?[^\s'"`]{8,}/gi,
    severity: 'warning',
  },
];

export function sha256Text(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function normalizeDiffPath(value: string): string | null {
  const trimmed = value.trim().replace(/^"|"$/g, '');
  if (!trimmed || trimmed === '/dev/null' || trimmed.includes('\x00')) return null;
  const withoutPrefix = trimmed.replace(/^[ab]\//, '');
  const normalized = path.posix.normalize(withoutPrefix.replace(/\\/g, '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized === '..') {
    return null;
  }
  if (path.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)) return null;
  return normalized;
}

export function extractDiffFilePaths(diff: string): string[] {
  const files = new Set<string>();
  for (const line of diff.split(/\r?\n/)) {
    const gitMatch = line.match(/^diff --git\s+a\/(.+?)\s+b\/(.+)$/);
    if (gitMatch) {
      for (const rawPath of [gitMatch[1], gitMatch[2]]) {
        const normalized = normalizeDiffPath(rawPath);
        if (normalized) files.add(normalized);
      }
      continue;
    }

    const markerMatch = line.match(/^(?:---|\+\+\+)\s+(.+)$/);
    if (markerMatch) {
      const normalized = normalizeDiffPath(markerMatch[1]);
      if (normalized) files.add(normalized);
    }
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

function normalizePolicyPattern(pattern: string): string {
  return pattern.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/g, '');
}

function matchesPolicyPattern(file: string, pattern: string): boolean {
  const normalizedPattern = normalizePolicyPattern(pattern);
  if (!normalizedPattern) return false;
  if (normalizedPattern === '**' || normalizedPattern === '*') return true;
  if (normalizedPattern.endsWith('/**')) {
    const prefix = normalizedPattern.slice(0, -3);
    return file === prefix || file.startsWith(`${prefix}/`);
  }
  if (normalizedPattern.endsWith('/*')) {
    const prefix = normalizedPattern.slice(0, -2);
    if (!file.startsWith(`${prefix}/`)) return false;
    return !file.slice(prefix.length + 1).includes('/');
  }
  return file === normalizedPattern;
}

function isDenied(file: string, deniedPaths: string[]): boolean {
  return deniedPaths.some((pattern) => matchesPolicyPattern(file, pattern));
}

function isAllowed(file: string, allowedPaths: string[]): boolean {
  if (allowedPaths.length === 0) return true;
  return allowedPaths.some((pattern) => matchesPolicyPattern(file, pattern));
}

export function validatePatchProposalPaths(input: {
  files: string[];
  allowedPaths?: string[];
  deniedPaths?: string[];
}): PatchPathValidationResult {
  const allowedPaths = input.allowedPaths || [];
  const deniedPaths = input.deniedPaths || [];
  const blocked: PatchPathValidationResult['blocked'] = [];

  for (const file of input.files) {
    const normalized = normalizeDiffPath(file);
    if (!normalized) {
      blocked.push({ file, reason: 'Invalid or unsafe diff path.' });
      continue;
    }
    if (isDenied(normalized, deniedPaths)) {
      blocked.push({ file: normalized, reason: 'Path is denied by patch proposal policy.' });
      continue;
    }
    if (!isAllowed(normalized, allowedPaths)) {
      blocked.push({ file: normalized, reason: 'Path is outside allowed patch proposal policy.' });
    }
  }

  return { files: input.files, blocked };
}

function findingFingerprint(type: SecretScanFinding['type'], value: string): string {
  return `${type}:${sha256Text(value).slice(0, 16)}`;
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

export function scanDiffForSecrets(diff: string): SecretScanResult {
  const findings: SecretScanFinding[] = [];
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of diff.matchAll(pattern.regex)) {
      const value = match[0];
      findings.push({
        type: pattern.type,
        line: lineNumberAt(diff, match.index || 0),
        severity: pattern.severity,
        fingerprint: findingFingerprint(pattern.type, value),
      });
    }
  }

  const status = findings.some((finding) => finding.severity === 'blocker')
    ? 'blocked'
    : findings.length > 0
      ? 'warn'
      : 'pass';
  return { status, findings };
}

export function redactDiffSecrets(diff: string): string {
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of diff.matchAll(pattern.regex)) {
      const value = match[0];
      const start = match.index || 0;
      const fingerprint = findingFingerprint(pattern.type, value);
      replacements.push({
        start,
        end: start + value.length,
        replacement: `[REDACTED:${fingerprint}]`,
      });
    }
  }
  replacements.sort((left, right) => left.start - right.start || right.end - left.end);
  let cursor = 0;
  let output = '';
  for (const replacement of replacements) {
    if (replacement.start < cursor) continue;
    output += diff.slice(cursor, replacement.start);
    output += replacement.replacement;
    cursor = replacement.end;
  }
  output += diff.slice(cursor);
  return output;
}

export function createPatchProposalArtifact(
  input: CreatePatchProposalInput
): WorkflowArtifactEnvelope<PatchProposalArtifact> {
  const diff = input.diff || '';
  if (!diff.trim()) {
    throw new Error('Patch proposal diff is required.');
  }
  if (!input.baseCommit.trim()) {
    throw new Error('Patch proposal baseCommit is required.');
  }

  const files = extractDiffFilePaths(diff);
  if (files.length === 0) {
    throw new Error('Patch proposal diff does not reference any files.');
  }

  const allowedPaths = input.allowedPaths || [];
  const deniedPaths = input.deniedPaths || [];
  const pathValidation = validatePatchProposalPaths({ files, allowedPaths, deniedPaths });
  if (pathValidation.blocked.length > 0) {
    throw new Error(
      `Patch proposal path validation failed: ${pathValidation.blocked
        .map((blocked) => `${blocked.file}: ${blocked.reason}`)
        .join('; ')}`
    );
  }

  const diffSha256 = sha256Text(diff);
  const secretScan = scanDiffForSecrets(diff);
  const persistedDiff = secretScan.status === 'blocked' ? redactDiffSecrets(diff) : diff;
  const artifact: PatchProposalArtifact = {
    kind: 'patch_proposal',
    title: input.title || 'Patch proposal',
    lineage: buildArtifactLineage({
      parentArtifactIds: input.parentArtifactIds || [],
      sourceRefs: input.sourceRefs || [],
      roleRefs: input.roleRefs || [],
      conceptRefs: input.conceptRefs || [],
      sessionId: input.sessionId,
      createdBy: input.createdBy || 'agent',
      createdAt: new Date().toISOString(),
      contentSha256: diffSha256,
      allowedPaths,
      deniedPaths,
      reviewState: secretScan.status === 'blocked' ? 'draft' : 'ready_for_review',
    }),
    baseCommit: input.baseCommit,
    baseDirtyHash: input.baseDirtyHash,
    diff: persistedDiff,
    diffSha256,
    files,
    allowedPaths,
    deniedPaths,
    secretScan,
    riskSummary:
      secretScan.status === 'blocked'
        ? 'Blocked by secret scan. Review and remove sensitive values before approval.'
        : 'Ready for human review. Applying this proposal still requires an approval gate.',
  };

  return saveWorkflowArtifact<PatchProposalArtifact>({
    cwd: input.cwd,
    kind: 'patch_proposal',
    title: artifact.title,
    status: secretScan.status === 'blocked' ? 'blocked' : 'ready',
    artifact,
  });
}
