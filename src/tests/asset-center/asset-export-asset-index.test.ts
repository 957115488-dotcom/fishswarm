import { describe, expect, it } from 'vitest';
import { indexAssetExportPackageAssets } from '../../main/asset-center/asset-export-asset-index';

describe('asset export package asset index', () => {
  it('exposes controlled export package assets with dry-run and create actions', () => {
    const result = indexAssetExportPackageAssets();
    const audit = result.items.find((item) => item.id === 'export.package:audit-source');

    expect(result.items).toHaveLength(2);
    expect(audit).toMatchObject({
      kind: 'export.package',
      source: 'built-in',
      scope: 'workspace',
      status: 'available',
      sourceRef: { type: 'generated', id: 'audit-source' },
    });
    expect(audit?.actions).toEqual(['viewDetails', 'dryRunExport', 'createPackage']);
    expect(audit?.policyRefs).toEqual(['asset.export']);
    expect(JSON.stringify(result.items)).not.toMatch(/apiKey|sk-[A-Za-z0-9_-]{3,}|Bearer\s+/i);
  });
});
