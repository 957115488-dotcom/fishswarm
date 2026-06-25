import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../renderer/store';

describe('provider configure store actions', () => {
  beforeEach(() => {
    useAppStore.setState({
      pendingProviderConfigure: null,
      settingsTab: null,
      globalNotice: null,
    });
  });

  it('queues a provider configure intent without secrets', () => {
    useAppStore.getState().queueProviderConfigure({
      source: 'assetCenter',
      assetId: 'ai.provider:openai',
      providerId: 'openai',
    });

    const pending = useAppStore.getState().pendingProviderConfigure;
    expect(pending?.source).toBe('assetCenter');
    expect(pending?.assetId).toBe('ai.provider:openai');
    expect(pending?.providerId).toBe('openai');
    expect(pending?.setupId).toBeUndefined();
    expect(JSON.stringify(pending)).not.toMatch(/apiKey|sk-|AIza|Bearer/i);
  });

  it('queues a setup configure intent and clears only matching ids', () => {
    useAppStore.getState().queueProviderConfigure({
      source: 'assetCenter',
      assetId: 'ai.providerSetup:deepseek',
      providerId: 'custom',
      setupId: 'deepseek',
    });
    const queuedId = useAppStore.getState().pendingProviderConfigure?.id;
    expect(queuedId).toBeTruthy();

    useAppStore.getState().clearProviderConfigure('different-id');
    expect(useAppStore.getState().pendingProviderConfigure?.id).toBe(queuedId);

    useAppStore.getState().clearProviderConfigure(queuedId);
    expect(useAppStore.getState().pendingProviderConfigure).toBeNull();
  });
});
