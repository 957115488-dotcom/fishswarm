import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../renderer/store';

describe('prompt insert store actions', () => {
  beforeEach(() => {
    useAppStore.setState({
      pendingPromptInsert: null,
      showSettings: true,
      globalNotice: null,
    });
  });

  it('queues an asset reference for the next visible prompt composer', () => {
    useAppStore.getState().queuePromptInsert({
      text: '<fishswarm_asset_reference>role</fishswarm_asset_reference>',
      source: 'assetCenter',
      assetId: 'role:qa-release-steward',
    });

    const pending = useAppStore.getState().pendingPromptInsert;
    expect(pending?.source).toBe('assetCenter');
    expect(pending?.assetId).toBe('role:qa-release-steward');
    expect(pending?.text).toContain('fishswarm_asset_reference');
    expect(pending?.createdAt).toBeGreaterThan(0);
  });

  it('clears only the matching queued insert when an id is supplied', () => {
    useAppStore.getState().queuePromptInsert({
      text: 'asset-ref',
      source: 'assetCenter',
      assetId: 'workflow.template:logic-flow:review',
    });
    const queuedId = useAppStore.getState().pendingPromptInsert?.id;
    expect(queuedId).toBeTruthy();

    useAppStore.getState().clearPromptInsert('different-id');
    expect(useAppStore.getState().pendingPromptInsert?.id).toBe(queuedId);

    useAppStore.getState().clearPromptInsert(queuedId);
    expect(useAppStore.getState().pendingPromptInsert).toBeNull();
  });
});
