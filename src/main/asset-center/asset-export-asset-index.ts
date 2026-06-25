import type { AssetCenterItem } from './asset-center-types';

export interface AssetExportAssetIndexResult {
  items: AssetCenterItem[];
  warnings: string[];
}

function exportPackageAsset(input: {
  id: string;
  mode: 'audit-source' | 'deployable-source';
  title: string;
  summary: string;
  tags: string[];
}): AssetCenterItem {
  return {
    id: `export.package:${input.id}`,
    kind: 'export.package',
    source: 'built-in',
    scope: 'workspace',
    status: 'available',
    title: input.title,
    summary: input.summary,
    tags: ['export', 'dry-run', 'manifest', 'checksum', 'redaction', ...input.tags],
    sourceRef: { type: 'generated', id: input.mode },
    schemaVersion: 1,
    contentHash: undefined,
    policyRefs: ['asset.export'],
    actions: ['viewDetails', 'dryRunExport', 'createPackage'],
    warnings: ['Package creation requires a passing dry-run and explicit human approval.'],
  };
}

export function indexAssetExportPackageAssets(): AssetExportAssetIndexResult {
  return {
    items: [
      exportPackageAsset({
        id: 'audit-source',
        mode: 'audit-source',
        title: 'Audit Source Export Package',
        summary:
          'Create an auditable ZIP with manifest, checksum, redaction report, and artifact provenance after dry-run approval.',
        tags: ['audit-source', 'provenance'],
      }),
      exportPackageAsset({
        id: 'deployable-source',
        mode: 'deployable-source',
        title: 'Deployable Source Export Package',
        summary:
          'Prepare a controlled source export for handoff or deployment review; secrets and blocked paths stay excluded.',
        tags: ['deployable-source', 'handoff'],
      }),
    ],
    warnings: [],
  };
}
