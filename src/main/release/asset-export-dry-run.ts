import { execFileSync } from 'node:child_process';
import crypto, { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ExportBlocker,
  ExportDryRunInput,
  ExportDryRunResult,
  ExportFileCandidate,
  ExportPackageManifest,
} from './asset-export-types';
import {
  DEFAULT_EXPORT_DENYLIST,
  detectRedactionFindings,
  getExportDenylistBlocker,
  matchesExportRule,
} from './asset-export-rules';
import { isPathWithinRoot } from '../tools/path-containment';

function sha256Buffer(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return 'unknown';
  }
}

function getGitInfo(cwd: string): ExportPackageManifest['git'] {
  return {
    commit: runGit(cwd, ['rev-parse', 'HEAD']),
    branch: runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: runGit(cwd, ['status', '--short']) !== '',
  };
}

function toRelativePath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).replace(/\\/g, '/');
}

function shouldInclude(relativePath: string, includeRules: string[]): boolean {
  if (includeRules.length === 0 || includeRules.includes('**')) return true;
  return includeRules.some((rule) => matchesExportRule(relativePath, rule));
}

function shouldExclude(relativePath: string, excludeRules: string[]): boolean {
  return excludeRules.some((rule) => matchesExportRule(relativePath, rule));
}

function normalizeRulePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/g, '');
}

function couldContainIncludedPath(relativePath: string, includeRules: string[]): boolean {
  if (includeRules.length === 0 || includeRules.includes('**')) return true;
  if (shouldInclude(relativePath, includeRules)) return true;
  const directory = normalizeRulePath(relativePath);
  return includeRules.some((rule) => normalizeRulePath(rule).startsWith(`${directory}/`));
}

function isProbablyTextFile(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  return buffer.length < 2_000_000;
}

function collectCandidates(input: {
  root: string;
  includeRules: string[];
  excludeRules: string[];
}): {
  candidates: ExportFileCandidate[];
  blockers: ExportBlocker[];
  redactionFindings: ExportDryRunResult['redactionFindings'];
  warnings: string[];
} {
  const candidates: ExportFileCandidate[] = [];
  const blockers: ExportBlocker[] = [];
  const redactionFindings: ExportDryRunResult['redactionFindings'] = [];
  const warnings: string[] = [];
  const root = path.resolve(input.root);

  function visit(directory: string): void {
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relativePath = toRelativePath(root, absolute);
      if (entry.isDirectory() && !couldContainIncludedPath(relativePath, input.includeRules)) {
        continue;
      }
      if (!entry.isDirectory() && !shouldInclude(relativePath, input.includeRules)) {
        continue;
      }
      const denyBlocker = getExportDenylistBlocker(relativePath);
      if (denyBlocker) {
        blockers.push(denyBlocker);
        continue;
      }
      if (shouldExclude(relativePath, input.excludeRules)) {
        continue;
      }

      if (entry.isSymbolicLink()) {
        const realPath = fs.realpathSync(absolute);
        if (!isPathWithinRoot(realPath, root, process.platform === 'win32')) {
          blockers.push({
            code: 'symlink.escape',
            severity: 'blocker',
            path: relativePath,
            message: 'Symlink points outside the export root.',
          });
          continue;
        }
        warnings.push(`Skipped symlink during dry-run: ${relativePath}`);
        continue;
      }

      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const content = fs.readFileSync(absolute);
      const stat = fs.statSync(absolute);
      candidates.push({ path: relativePath, size: stat.size, sha256: sha256Buffer(content) });
      if (isProbablyTextFile(content)) {
        redactionFindings.push(...detectRedactionFindings(relativePath, content.toString('utf8')));
      }
    }
  }

  visit(root);
  return {
    candidates: candidates.sort((a, b) => a.path.localeCompare(b.path)),
    blockers: blockers.sort((a, b) => (a.path || '').localeCompare(b.path || '') || a.code.localeCompare(b.code)),
    redactionFindings: redactionFindings.sort((a, b) => a.path.localeCompare(b.path) || (a.line || 0) - (b.line || 0)),
    warnings,
  };
}

export function runAssetExportDryRun(input: ExportDryRunInput): ExportDryRunResult {
  const root = path.resolve(input.cwd);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error('A valid cwd is required for export dry-run.');
  }

  const includeRules = input.includeRules || ['**'];
  const excludeRules = input.excludeRules || [...DEFAULT_EXPORT_DENYLIST];
  const collected = collectCandidates({ root, includeRules, excludeRules });
  const redactionBlockers = collected.redactionFindings
    .filter((finding) => finding.severity === 'blocker')
    .map<ExportBlocker>((finding) => ({
      code: `redaction.${finding.type}`,
      severity: 'blocker',
      path: finding.path,
      message: finding.message,
    }));
  const blockers = [...collected.blockers, ...redactionBlockers].sort(
    (a, b) => (a.path || '').localeCompare(b.path || '') || a.code.localeCompare(b.code)
  );

  const manifest: ExportPackageManifest = {
    schemaVersion: 1,
    packageId: `export-dry-run:${randomUUID()}`,
    mode: input.mode || 'audit-source',
    createdAt: (input.now || new Date()).toISOString(),
    fishSwarmVersion: input.fishSwarmVersion,
    git: getGitInfo(root),
    includeRules,
    excludeRules,
    files: collected.candidates,
    artifactRefs: input.artifactRefs || [],
    warnings: collected.warnings,
    blockers,
  };

  return {
    dryRun: true,
    ok: blockers.length === 0,
    manifest,
    candidates: collected.candidates,
    redactionFindings: collected.redactionFindings,
    warnings: collected.warnings,
    blockers,
  };
}
