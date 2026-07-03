import { describe, expect, it } from 'vitest';
import type { AssetCenterItem } from '../../renderer/types/asset-center';
import {
  appendPromptInsert,
  canUseAssetInTask,
  formatAssetTaskReference,
} from '../../renderer/utils/asset-task-reference';

function asset(overrides: Partial<AssetCenterItem> = {}): AssetCenterItem {
  return {
    id: 'workflow.template:logic-flow:lowcode-human-review-patch',
    kind: 'workflow.template',
    source: 'built-in',
    scope: 'app',
    status: 'available',
    title: 'low-code workflow Human Review Patch',
    summary: 'Create a patch proposal with a human review gate.',
    tags: ['logic-flow', 'review'],
    sourceRef: { type: 'generated', id: 'lowcode-human-review-patch' },
    schemaVersion: 1,
    actions: ['viewDetails', 'preview', 'useInTask'],
    warnings: ['Preview-only; not executed directly.'],
    ...overrides,
  };
}

describe('asset task reference helpers', () => {
  it('allows only controlled task-reference assets', () => {
    expect(canUseAssetInTask(asset())).toBe(true);
    expect(canUseAssetInTask(asset({ kind: 'role', actions: ['viewDetails', 'useInTask'] }))).toBe(
      true
    );
    expect(canUseAssetInTask(asset({ kind: 'ai.provider', actions: ['viewDetails'] }))).toBe(false);
    expect(canUseAssetInTask(asset({ actions: ['viewDetails', 'preview'] }))).toBe(false);
    expect(canUseAssetInTask(asset({ status: 'unavailable' }))).toBe(false);
  });

  it('builds a structured prompt reference without executable instructions', () => {
    const reference = formatAssetTaskReference(asset());

    expect(reference).toContain('<fishswarm_asset_reference>');
    expect(reference).toContain('id: workflow.template:logic-flow:lowcode-human-review-patch');
    expect(reference).toContain('kind: workflow.template');
    expect(reference).toContain('title: low-code workflow Human Review Patch');
    expect(reference).toContain('not executed directly');
    expect(reference).toContain('Do not install, run, export, apply patches, or write files');
  });

  it('appends references without destroying an existing user prompt', () => {
    expect(appendPromptInsert('', 'asset-ref')).toBe('asset-ref');
    expect(appendPromptInsert('Please plan this.  ', 'asset-ref')).toBe(
      'Please plan this.\n\nasset-ref'
    );
  });
});
