import path from 'node:path';
import type { AssetCenterItem, AssetCenterSnapshot } from './asset-center-types';
import { getLowcodeConceptAssets } from './lowcode-concepts';
import { indexBundledDomainSkillAssets } from './domain-skill-asset-index';

export interface BuildAssetCenterSnapshotInput {
  domainSkillsRoot?: string;
  now?: Date;
  cwd?: string;
}

function defaultDomainSkillsRoot(cwd: string): string {
  return path.join(cwd, 'resources', 'domain-skills');
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

export function buildAssetCenterSnapshot(
  input: BuildAssetCenterSnapshotInput = {}
): AssetCenterSnapshot {
  const cwd = input.cwd || process.cwd();
  const domainSkillsRoot = input.domainSkillsRoot || defaultDomainSkillsRoot(cwd);
  const conceptItems = getLowcodeConceptAssets();
  const domainSkillIndex = indexBundledDomainSkillAssets({ domainSkillsRoot });
  const items = sortItems([...conceptItems, ...domainSkillIndex.items]);

  return {
    schemaVersion: 1,
    generatedAt: (input.now || new Date()).toISOString(),
    items,
    stats: buildStats(items),
    warnings: [...domainSkillIndex.warnings],
  };
}
