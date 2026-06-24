import { describe, expect, it } from 'vitest';
import type { ExportDryRunResult, ExportPackageManifest } from '../../main/release/asset-export-types';

describe('asset export types', () => {
  it('models dry-run results without package bytes', () => {
    const manifest: ExportPackageManifest = {
      schemaVersion: 1,
      packageId: 'export-dry-run:1',
      mode: 'audit-source',
      createdAt: '2026-06-25T00:00:00.000Z',
      git: { commit: 'abc', branch: 'main', dirty: false },
      includeRules: ['**'],
      excludeRules: ['.env'],
      files: [{ path: 'src/index.ts', size: 10, sha256: 'a'.repeat(64) }],
      artifactRefs: [],
      warnings: [],
      blockers: [],
    };
    const result: ExportDryRunResult = {
      dryRun: true,
      ok: true,
      manifest,
      candidates: manifest.files,
      redactionFindings: [],
      warnings: [],
      blockers: [],
    };

    expect(result.dryRun).toBe(true);
    expect(result.manifest.files[0].sha256).toHaveLength(64);
  });
});
