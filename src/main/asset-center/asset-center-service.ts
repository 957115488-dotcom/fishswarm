import path from 'node:path';
import type {
  AssetAction,
  AssetCenterItem,
  AssetCenterSnapshot,
  AssetSourceAdapter,
  AssetSourceAdapterResult,
} from './asset-center-types';
import { indexBuiltInSkillAssets } from './built-in-skill-asset-index';
import { getLowcodeConceptAssets } from './lowcode-concepts';
import { indexBundledDomainSkillAssets } from './domain-skill-asset-index';
import { indexMcpAssets } from './mcp-asset-index';
import type { PluginAssetIndexInput } from './plugin-asset-index';
import { indexPluginAssets } from './plugin-asset-index';
import { indexLowcodeBuilderAssets } from './lowcode-builder-asset-index';
import { indexProviderAssets } from './provider-asset-index';
import { indexRoleAssets } from './role-asset-index';
import type { WorkflowArtifactAssetIndexInput } from './workflow-artifact-asset-index';
import { indexWorkflowArtifactAssets } from './workflow-artifact-asset-index';

export interface BuildAssetCenterSnapshotInput {
  domainSkillsRoot?: string;
  builtInSkillsRoot?: string;
  now?: Date;
  cwd?: string;
  pluginAssets?: PluginAssetIndexInput;
  workflowArtifacts?: WorkflowArtifactAssetIndexInput | false;
  adapters?: AssetSourceAdapter[];
}

const SNAPSHOT_ALLOWED_ACTIONS = new Set<string>([
  'viewDetails',
  'openSource',
  'preview',
  'useInTask',
  'insertPrompt',
  'configure',
  'testConnection',
  'dryRunExport',
]);

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

function sanitizeItemActions(item: AssetCenterItem): { item: AssetCenterItem; warnings: string[] } {
  const warnings: string[] = [];
  const actions = (item.actions as readonly string[]).filter((action) => {
    if (SNAPSHOT_ALLOWED_ACTIONS.has(action)) {
      return true;
    }

    warnings.push(`Blocked unsafe asset action for ${item.id}: ${action}`);
    return false;
  }) as AssetAction[];

  if (warnings.length === 0) {
    return { item, warnings };
  }

  return {
    item: {
      ...item,
      actions,
      warnings: [...item.warnings, ...warnings],
    },
    warnings,
  };
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
  const lowcodeBuilderIndex = indexLowcodeBuilderAssets({
    lowcodeBuilderRoot: path.join(domainSkillsRoot, 'lowcode-builder'),
  });
  const domainSkillIndex = indexBundledDomainSkillAssets({ domainSkillsRoot });
  const builtInSkillIndex = indexBuiltInSkillAssets({ skillsRoot: builtInSkillsRoot });
  const providerIndex = indexProviderAssets();
  const mcpIndex = indexMcpAssets();
  const roleIndex = indexRoleAssets();
  const pluginIndex = indexPluginAssets(input.pluginAssets);
  const workflowArtifactIndex =
    input.workflowArtifacts === false
      ? { items: [], warnings: [] }
      : input.workflowArtifacts
        ? indexWorkflowArtifactAssets({ cwd, ...input.workflowArtifacts })
        : { items: [], warnings: [] };
  const adapterResults = (input.adapters || []).map(listAdapterAssets);
  const adapterItems = adapterResults.flatMap((result) => result.items);
  const adapterWarnings = adapterResults.flatMap((result) => result.warnings);
  const deduped = dedupeItems([
    ...conceptItems,
    ...lowcodeBuilderIndex.items,
    ...domainSkillIndex.items,
    ...builtInSkillIndex.items,
    ...providerIndex.items,
    ...mcpIndex.items,
    ...roleIndex.items,
    ...pluginIndex.items,
    ...workflowArtifactIndex.items,
    ...adapterItems,
  ]);
  const sanitized = deduped.items.map(sanitizeItemActions);
  const items = sortItems(sanitized.map((result) => result.item));
  const actionWarnings = sanitized.flatMap((result) => result.warnings);

  return {
    schemaVersion: 1,
    generatedAt: (input.now || new Date()).toISOString(),
    items,
    stats: buildStats(items),
    warnings: [
      ...domainSkillIndex.warnings,
      ...lowcodeBuilderIndex.warnings,
      ...builtInSkillIndex.warnings,
      ...providerIndex.warnings,
      ...mcpIndex.warnings,
      ...roleIndex.warnings,
      ...pluginIndex.warnings,
      ...workflowArtifactIndex.warnings,
      ...adapterWarnings,
      ...deduped.warnings,
      ...actionWarnings,
    ],
  };
}
