import type { ProviderType } from '../types';
import type { AssetCenterItem } from '../types/asset-center';
import { COMMON_PROVIDER_SETUPS } from '../../shared/api-provider-guidance';

const CONFIGURABLE_PROVIDER_IDS = new Set<ProviderType>([
  'openrouter',
  'anthropic',
  'custom',
  'openai',
  'gemini',
  'ollama',
]);
const CONFIGURABLE_SETUP_IDS = new Set<string>(COMMON_PROVIDER_SETUPS.map((setup) => setup.id));

export interface ProviderConfigureTarget {
  assetId: string;
  providerId?: ProviderType;
  setupId?: string;
}

function isProviderId(value: string | undefined): value is ProviderType {
  return Boolean(value && CONFIGURABLE_PROVIDER_IDS.has(value as ProviderType));
}

function providerIdFromLineage(lineageRefs: string[] | undefined): ProviderType | undefined {
  const providerRef = (lineageRefs || []).find((ref) => ref.startsWith('ai.provider:'));
  const providerId = providerRef?.replace(/^ai\.provider:/, '');
  return isProviderId(providerId) ? providerId : undefined;
}

function isSetupId(value: string | undefined): value is string {
  return Boolean(value && CONFIGURABLE_SETUP_IDS.has(value));
}

export function getProviderConfigureTarget(item: AssetCenterItem): ProviderConfigureTarget | null {
  if (!item.actions.includes('configure')) {
    return null;
  }

  if (item.kind === 'ai.provider') {
    const providerId = item.sourceRef.id || item.id.replace(/^ai\.provider:/, '');
    return isProviderId(providerId) ? { assetId: item.id, providerId } : null;
  }

  if (item.kind === 'ai.providerSetup') {
    const setupId = item.sourceRef.id || item.id.replace(/^ai\.providerSetup:/, '');
    if (!isSetupId(setupId)) {
      return null;
    }
    return {
      assetId: item.id,
      providerId: providerIdFromLineage(item.lineageRefs),
      setupId,
    };
  }

  return null;
}

export function canConfigureProviderAsset(item: AssetCenterItem): boolean {
  return getProviderConfigureTarget(item) !== null;
}
