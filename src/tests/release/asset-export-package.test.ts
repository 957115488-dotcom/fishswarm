import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runAssetExportDryRun } from '../../main/release/asset-export-dry-run';
import {
  computeExportDryRunSnapshotSha256,
  createAssetExportPackage,
} from '../../main/release/asset-export-package';
import type { ExportDryRunResult } from '../../main/release/asset-export-types';

const tempRoots: string[] = [];

function git(cwd: string, args: string[]) {
  execFileSync('git', ['-C', cwd, ...args], { stdio: 'ignore' });
}

function sha256Buffer(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-export-package-'));
  tempRoots.push(root);
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  git(root, ['init', 'workspace']);
  git(cwd, ['config', 'user.email', 'test@example.com']);
  git(cwd, ['config', 'user.name', 'Test User']);
  fs.writeFileSync(path.join(cwd, 'src', 'index.ts'), 'export const ok = true;\n');
  fs.writeFileSync(path.join(cwd, 'docs', 'guide.md'), '# Guide\n');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', 'initial']);
  return cwd;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('asset export package creation', () => {
  it('creates an auditable zip from an approved dry-run snapshot', async () => {
    const cwd = makeWorkspace();
    const stagingDir = path.join(path.dirname(cwd), 'packages');
    const dryRun = runAssetExportDryRun({
      cwd,
      includeRules: ['src/**', 'docs/**'],
      excludeRules: ['docs/private/**'],
      artifactRefs: ['logic-flow:1'],
      now: new Date('2026-06-25T00:00:00.000Z'),
    });
    const expectedDryRunSha256 = computeExportDryRunSnapshotSha256(dryRun);

    const result = await createAssetExportPackage({
      cwd,
      dryRun,
      expectedDryRunSha256,
      stagingDir,
      packageFileName: 'bundle.zip',
      now: new Date('2026-06-25T00:00:00.000Z'),
    });

    const packageBytes = fs.readFileSync(result.packagePath);
    expect(result.ok).toBe(true);
    expect(result.packagePath).toBe(path.join(stagingDir, 'bundle.zip'));
    expect(fs.existsSync(result.packagePath)).toBe(true);
    expect(fs.existsSync(result.checksumPath)).toBe(true);
    expect(packageBytes.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(result.sha256).toBe(sha256Buffer(packageBytes));
    expect(fs.readFileSync(result.checksumPath, 'utf8')).toContain(result.sha256);
    expect(result.dryRunSha256).toBe(expectedDryRunSha256);
    expect(result.manifest.blockers).toEqual([]);
    expect(result.manifest.files.map((file) => file.path)).toEqual([
      'docs/guide.md',
      'src/index.ts',
    ]);
    expect(result.manifest.artifactRefs).toEqual(['logic-flow:1']);
    expect(result.redactionReport).toMatchObject({
      schemaVersion: 1,
      packageId: result.packageId,
      dryRunSha256: expectedDryRunSha256,
      findings: [],
      blockers: [],
    });
  });

  it('refuses dry-run snapshots that still contain blockers', async () => {
    const cwd = makeWorkspace();
    fs.writeFileSync(path.join(cwd, '.env'), 'OPENAI_API_KEY=sk-1234567890abcdefghijklmnop\n');
    const dryRun = runAssetExportDryRun({ cwd });
    const expectedDryRunSha256 = computeExportDryRunSnapshotSha256(dryRun);

    await expect(
      createAssetExportPackage({
        cwd,
        dryRun,
        expectedDryRunSha256,
        stagingDir: path.join(path.dirname(cwd), 'packages'),
      })
    ).rejects.toThrow(/blockers exist/);
  });

  it('detects workspace drift between dry-run and package creation', async () => {
    const cwd = makeWorkspace();
    const dryRun = runAssetExportDryRun({
      cwd,
      includeRules: ['src/**', 'docs/**'],
      now: new Date('2026-06-25T00:00:00.000Z'),
    });
    const expectedDryRunSha256 = computeExportDryRunSnapshotSha256(dryRun);
    fs.writeFileSync(path.join(cwd, 'src', 'index.ts'), 'export const ok = false;\n');

    await expect(
      createAssetExportPackage({
        cwd,
        dryRun,
        expectedDryRunSha256,
        stagingDir: path.join(path.dirname(cwd), 'packages'),
        now: new Date('2026-06-25T00:00:00.000Z'),
      })
    ).rejects.toThrow(/snapshot changed/);
  });

  it('rejects unsafe paths embedded in a supplied dry-run snapshot', async () => {
    const cwd = makeWorkspace();
    const dryRun = runAssetExportDryRun({
      cwd,
      includeRules: ['src/**', 'docs/**'],
      now: new Date('2026-06-25T00:00:00.000Z'),
    });
    const unsafeFile = { ...dryRun.candidates[0], path: '../escape.txt' };
    const unsafeDryRun: ExportDryRunResult = {
      ...dryRun,
      candidates: [unsafeFile],
      manifest: {
        ...dryRun.manifest,
        files: [unsafeFile],
      },
    };
    const expectedDryRunSha256 = computeExportDryRunSnapshotSha256(unsafeDryRun);

    await expect(
      createAssetExportPackage({
        cwd,
        dryRun: unsafeDryRun,
        expectedDryRunSha256,
        stagingDir: path.join(path.dirname(cwd), 'packages'),
        now: new Date('2026-06-25T00:00:00.000Z'),
      })
    ).rejects.toThrow(/Unsafe zip entry path/);
  });

  it('requires an expected snapshot hash when using a supplied dry-run', async () => {
    const cwd = makeWorkspace();
    const dryRun = runAssetExportDryRun({ cwd });

    await expect(
      createAssetExportPackage({
        cwd,
        dryRun,
        stagingDir: path.join(path.dirname(cwd), 'packages'),
      })
    ).rejects.toThrow(/expectedDryRunSha256/);
  });
});
