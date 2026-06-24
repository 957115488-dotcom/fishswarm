import { COMMON_PROVIDER_SETUPS } from '../../shared/api-provider-guidance';
import { API_PROVIDER_PRESETS, type SharedProviderPreset } from '../../shared/api-model-presets';
import type { AssetCenterItem } from './asset-center-types';

export interface ProviderAssetIndexResult {
  items: AssetCenterItem[];
  warnings: string[];
}

function providerCredentialRef(providerId: string): string {
  return `credential:ai.provider:${providerId}`;
}

function providerPresetEntries(): Array<[string, SharedProviderPreset]> {
  return Object.entries(API_PROVIDER_PRESETS);
}

function toProviderAssets(): AssetCenterItem[] {
  return providerPresetEntries().map(([providerId, preset]) => ({
    id: `ai.provider:${providerId}`,
    kind: 'ai.provider',
    source: 'built-in',
    scope: 'app',
    status: providerId === 'ollama' ? 'available' : 'requiresCredential',
    title: preset.name,
    summary: `${preset.name} model provider preset with ${preset.models.length} bundled model choices.`,
    tags: ['ai', 'provider', providerId],
    sourceRef: { type: 'generated', id: providerId },
    schemaVersion: 1,
    credentialRefs: providerId === 'ollama' ? [] : [providerCredentialRef(providerId)],
    actions: ['viewDetails'],
    warnings: [],
  })) satisfies AssetCenterItem[];
}

function toModelPresetAssets(): AssetCenterItem[] {
  return providerPresetEntries().flatMap(([providerId, preset]) =>
    preset.models.map((model) => ({
      id: `ai.modelPreset:${providerId}:${model.id}`,
      kind: 'ai.modelPreset',
      source: 'built-in',
      scope: 'app',
      status: 'available',
      title: model.name,
      summary: `${model.name} model preset for ${preset.name}.`,
      tags: ['ai', 'model', providerId],
      sourceRef: { type: 'generated', id: `${providerId}:${model.id}` },
      schemaVersion: 1,
      lineageRefs: [`ai.provider:${providerId}`],
      actions: ['viewDetails'],
      warnings: [],
    }))
  ) satisfies AssetCenterItem[];
}

function toProviderSetupAssets(): AssetCenterItem[] {
  return COMMON_PROVIDER_SETUPS.map((setup) => ({
    id: `ai.providerSetup:${setup.id}`,
    kind: 'ai.providerSetup',
    source: 'built-in',
    scope: 'app',
    status: 'available',
    title: setup.id,
    summary: `Provider setup recipe for ${setup.applyProvider} using ${setup.recommendedProtocol} protocol.`,
    tags: ['ai', 'provider-setup', setup.applyProvider, setup.recommendedProtocol],
    sourceRef: { type: 'generated', id: setup.id },
    schemaVersion: 1,
    lineageRefs: [`ai.provider:${setup.applyProvider}`],
    actions: ['viewDetails'],
    warnings: [],
  })) satisfies AssetCenterItem[];
}

export function indexProviderAssets(): ProviderAssetIndexResult {
  return {
    items: [...toProviderAssets(), ...toModelPresetAssets(), ...toProviderSetupAssets()].sort(
      (a, b) => a.id.localeCompare(b.id)
    ),
    warnings: [],
  };
}
