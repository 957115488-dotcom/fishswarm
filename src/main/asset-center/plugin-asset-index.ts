import path from 'node:path';
import type { InstalledPlugin, PluginCatalogItemV2 } from '../../renderer/types';
import type { AssetCenterItem } from './asset-center-types';

export interface PluginAssetIndexInput {
  installed?: InstalledPlugin[];
  catalog?: PluginCatalogItemV2[];
}

export interface PluginAssetIndexResult {
  items: AssetCenterItem[];
  warnings: string[];
}

function installedPluginStatus(plugin: InstalledPlugin): AssetCenterItem['status'] {
  return plugin.enabled ? 'enabled' : 'disabled';
}

function catalogPluginStatus(plugin: PluginCatalogItemV2): AssetCenterItem['status'] {
  return plugin.installable ? 'available' : 'unavailable';
}

function componentTags(prefix: string, counts: InstalledPlugin['componentCounts']): string[] {
  return (Object.entries(counts) as Array<[keyof InstalledPlugin['componentCounts'], number]>)
    .filter(([, count]) => count > 0)
    .map(([component]) => `${prefix}:${component}`);
}

function normalizeSourcePath(value: string): string {
  return path.normalize(value);
}

function installedPluginAsset(plugin: InstalledPlugin): AssetCenterItem {
  return {
    id: `plugin:installed:${plugin.pluginId}`,
    kind: 'plugin',
    source: 'user',
    scope: 'app',
    status: installedPluginStatus(plugin),
    title: plugin.name,
    summary: plugin.description || `Installed plugin: ${plugin.name}`,
    tags: ['plugin', 'installed', ...componentTags('component', plugin.componentCounts)],
    sourceRef: {
      type: 'directory',
      path: normalizeSourcePath(plugin.sourcePath),
      id: plugin.pluginId,
    },
    schemaVersion: 1,
    updatedAt: new Date(plugin.updatedAt).toISOString(),
    actions: ['viewDetails', 'openSource'],
    warnings:
      plugin.componentsEnabled.hooks || plugin.componentsEnabled.mcp
        ? ['Plugin has runtime-sensitive components enabled.']
        : [],
  };
}

function catalogPluginAsset(plugin: PluginCatalogItemV2): AssetCenterItem {
  const id = plugin.pluginId || plugin.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return {
    id: `plugin:catalog:${id}`,
    kind: 'plugin',
    source: 'generated',
    scope: 'app',
    status: catalogPluginStatus(plugin),
    title: plugin.name,
    summary: plugin.description || `Marketplace plugin: ${plugin.name}`,
    tags: [
      'plugin',
      'catalog',
      plugin.catalogSource || 'unknown',
      ...componentTags('component', plugin.componentCounts),
    ],
    sourceRef: { type: 'plugin', uri: plugin.detailUrl, id },
    schemaVersion: 1,
    actions: ['viewDetails'],
    warnings: plugin.hasManifest
      ? []
      : ['Plugin manifest details are not available until installation.'],
  };
}

export function indexPluginAssets(input: PluginAssetIndexInput = {}): PluginAssetIndexResult {
  const installed = input.installed || [];
  const catalog = input.catalog || [];
  const items = [...installed.map(installedPluginAsset), ...catalog.map(catalogPluginAsset)].sort(
    (a, b) => a.id.localeCompare(b.id)
  );
  return { items, warnings: [] };
}
