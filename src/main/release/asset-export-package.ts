import archiver from 'archiver';
import crypto, { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  CreateExportPackageInput,
  CreateExportPackageResult,
  ExportDryRunInput,
  ExportDryRunResult,
  ExportFileCandidate,
  ExportPackageManifest,
  ExportRedactionReport,
} from './asset-export-types';
import { runAssetExportDryRun } from './asset-export-dry-run';
import { isPathWithinRoot } from '../tools/path-containment';

function sha256Buffer(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function sha256File(filePath: string): string {
  return sha256Buffer(fs.readFileSync(filePath));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function dryRunSnapshotPayload(result: ExportDryRunResult): unknown {
  return {
    ok: result.ok,
    mode: result.manifest.mode,
    fishSwarmVersion: result.manifest.fishSwarmVersion,
    git: result.manifest.git,
    includeRules: result.manifest.includeRules,
    excludeRules: result.manifest.excludeRules,
    artifactRefs: result.manifest.artifactRefs,
    candidates: result.candidates,
    redactionFindings: result.redactionFindings,
    warnings: result.warnings,
    blockers: result.blockers,
  };
}

export function computeExportDryRunSnapshotSha256(result: ExportDryRunResult): string {
  return crypto
    .createHash('sha256')
    .update(stableStringify(dryRunSnapshotPayload(result)))
    .digest('hex');
}

function packageInputFromDryRun(input: CreateExportPackageInput): ExportDryRunInput {
  const manifest = input.dryRun?.manifest;
  return {
    cwd: input.cwd,
    mode: manifest?.mode || input.mode,
    includeRules: manifest?.includeRules || input.includeRules,
    excludeRules: manifest?.excludeRules || input.excludeRules,
    artifactRefs: manifest?.artifactRefs || input.artifactRefs,
    fishSwarmVersion: manifest?.fishSwarmVersion || input.fishSwarmVersion,
    now: input.now,
  };
}

function assertNoBlockers(result: ExportDryRunResult): void {
  if (result.blockers.length === 0) return;
  throw new Error(
    `Export package cannot be created while blockers exist: ${result.blockers
      .map((blocker) => `${blocker.code}${blocker.path ? ` ${blocker.path}` : ''}`)
      .join('; ')}`
  );
}

function isUnsafeRelativePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  if (!normalized || normalized.includes('\0')) return true;
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) return true;
  return normalized.split('/').includes('..');
}

function zipEntryName(relativePath: string): string {
  if (isUnsafeRelativePath(relativePath)) {
    throw new Error(`Unsafe zip entry path: ${relativePath}`);
  }
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/').replace(/^\.\//, ''));
  if (!normalized || normalized === '.' || normalized.startsWith('../')) {
    throw new Error(`Unsafe zip entry path: ${relativePath}`);
  }
  return `files/${normalized}`;
}

function assertSafePackageCandidates(candidates: ExportFileCandidate[]): void {
  for (const candidate of candidates) {
    zipEntryName(candidate.path);
  }
}

function resolveCandidate(root: string, candidate: ExportFileCandidate): string {
  const absolute = path.resolve(root, candidate.path);
  if (!isPathWithinRoot(absolute, root, process.platform === 'win32')) {
    throw new Error(`Export candidate escapes workspace: ${candidate.path}`);
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`Export candidate no longer exists: ${candidate.path}`);
  }
  const actualSha256 = sha256File(absolute);
  if (actualSha256 !== candidate.sha256) {
    throw new Error(`Export candidate changed after dry-run: ${candidate.path}`);
  }
  return absolute;
}

function safePackageFilename(packageId: string, requested?: string): string {
  const name = requested?.trim() || `${packageId.replace(/[^a-zA-Z0-9._-]+/g, '-')}.zip`;
  const base = path.basename(name);
  if (!base.endsWith('.zip')) {
    return `${base}.zip`;
  }
  return base;
}

