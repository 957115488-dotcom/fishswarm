import type { AssetCenterItem, AssetKind } from '../types/asset-center';

const TASK_REFERENCE_KINDS = new Set<AssetKind>([
  'role',
  'workflow.template',
  'workflow.artifact',
  'component.blueprint',
  'prompt.template',
]);

export function canUseAssetInTask(
  item: Pick<AssetCenterItem, 'kind' | 'status' | 'actions'>
): boolean {
  return (
    TASK_REFERENCE_KINDS.has(item.kind) &&
    item.status !== 'unavailable' &&
    item.actions.includes('useInTask')
  );
}

export function formatAssetTaskReference(item: AssetCenterItem): string {
  const sourceRef =
    item.sourceRef.path || item.sourceRef.uri || item.sourceRef.id || item.sourceRef.type;
  const tags = item.tags.length > 0 ? item.tags.join(', ') : '-';
  const warnings = item.warnings.length > 0 ? item.warnings.join(' | ') : '-';

  return [
    '<fishswarm_asset_reference>',
    `id: ${item.id}`,
    `kind: ${item.kind}`,
    `title: ${item.title}`,
    `summary: ${item.summary}`,
    `source: ${item.source}`,
    `scope: ${item.scope}`,
    `status: ${item.status}`,
    `sourceRef: ${sourceRef}`,
    `tags: ${tags}`,
    `warnings: ${warnings}`,
    'intent: Use this asset as context or a starting point for the next FishSwarm task.',
    'safety: Do not install, run, export, apply patches, or write files from this reference alone; require explicit user intent and the normal approval gates.',
    '</fishswarm_asset_reference>',
  ].join('\n');
}

export function appendPromptInsert(currentPrompt: string, insertText: string): string {
  const trimmedCurrent = currentPrompt.trimEnd();
  const trimmedInsert = insertText.trim();

  if (!trimmedCurrent) {
    return trimmedInsert;
  }

  return `${trimmedCurrent}\n\n${trimmedInsert}`;
}
