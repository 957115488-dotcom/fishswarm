import { describe, expect, it } from 'vitest';
import type { AssetCenterItem, AssetExportDryRunResponse } from '../../shared/ipc-types';
import {
  buildAssetExportSummaryViewModel,
  canCreateAssetExportPackage,
  canRunAssetExportDryRun,
  formatExportBytes,
  getAssetExportMode,
} from '../../renderer/utils/asset-export-view-model';

function exportAsset(overrides: Partial<AssetCenterItem> = {}): AssetCenterItem {
  return {
    id: 'export.package:audit-source',
    kind: 'export.package',
    source: 'built-in',
    scope: 'workspace',
    status: 'available',
    title: 'Audit Source Export Package',
    summary: 'Create an auditable export package.',
    tags: ['export'],
    sourceRef: { type: 'generated', id: 'audit-source' },
    schemaVersion: 1,
    actions: ['viewDetails', 'dryRunExport', 'createPackage'],
    warnings: [],
    ...overrides,
  };
}

function dryRun(
  overrides: Partial<AssetExportDryRunResponse['result']> = {}
): AssetExportDryRunResponse {
  const result: AssetExportDryRunResponse['result'] = {
    dryRun: true,
    ok: true,
    manifest: {
      schemaVersion: 1,
      packageId: 'export-dry-run:1',
      mode: 'audit-source',
      createdAt: '2026-06-25T00:00:00.000Z',
      git: { commit: 'abc', branch: 'main', dirty: false },
      includeRules: ['**'],
      excludeRules: ['.env'],
      files: [{ path: 'src/index.ts', size: 1536, sha256: 'a'.repeat(64) }],
      artifactRefs: ['export.package:audit-source'],
      warnings: [],
      blockers: [],
    },
    candidates: [{ path: 'src/index.ts', size: 1536, sha256: 'a'.repeat(64) }],
    redactionFindings: [],
    warnings: [],
    blockers: [],
    ...overrides,
  };
  return { result, dryRunSha256: 'b'.repeat(64) };
}

describe('asset export view model', () => {
  it('gates export actions to export.package assets only', () => {
    expect(canRunAssetExportDryRun(exportAsset())).toBe(true);
    expect(canCreateAssetExportPackage(exportAsset())).toBe(true);
    expect(canRunAssetExportDryRun(exportAsset({ kind: 'role' }))).toBe(false);
    expect(canCreateAssetExportPackage(exportAsset({ actions: ['viewDetails'] }))).toBe(false);
    expect(canCreateAssetExportPackage(exportAsset({ status: 'unavailable' }))).toBe(false);
  });

  it('infers package mode from the asset source reference', () => {
    expect(getAssetExportMode(exportAsset())).toBe('audit-source');
    expect(
      getAssetExportMode(exportAsset({ sourceRef: { type: 'generated', id: 'deployable-source' } }))
    ).toBe('deployable-source');
  });

  it('summarizes passing and blocked dry-run results', () => {
    expect(buildAssetExportSummaryViewModel(dryRun())).toMatchObject({
      fileCount: 1,
      totalSizeLabel: '1.5 KB',
      blockerCount: 0,
      canCreatePackage: true,
      statusLabel: 'Ready',
    });

    const blocked = buildAssetExportSummaryViewModel(
      dryRun({
        ok: false,
        blockers: [
          {
            code: 'denylist.path',
            severity: 'blocker',
            path: '.env',
            message: 'Path is excluded.',
          },
        ],
      })
    );

    expect(blocked.canCreatePackage).toBe(false);
    expect(blocked.statusLabel).toBe('Blocked');
    expect(blocked.blockerCount).toBe(1);
  });

  it('formats byte counts for compact UI labels', () => {
    expect(formatExportBytes(0)).toBe('0 B');
    expect(formatExportBytes(512)).toBe('512 B');
    expect(formatExportBytes(1536)).toBe('1.5 KB');
  });
});
