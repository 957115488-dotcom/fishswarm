import { describe, expect, it } from 'vitest';
import type {
  AssetAction,
  AssetCenterItem,
  AssetKind,
  AssetScope,
  AssetSource,
} from '../../main/asset-center/asset-center-types';

describe('AssetCenterItem', () => {
  it('represents a read-only domain skill asset', () => {
    const kind: AssetKind = 'skill.domain';
    const source: AssetSource = 'built-in';
    const scope: AssetScope = 'app';
    const readOnlyActions: AssetAction[] = ['viewDetails', 'openSource'];

    const item: AssetCenterItem = {
      id: 'domain-skill:lowcode-builder',
      kind,
      source,
      scope,
      status: 'available',
      title: 'lowcode-builder',
      summary: 'low-code builder skill.',
      tags: ['lowcode'],
      sourceRef: { type: 'file', path: 'resources/domain-skills/lowcode-builder/SKILL.md' },
      schemaVersion: 1,
      actions: readOnlyActions,
      warnings: [],
    };

    expect(item.id).toBe('domain-skill:lowcode-builder');
    expect(item.actions).toEqual(['viewDetails', 'openSource']);
  });

  it('includes planned asset kinds for concepts, connectors, providers, workflows, and exports', () => {
    const kinds: AssetKind[] = [
      'concept.lowcode',
      'skill.builtIn',
      'skill.domain',
      'plugin',
      'mcp.server',
      'mcp.tool',
      'role',
      'workflow.template',
      'workflow.artifact',
      'component.blueprint',
      'prompt.template',
      'dataModel.draft',
      'ai.provider',
      'ai.modelPreset',
      'ai.providerSetup',
      'ai.apiConfigSet',
      'export.package',
    ];

    expect(kinds).toContain('concept.lowcode');
    expect(kinds).toContain('export.package');
  });

  it('includes controlled export package actions in the action contract', () => {
    const actions: AssetAction[] = ['dryRunExport', 'createPackage'];

    expect(actions).toEqual(['dryRunExport', 'createPackage']);
  });
});
