import type {
  AssetCenterItem,
  AssetCenterSnapshot,
  AssetKind,
  AssetSource,
  AssetStatus,
} from '../types/asset-center';

export type AssetGroupId = 'creation' | 'capabilities' | 'delivery';
export type AssetStatusTone = 'success' | 'warning' | 'danger' | 'muted' | 'accent';

export interface AssetGroupDefinition {
  id: AssetGroupId;
  labelKey: string;
  fallbackLabel: string;
  descriptionKey: string;
  fallbackDescription: string;
}

export interface AssetCenterFilters {
  keyword?: string;
  groupId?: AssetGroupId | 'all';
  kind?: AssetKind | 'all';
  source?: AssetSource | 'all';
  status?: AssetStatus | 'all';
}

export interface AssetCenterViewItem extends AssetCenterItem {
  groupId: AssetGroupId;
  kindLabel: string;
  sourceLabel: string;
  statusLabel: string;
  statusTone: AssetStatusTone;
  searchableText: string;
}

export interface AssetCenterViewModel {
  generatedAt: string;
  items: AssetCenterViewItem[];
  groupedItems: Record<AssetGroupId, AssetCenterViewItem[]>;
  groups: Array<AssetGroupDefinition & { count: number }>;
  kindOptions: Array<{ value: AssetKind; label: string; count: number }>;
  sourceOptions: Array<{ value: AssetSource; label: string; count: number }>;
  statusOptions: Array<{ value: AssetStatus; label: string; count: number; tone: AssetStatusTone }>;
  stats: {
    total: number;
    filtered: number;
    warnings: number;
  };
  warnings: string[];
}

export const ASSET_GROUPS: AssetGroupDefinition[] = [
  {
    id: 'creation',
    labelKey: 'assetCenter.groups.creation',
    fallbackLabel: '创作起点',
    descriptionKey: 'assetCenter.groups.creationDesc',
    fallbackDescription: '模板、蓝图、Lowcode 概念和可被 Agent 复用的起始方案。',
  },
  {
    id: 'capabilities',
    labelKey: 'assetCenter.groups.capabilities',
    fallbackLabel: '能力与连接',
    descriptionKey: 'assetCenter.groups.capabilitiesDesc',
    fallbackDescription: 'Skills、Roles、MCP、Plugins 与模型提供商等运行能力。',
  },
  {
    id: 'delivery',
    labelKey: 'assetCenter.groups.delivery',
    fallbackLabel: '交付与审计',
    descriptionKey: 'assetCenter.groups.deliveryDesc',
    fallbackDescription: 'Workflow artifacts、QA、Rollback、Export 等可审计交付资产。',
  },
];

const GROUP_ORDER: Record<AssetGroupId, number> = {
  creation: 0,
  capabilities: 1,
  delivery: 2,
};

const STATUS_TONE: Record<AssetStatus, AssetStatusTone> = {
  available: 'success',
  installed: 'success',
  enabled: 'success',
  disabled: 'muted',
  needsSetup: 'warning',
  requiresCredential: 'warning',
  requiresConnector: 'warning',
  unavailable: 'danger',
  unknown: 'muted',
};

const STATUS_LABELS: Record<AssetStatus, string> = {
  available: 'Available',
  installed: 'Installed',
  enabled: 'Enabled',
  disabled: 'Disabled',
  needsSetup: 'Needs setup',
  requiresCredential: 'Needs credential',
  requiresConnector: 'Needs connector',
  unavailable: 'Unavailable',
  unknown: 'Unknown',
};

const SOURCE_LABELS: Record<AssetSource, string> = {
  'built-in': 'Built-in',
  project: 'Project',
  user: 'User',
  plugin: 'Plugin',
  session: 'Session',
  generated: 'Generated',
};

export function getAssetGroupId(kind: AssetKind): AssetGroupId {
  if (
    kind === 'concept.lowcode' ||
    kind === 'workflow.template' ||
    kind === 'component.blueprint' ||
    kind === 'prompt.template' ||
    kind === 'dataModel.draft'
  ) {
    return 'creation';
  }

  if (kind === 'workflow.artifact' || kind === 'export.package') {
    return 'delivery';
  }

  return 'capabilities';
}

