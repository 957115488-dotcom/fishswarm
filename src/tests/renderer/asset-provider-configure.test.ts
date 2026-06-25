import { describe, expect, it } from 'vitest';
import type { AssetCenterItem } from '../../renderer/types/asset-center';
import {
  canConfigureProviderAsset,
  getProviderConfigureTarget,
} from '../../renderer/utils/asset-provider-configure';

function asset(overrides: Partial<AssetCenterItem> = {}): AssetCenterItem {
  return {
    id: 'ai.provider:openai',
    kind: 'ai.provider',
    source: 'built-in',
    scope: 'app',
    status: 'requiresCredential',
    title: 'OpenAI',
    summary: 'OpenAI model provider.',
    tags: ['ai', 'provider', 'openai'],
    sourceRef: { type: 'generated', id: 'openai' },
    schemaVersion: 1,
    credentialRefs: ['credential:ai.provider:openai'],
    actions: ['viewDetails', 'configure'],
    warnings: [],
    ...overrides,
  };
}

describe('asset provider configure helpers', () => {
  it('extracts provider ids from configurable provider assets', () => {
    const target = getProviderConfigureTarget(asset());

    expect(target).toEqual({
      assetId: 'ai.provider:openai',
      providerId: 'openai',
    });
    expect(canConfigureProviderAsset(asset())).toBe(true);
  });

  it('extracts setup ids and provider lineage from setup assets', () => {
    const target = getProviderConfigureTarget(
      asset({
        id: 'ai.providerSetup:deepseek',
        kind: 'ai.providerSetup',
        title: 'deepseek',
        sourceRef: { type: 'generated', id: 'deepseek' },
        lineageRefs: ['ai.provider:custom'],
      })
    );

    expect(target).toEqual({
      assetId: 'ai.providerSetup:deepseek',
      providerId: 'custom',
      setupId: 'deepseek',
    });
  });

  it('does not expose configure targets for model presets or view-only assets', () => {
    expect(
      getProviderConfigureTarget(
        asset({
          id: 'ai.modelPreset:openai:gpt-5.4',
          kind: 'ai.modelPreset',
          actions: ['viewDetails'],
        })
      )
    ).toBeNull();
    expect(getProviderConfigureTarget(asset({ actions: ['viewDetails'] }))).toBeNull();
    expect(
      getProviderConfigureTarget(asset({ sourceRef: { type: 'generated', id: 'sk-test' } }))
    ).toBeNull();
    expect(
      getProviderConfigureTarget(
        asset({
          id: 'ai.providerSetup:sk-test',
          kind: 'ai.providerSetup',
          sourceRef: { type: 'generated', id: 'sk-test' },
          lineageRefs: ['ai.provider:custom'],
        })
      )
    ).toBeNull();
  });

  it('keeps the configure intent free of api keys and token-looking values', () => {
    const serialized = JSON.stringify(getProviderConfigureTarget(asset()));

    expect(serialized).not.toMatch(/apiKey/i);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9_-]{3,}/);
    expect(serialized).not.toMatch(/AIza[0-9A-Za-z_-]*/);
    expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/i);
  });
});
