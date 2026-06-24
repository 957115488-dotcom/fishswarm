import { describe, expect, it } from 'vitest';
import type { InstalledPlugin, PluginCatalogItemV2 } from '../../renderer/types';
import { indexPluginAssets } from '../../main/asset-center/plugin-asset-index';

const emptyCounts = { skills: 0, commands: 0, agents: 0, hooks: 0, mcp: 0 };
const emptyState = { skills: false, commands: false, agents: false, hooks: false, mcp: false };

describe('plugin asset index', () => {
  it('indexes installed plugins without executing or mutating runtime state', () => {
    const installed: InstalledPlugin = {
      pluginId: 'review-tools',
      name: 'Review Tools',
      description: 'Review helpers',
      enabled: true,
      sourcePath: 'C:/plugins/source/review-tools',
      runtimePath: 'C:/plugins/runtime/review-tools',
      componentCounts: { ...emptyCounts, skills: 2, hooks: 1 },
      componentsEnabled: { ...emptyState, skills: true, hooks: false },
      installedAt: 1,
      updatedAt: 2,
    };

    const result = indexPluginAssets({ installed: [installed] });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'plugin:installed:review-tools',
      kind: 'plugin',
      source: 'user',
      status: 'enabled',
      actions: ['viewDetails', 'openSource'],
    });
    expect(result.items[0]?.tags).toContain('component:skills');
  });

  it('indexes marketplace catalog candidates as unavailable or available read-only assets', () => {
    const catalog: PluginCatalogItemV2 = {
      name: 'Marketplace Plugin',
      description: 'Candidate plugin',
      installable: true,
      hasManifest: false,
      componentCounts: { ...emptyCounts, mcp: 1 },
      pluginId: 'vendor/plugin@1.0.0',
      detailUrl: 'https://claude.com/plugins/marketplace-plugin',
      catalogSource: 'claude-marketplace',
    };

    const result = indexPluginAssets({ catalog: [catalog] });

    expect(result.items[0]?.id).toBe('plugin:catalog:vendor/plugin@1.0.0');
    expect(result.items[0]?.status).toBe('available');
    expect(result.items[0]?.actions).toEqual(['viewDetails']);
    expect(result.items[0]?.warnings[0]).toContain('manifest');
  });

  it('keeps output ordering deterministic', () => {
    const result = indexPluginAssets({
      installed: [
        {
          pluginId: 'zeta',
          name: 'Zeta',
          enabled: false,
          sourcePath: 'z',
          runtimePath: 'z-runtime',
          componentCounts: emptyCounts,
          componentsEnabled: emptyState,
          installedAt: 1,
          updatedAt: 1,
        },
        {
          pluginId: 'alpha',
          name: 'Alpha',
          enabled: true,
          sourcePath: 'a',
          runtimePath: 'a-runtime',
          componentCounts: emptyCounts,
          componentsEnabled: emptyState,
          installedAt: 1,
          updatedAt: 1,
        },
      ],
    });

    expect(result.items.map((item) => item.id)).toEqual([
      'plugin:installed:alpha',
      'plugin:installed:zeta',
    ]);
  });
});