function writeJsonFile(archive: archiver.Archiver, name: string, value: unknown): void {
  archive.append(`${JSON.stringify(value, null, 2)}\n`, { name });
}

function finalizeArchive(archive: archiver.Archiver, output: fs.WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);
    archive.finalize().catch(reject);
  });
}

async function writePackageZip(input: {
  root: string;
  packagePath: string;
  manifest: ExportPackageManifest;
  redactionReport: ExportRedactionReport;
  candidates: ExportFileCandidate[];
}): Promise<void> {
  const output = fs.createWriteStream(input.packagePath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);

  writeJsonFile(archive, 'fishswarm-export-manifest.json', input.manifest);
  writeJsonFile(archive, 'fishswarm-redaction-report.json', input.redactionReport);

  for (const candidate of input.candidates) {
    const absolute = resolveCandidate(input.root, candidate);
    archive.file(absolute, { name: zipEntryName(candidate.path) });
  }

  await finalizeArchive(archive, output);
}

function buildFinalManifest(input: {
  dryRun: ExportDryRunResult;
  packageId: string;
  createdAt: string;
}): ExportPackageManifest {
  return {
    ...input.dryRun.manifest,
    packageId: input.packageId,
    createdAt: input.createdAt,
    files: [...input.dryRun.candidates],
    warnings: [...input.dryRun.warnings],
    blockers: [],
  };
}

export async function createAssetExportPackage(
  input: CreateExportPackageInput
): Promise<CreateExportPackageResult> {
  if (input.dryRun && !input.expectedDryRunSha256) {
    throw new Error(
      'expectedDryRunSha256 is required when creating a package from a dry-run snapshot.'
    );
  }
  if (input.dryRun) {
    assertSafePackageCandidates(input.dryRun.candidates);
    const suppliedHash = computeExportDryRunSnapshotSha256(input.dryRun);
    if (suppliedHash !== input.expectedDryRunSha256) {
      throw new Error('Supplied dry-run snapshot hash does not match expectedDryRunSha256.');
    }
    assertNoBlockers(input.dryRun);
  }

  const root = path.resolve(input.cwd);
  const currentDryRun = runAssetExportDryRun(packageInputFromDryRun(input));
  assertSafePackageCandidates(currentDryRun.candidates);
  assertNoBlockers(currentDryRun);

  const currentHash = computeExportDryRunSnapshotSha256(currentDryRun);
  if (input.expectedDryRunSha256 && currentHash !== input.expectedDryRunSha256) {
    throw new Error('Export dry-run snapshot changed; re-run dry-run before creating a package.');
  }

  const packageId = `export-package:${randomUUID()}`;
  const createdAt = (input.now || new Date()).toISOString();
  const manifest = buildFinalManifest({ dryRun: currentDryRun, packageId, createdAt });
  const redactionReport: ExportRedactionReport = {
    schemaVersion: 1,
    packageId,
    createdAt,
    dryRunSha256: currentHash,
    findings: currentDryRun.redactionFindings,
    warnings: currentDryRun.warnings,
    blockers: [],
  };
  const stagingDir = path.resolve(
    input.stagingDir || path.join(os.tmpdir(), 'fishswarm-export-packages')
  );
  fs.mkdirSync(stagingDir, { recursive: true });
  const packagePath = path.join(stagingDir, safePackageFilename(packageId, input.packageFileName));

  await writePackageZip({
    root,
    packagePath,
    manifest,
    redactionReport,
    candidates: currentDryRun.candidates,
  });

  const packageBytes = fs.readFileSync(packagePath);
  const sha256 = sha256Buffer(packageBytes);
  const checksumPath = `${packagePath}.sha256`;
  fs.writeFileSync(checksumPath, `${sha256}  ${path.basename(packagePath)}\n`, 'utf8');

  return {
    ok: true,
    packageId,
    packagePath,
    checksumPath,
    size: packageBytes.length,
    sha256,
    dryRunSha256: currentHash,
    manifest,
    redactionReport,
  };
}