export function getAssetStatusTone(status: AssetStatus): AssetStatusTone {
  return STATUS_TONE[status] || 'muted';
}

export function formatAssetKindLabel(kind: AssetKind): string {
  return kind
    .replace(/\./g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace('Ai ', 'AI ')
    .replace('Mcp ', 'MCP ')
    .replace('Built In', 'Built-in')
    .replace('Lowcode', 'Lowcode');
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildSearchableText(item: AssetCenterItem): string {
  return normalizeText(
    [
      item.id,
      item.kind,
      item.source,
      item.scope,
      item.status,
      item.title,
      item.summary,
      ...item.tags,
      ...item.actions,
      ...item.warnings,
      item.sourceRef.id || '',
      item.sourceRef.path || '',
      item.sourceRef.uri || '',
    ].join(' ')
  );
}

function toViewItem(item: AssetCenterItem): AssetCenterViewItem {
  return {
    ...item,
    groupId: getAssetGroupId(item.kind),
    kindLabel: formatAssetKindLabel(item.kind),
    sourceLabel: SOURCE_LABELS[item.source] || item.source,
    statusLabel: STATUS_LABELS[item.status] || item.status,
    statusTone: getAssetStatusTone(item.status),
    searchableText: buildSearchableText(item),
  };
}

function incrementCount<T extends string>(counts: Map<T, number>, key: T): void {
  counts.set(key, (counts.get(key) || 0) + 1);
}

function toCountOptions<T extends string>(
  counts: Map<T, number>,
  labeler: (value: T) => string
): Array<{ value: T; label: string; count: number }> {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: labeler(value), count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function matchesFilters(item: AssetCenterViewItem, filters: AssetCenterFilters): boolean {
  const keyword = normalizeText(filters.keyword || '');
  if (keyword && !item.searchableText.includes(keyword)) return false;
  if (filters.groupId && filters.groupId !== 'all' && item.groupId !== filters.groupId)
    return false;
  if (filters.kind && filters.kind !== 'all' && item.kind !== filters.kind) return false;
  if (filters.source && filters.source !== 'all' && item.source !== filters.source) return false;
  if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false;
  return true;
}

export function buildAssetCenterViewModel(
  snapshot: AssetCenterSnapshot | null | undefined,
  filters: AssetCenterFilters = {}
): AssetCenterViewModel {
  const baseItems = (snapshot?.items || []).map(toViewItem).sort((a, b) => {
    const groupDelta = GROUP_ORDER[a.groupId] - GROUP_ORDER[b.groupId];
    if (groupDelta !== 0) return groupDelta;
    return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });

  const kindCounts = new Map<AssetKind, number>();
  const sourceCounts = new Map<AssetSource, number>();
  const statusCounts = new Map<AssetStatus, number>();
  for (const item of baseItems) {
    incrementCount(kindCounts, item.kind);
    incrementCount(sourceCounts, item.source);
    incrementCount(statusCounts, item.status);
  }

  const filteredItems = baseItems.filter((item) => matchesFilters(item, filters));
  const groupedItems: Record<AssetGroupId, AssetCenterViewItem[]> = {
    creation: [],
    capabilities: [],
    delivery: [],
  };
  for (const item of filteredItems) {
    groupedItems[item.groupId].push(item);
  }

  const warningCount = baseItems.reduce((count, item) => count + item.warnings.length, 0);

  return {
    generatedAt: snapshot?.generatedAt || '',
    items: filteredItems,
    groupedItems,
    groups: ASSET_GROUPS.map((group) => ({ ...group, count: groupedItems[group.id].length })),
    kindOptions: toCountOptions(kindCounts, formatAssetKindLabel),
    sourceOptions: toCountOptions(sourceCounts, (source) => SOURCE_LABELS[source] || source),
    statusOptions: toCountOptions(statusCounts, (status) => STATUS_LABELS[status] || status).map(
      (option) => ({ ...option, tone: getAssetStatusTone(option.value) })
    ),
    stats: {
      total: baseItems.length,
      filtered: filteredItems.length,
      warnings: warningCount + (snapshot?.warnings.length || 0),
    },
    warnings: snapshot?.warnings || [],
  };
}
