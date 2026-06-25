import { describe, expect, it } from 'vitest';
import en from '../../renderer/i18n/locales/en.json';
import zh from '../../renderer/i18n/locales/zh.json';

const REQUIRED_ASSET_CENTER_KEYS = [
  'title',
  'description',
  'detail',
  'noSelection',
  'noSelectionDesc',
  'scope',
  'source',
  'updatedAt',
  'actions',
  'useInTask',
  'configureProvider',
  'readOnlyHint',
  'warnings',
  'desktopOnly',
  'loadFailed',
  'useInTaskQueued',
  'providerConfigureQueued',
  'refresh',
  'securityHint',
  'filters',
  'searchPlaceholder',
  'allKinds',
  'allSources',
  'allStatuses',
  'resetFilters',
  'allGroups',
  'groups.creation',
  'groups.creationDesc',
  'groups.capabilities',
  'groups.capabilitiesDesc',
  'groups.delivery',
  'groups.deliveryDesc',
  'snapshotWarnings',
  'loadingTitle',
  'empty',
  'emptyDesc',
  'generatedAt',
].map((key) => `assetCenter.${key}`);

const REQUIRED_ASSET_EXPORT_KEYS = [
  'title',
  'description',
  'runDryRun',
  'notRun',
  'blockers',
  'noBlockers',
  'warnings',
  'approval',
  'createPackage',
  'resultTitle',
  'resultDesc',
  'revealPackage',
  'desktopOnly',
  'dryRunFailed',
  'packageCreated',
  'packageFailed',
].map((key) => `assetExport.${key}`);

const REQUIRED_WELCOME_ASSET_KEYS = ['welcome.startFromTemplate', 'welcome.startFromTemplateDesc'];

function readPath(locale: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (current, segment) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      locale
    );
}

describe('asset center i18n coverage', () => {
  it('defines all asset center and export copy in zh and en locales', () => {
    for (const [localeName, locale] of [
      ['zh', zh],
      ['en', en],
    ] as const) {
      for (const key of [
        ...REQUIRED_ASSET_CENTER_KEYS,
        ...REQUIRED_ASSET_EXPORT_KEYS,
        ...REQUIRED_WELCOME_ASSET_KEYS,
      ]) {
        expect(readPath(locale, key), `${localeName}:${key}`).toEqual(expect.any(String));
        expect(readPath(locale, key), `${localeName}:${key}`).not.toBe('');
      }
    }
  });
});
