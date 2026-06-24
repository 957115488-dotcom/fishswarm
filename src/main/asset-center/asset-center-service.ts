import path from 'node:path';
import type {
  AssetCenterItem,
  AssetCenterSnapshot,
  AssetSourceAdapter,
  AssetSourceAdapterResult,
} from './asset-center-types';
import { indexBuiltInSkillAssets } from './built-in-skill-asset-index';
import { getLowcodeConceptAssets } from './lowcode-concepts';
import { indexBundledDomainSkillAssets } from './domain-skill-asset-index';
import { indexProviderAssets } from './provider-asset-index';
import { indexRoleAssets } from './role-asset-index';

export interface BuildAssetCenterSnapshotInput {
  domainSkillsRoot?: string;
  builtInSkillsRoot?: string;
  now?: Date;
  cwd?: string;
  adapters?: AssetSourceAdapter[];
}

function defaultDomainSkillsRoot(cwd: string): string {
  return path.join(cwd, 'resources', 'domain-skills');
}

function defaultBuiltInSkillsRoot(cwd: string): string {
  return path.join(cwd, '.claude', 'skills');
}

function buildStats(items: AssetCenterItem[]): Record<string, number> {
  return items.reduce<Record<string, number>>((stats, item) => {
    stats[item.kind] = (stats[item.kind] || 0) + 1;
    return stats;
  }, {});
}

function sortItems(items: AssetCenterItem[]): AssetCenterItem[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function listAdapterAssets(adapter: AssetSourceAdapter): AssetSourceAdapterResult {
  try {
    return adapter.listAssets();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { items: [], warnings: [`Asset adapter failed (${adapter.id}): ${message}`] };
  }
}

function dedupeItems(items: AssetCenterItem[]): { items: AssetCenterItem[]; warnings: string[] } {
  const seen = new Set<string>();
  const deduped: AssetCenterItem[] = [];
  const warnings: string[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      warnings.push(`Duplicate asset id skipped: ${item.id}`);
      continue;
    }
    seen.add(item.id);
    deduped.push(item);
  }

  return { items: deduped, warnings };
}

export function buildAssetCenterSnapshot(
  input: BuildAssetCenterSnapshotInput = {}
): AssetCenterSnapshot {
  const cwd = input.cwd || process.cwd();
  const domainSkillsRoot = input.domainSkillsRoot || defaultDomainSkillsRoot(cwd);
  const builtInSkillsRoot = input.builtInSkillsRoot || defaultBuiltInSkillsRoot(cwd);
  const conceptItems = getLowcodeConceptAssets();
  const domainSkillIndex = indexBundledDomainSkillAssets({ domainSkillsRoot });
  const builtInSkillIndex = indexBuiltInSkillAssets({ skillsRoot: builtInSkillsRoot });
  const providerIndex = indexProviderAssets();
  const roleIndex = indexRoleAssets();
  const adapterResults = (input.adapters || []).map(listAdapterAssets);
  const adapterItems = adapterResults.flatMap((result) => result.items);
  const adapterWarnings = adapterResults.flatMap((result) => result.warnings);
  const deduped = dedupeItems([
    ...conceptItems,
    ...domainSkillIndex.items,
    ...builtInSkillIndex.items,
    ...providerIndex.items,
    ...roleIndex.items,
    ...adapterItems,
  ]);
  const items = sortItems(deduped.items);

  return {
    schemaVersion: 1,
    generatedAt: (input.now || new Date()).toISOString(),
    items,
    stats: buildStats(items),
    warnings: [
      ...domainSkillIndex.warnings,
      ...builtInSkillIndex.warnings,
      ...providerIndex.warnings,
      ...roleIndex.warnings,
      ...adapterWarnings,
      ...deduped.warnings,
    ],
  };
}
