import { describe, expect, it } from 'vitest';
import { COMMON_PROVIDER_SETUPS } from '../../shared/api-provider-guidance';
import { API_PROVIDER_PRESETS } from '../../shared/api-model-presets';
import { indexProviderAssets } from '../../main/asset-center/provider-asset-index';

describe('provider asset index', () => {
  it('indexes provider, model preset, and provider setup assets', () => {
    const result = indexProviderAssets();

    expect(result.warnings).toEqual([]);
    expect(result.items.some((item) => item.id === 'ai.provider:openai')).toBe(true);
    expect(result.items.some((item) => item.kind === 'ai.modelPreset')).toBe(true);
    expect(result.items.some((item) => item.kind === 'ai.providerSetup')).toBe(true);
  });

  it('creates provider assets for every shared provider preset', () => {
    const result = indexProviderAssets();
    const providerIds = Object.keys(API_PROVIDER_PRESETS).map(
      (providerId) => `ai.provider:${providerId}`
    );

    expect(providerIds.every((id) => result.items.some((item) => item.id === id))).toBe(true);
    expect(
      result.items
        .filter((item) => item.kind === 'ai.provider')
        .every((item) => item.actions.includes('configure'))
    ).toBe(true);
  });

  it('creates provider setup assets for every common provider setup', () => {
    const result = indexProviderAssets();
    const setupIds = COMMON_PROVIDER_SETUPS.map((setup) => `ai.providerSetup:${setup.id}`);

    expect(setupIds.every((id) => result.items.some((item) => item.id === id))).toBe(true);
    expect(
      result.items
        .filter((item) => item.kind === 'ai.providerSetup')
        .every((item) => item.actions.includes('configure'))
    ).toBe(true);
    expect(
      result.items
        .filter((item) => item.kind === 'ai.modelPreset')
        .every((item) => !item.actions.includes('configure'))
    ).toBe(true);
  });

  it('does not include api keys, key placeholders, or token-like values in asset content', () => {
    const result = indexProviderAssets();
    const serialized = JSON.stringify(result.items);

    expect(serialized).not.toMatch(/apiKey/i);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9_-]{3,}/);
    expect(serialized).not.toMatch(/AIza[0-9A-Za-z_-]*/);
    expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/i);
  });

  it('keeps output ordering deterministic', () => {
    const ids = indexProviderAssets().items.map((item) => item.id);

    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });
});
