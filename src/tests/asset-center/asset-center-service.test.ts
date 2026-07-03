import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAssetCenterSnapshot } from '../../main/asset-center/asset-center-service';
import type {
  AssetCenterItem,
  AssetSourceAdapter,
} from '../../main/asset-center/asset-center-types';
import type { WorkflowArtifactEnvelope } from '../../main/workflows/workflow-artifact-store';
import type { InstalledPlugin } from '../../renderer/types';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-asset-center-'));
  const skillDir = path.join(root, 'domain-skills', 'lowcode-builder');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: low-code workflow Lowcode\ndescription: Blueprints\n---\n# Skill',
    'utf8'
  );
  const builtInSkillDir = path.join(root, 'built-in-skills', 'gstack-review');
  fs.mkdirSync(builtInSkillDir, { recursive: true });
  fs.writeFileSync(
    path.join(builtInSkillDir, 'SKILL.md'),
    '---\nname: gstack-review\ndescription: Review skill\n---\n# Review',
    'utf8'
  );
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function roleAsset(id: string): AssetCenterItem {
  return {
    id,
    kind: 'role',
    source: 'built-in',
    scope: 'app',
    status: 'available',
    title: id,
    summary: `Role asset ${id}`,
    tags: ['role'],
    sourceRef: { type: 'generated', id },
    schemaVersion: 1,
    actions: ['viewDetails'],
    warnings: [],
  };
}

function writeLowcodeBlueprints(blocks: unknown[]): void {
  const assetsDir = path.join(root, 'domain-skills', 'lowcode-builder', 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(
    path.join(assetsDir, 'component-blueprints.json'),
    JSON.stringify({ version: 1, source: 'lowcode-builder', blocks }, null, 2),
    'utf8'
  );
}

function writeLowcodeExampleModule(): void {
  const examplesDir = path.join(root, 'domain-skills', 'lowcode-builder', 'examples');
  fs.mkdirSync(examplesDir, { recursive: true });
  fs.writeFileSync(
    path.join(examplesDir, 'fishswarm-dashboard.module.json'),
    JSON.stringify(
      {
        name: 'FishSwarm Low-code Operations Board',
        componentName: 'FishSwarmOperationsBoard',
        blocks: [{ kind: 'metric-card' }],
      },
      null,
      2
    ),
    'utf8'
  );
}

function writeLowcodeGeneratorScript(): void {
  const scriptsDir = path.join(root, 'domain-skills', 'lowcode-builder', 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(
    path.join(scriptsDir, 'generate-lowcode-module.mjs'),
    '#!/usr/bin/env node\nconsole.log("reference only");\n',
    'utf8'
  );
}

describe('asset center service', () => {
  it('builds a snapshot with concepts, domain skills, stats, and warnings', () => {
    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
      builtInSkillsRoot: path.join(root, 'built-in-skills'),
      now: new Date('2026-06-24T00:00:00.000Z'),
    });

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.generatedAt).toBe('2026-06-24T00:00:00.000Z');
    expect(snapshot.items.some((item) => item.id === 'lowcode-concept:asset-center')).toBe(true);
    expect(snapshot.items.some((item) => item.id === 'domain-skill:lowcode-builder')).toBe(true);
    expect(snapshot.stats['concept.lowcode']).toBeGreaterThan(0);
    expect(snapshot.stats['skill.domain']).toBe(1);
    expect(snapshot.warnings).toEqual([]);
  });

  it('keeps snapshot item ordering deterministic', () => {
    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
    });
    const ids = snapshot.items.map((item) => item.id);

    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });

  it('includes built-in skill assets by default when a skills root is available', () => {
    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
      builtInSkillsRoot: path.join(root, 'built-in-skills'),
    });

    expect(snapshot.items.some((item) => item.id === 'built-in-skill:gstack-review')).toBe(true);
    expect(snapshot.stats['skill.builtIn']).toBe(1);
  });

  it('includes low-code component blueprints from bundled domain skill assets', () => {
    writeLowcodeBlueprints([{ kind: 'metric-card' }, { kind: 'process-flow' }]);

    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
      builtInSkillsRoot: path.join(root, 'built-in-skills'),
    });

    expect(
      snapshot.items.some((item) => item.id === 'component.blueprint:lowcode-builder:metric-card')
    ).toBe(true);
    expect(snapshot.items.some((item) => item.title.includes('Metric Card'))).toBe(true);
    expect(snapshot.stats['component.blueprint']).toBe(2);
  });

  it('includes low-code example modules and generators as read-only workflow templates', () => {
    writeLowcodeExampleModule();
    writeLowcodeGeneratorScript();

    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
      builtInSkillsRoot: path.join(root, 'built-in-skills'),
    });

    expect(
      snapshot.items.some(
        (item) => item.id === 'workflow.template:lowcode-builder:fishswarmoperationsboard'
      )
    ).toBe(true);
    expect(
      snapshot.items.some(
        (item) => item.id === 'workflow.template:lowcode-builder:generate-lowcode-module'
      )
    ).toBe(true);
    expect(snapshot.stats['workflow.template']).toBeGreaterThanOrEqual(2);
  });

  it('includes built-in LogicFlow templates as preview-only workflow assets', () => {
    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
      builtInSkillsRoot: path.join(root, 'built-in-skills'),
    });
    const logicFlowAsset = snapshot.items.find(
      (item) => item.id === 'workflow.template:logic-flow:lowcode-human-review-patch'
    );

    expect(logicFlowAsset?.kind).toBe('workflow.template');
    expect(logicFlowAsset?.actions).toEqual(['viewDetails', 'preview', 'useInTask']);
    expect(logicFlowAsset?.warnings[0]).toContain('not executed directly');
    expect(logicFlowAsset?.tags).toContain('logic-flow');
  });

  it('includes role assets by default', () => {
    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
    });

    expect(snapshot.items.some((item) => item.id.startsWith('role:'))).toBe(true);
    expect(snapshot.stats.role).toBeGreaterThan(0);
  });

  it('includes MCP server assets by default without leaking env values', () => {
    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
      builtInSkillsRoot: path.join(root, 'built-in-skills'),
    });
    const serialized = JSON.stringify(snapshot.items);

    expect(snapshot.items.some((item) => item.id.startsWith('mcp.server:'))).toBe(true);
    expect(snapshot.stats['mcp.server']).toBeGreaterThan(0);
    expect(serialized).not.toContain('NOTION_TOKEN=');
  });

  it('includes provider assets by default without leaking credentials', () => {
    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
    });
    const serialized = JSON.stringify(snapshot.items);

    expect(snapshot.items.some((item) => item.id === 'ai.provider:openai')).toBe(true);
    expect(snapshot.items.some((item) => item.kind === 'ai.modelPreset')).toBe(true);
    expect(snapshot.items.find((item) => item.id === 'ai.provider:openai')?.actions).toContain(
      'configure'
    );
    expect(serialized).not.toMatch(/apiKey/i);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9_-]{3,}/);
    expect(serialized).not.toMatch(/AIza[0-9A-Za-z_-]*/);
  });

  it('includes explicitly supplied plugin assets in the unified snapshot', () => {
    const installed: InstalledPlugin = {
      pluginId: 'review-tools',
      name: 'Review Tools',
      enabled: true,
      sourcePath: 'C:/plugins/source/review-tools',
      runtimePath: 'C:/plugins/runtime/review-tools',
      componentCounts: { skills: 1, commands: 0, agents: 0, hooks: 0, mcp: 0 },
      componentsEnabled: { skills: true, commands: false, agents: false, hooks: false, mcp: false },
      installedAt: 1,
      updatedAt: 2,
    };

    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
      pluginAssets: { installed: [installed] },
    });

    expect(snapshot.items.some((item) => item.id === 'plugin:installed:review-tools')).toBe(true);
    expect(snapshot.stats.plugin).toBe(1);
  });

  it('includes explicitly supplied workflow artifacts in the unified snapshot', () => {
    const artifact: WorkflowArtifactEnvelope = {
      id: '12345678-1234-1234-1234-123456789abc',
      kind: 'review_gate',
      ts: '2026-06-25T00:00:00.000Z',
      workspaceKey: 'workspace-key',
      title: 'Review Gate',
      status: 'ready',
      artifact: {},
    };

    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
      workflowArtifacts: { artifacts: [artifact] },
    });

    expect(
      snapshot.items.some(
        (item) => item.id === 'workflow.artifact:review_gate:12345678-1234-1234-1234-123456789abc'
      )
    ).toBe(true);
    expect(snapshot.stats['workflow.artifact']).toBe(1);
  });

  it('includes controlled export package assets in the delivery group', () => {
    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
    });
    const auditExport = snapshot.items.find((item) => item.id === 'export.package:audit-source');

    expect(auditExport?.kind).toBe('export.package');
    expect(auditExport?.actions).toEqual(['viewDetails', 'dryRunExport', 'createPackage']);
    expect(auditExport?.policyRefs).toEqual(['asset.export']);
    expect(snapshot.stats['export.package']).toBe(2);
  });

  it('includes scanner warnings without throwing', () => {
    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'missing'),
      builtInSkillsRoot: path.join(root, 'built-in-skills'),
    });

    expect(snapshot.items.some((item) => item.kind === 'concept.lowcode')).toBe(true);
    expect(snapshot.warnings.some((warning) => warning.includes('not found'))).toBe(true);
  });

  it('includes items and warnings from custom source adapters', () => {
    const adapter: AssetSourceAdapter = {
      id: 'test-role-adapter',
      listAssets: () => ({
        items: [roleAsset('role:test-reviewer')],
        warnings: ['adapter warning'],
      }),
    };

    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
      adapters: [adapter],
    });

    expect(snapshot.items.some((item) => item.id === 'role:test-reviewer')).toBe(true);
    expect(snapshot.stats.role).toBeGreaterThan(1);
    expect(snapshot.warnings).toContain('adapter warning');
  });

  it('turns adapter exceptions into warnings', () => {
    const adapter: AssetSourceAdapter = {
      id: 'broken-adapter',
      listAssets: () => {
        throw new Error('boom');
      },
    };

    const snapshot = buildAssetCenterSnapshot({
      adapters: [adapter],
      domainSkillsRoot: path.join(root, 'domain-skills'),
    });

    expect(snapshot.items.some((item) => item.kind === 'concept.lowcode')).toBe(true);
    expect(
      snapshot.warnings.some(
        (warning) => warning.includes('broken-adapter') && warning.includes('boom')
      )
    ).toBe(true);
  });

  it('skips duplicate asset ids and records a warning', () => {
    const adapter: AssetSourceAdapter = {
      id: 'duplicate-adapter',
      listAssets: () => ({ items: [roleAsset('lowcode-concept:asset-center')], warnings: [] }),
    };

    const snapshot = buildAssetCenterSnapshot({
      adapters: [adapter],
      domainSkillsRoot: path.join(root, 'domain-skills'),
    });
    const duplicates = snapshot.items.filter((item) => item.id === 'lowcode-concept:asset-center');

    expect(duplicates).toHaveLength(1);
    expect(snapshot.warnings).toContain('Duplicate asset id skipped: lowcode-concept:asset-center');
  });

  it('filters unsafe asset actions from adapter output and records warnings', () => {
    const unsafe = {
      ...roleAsset('role:unsafe-runner'),
      actions: ['viewDetails', 'run', 'createPackage'],
    } as unknown as AssetCenterItem;
    const adapter: AssetSourceAdapter = {
      id: 'unsafe-action-adapter',
      listAssets: () => ({ items: [unsafe], warnings: [] }),
    };

    const snapshot = buildAssetCenterSnapshot({
      adapters: [adapter],
      domainSkillsRoot: path.join(root, 'domain-skills'),
    });
    const item = snapshot.items.find((asset) => asset.id === 'role:unsafe-runner');

    expect(item?.actions).toEqual(['viewDetails']);
    expect(item?.warnings).toContain('Blocked unsafe asset action for role:unsafe-runner: run');
    expect(item?.warnings).toContain(
      'Blocked unsafe asset action for role:unsafe-runner: createPackage'
    );
    expect(snapshot.warnings).toContain('Blocked unsafe asset action for role:unsafe-runner: run');
    expect(snapshot.warnings).toContain(
      'Blocked unsafe asset action for role:unsafe-runner: createPackage'
    );
  });

  it('does not allow createPackage on non-export package assets', () => {
    const unsafe = {
      ...roleAsset('role:unsafe-exporter'),
      actions: ['viewDetails', 'createPackage'],
    } as unknown as AssetCenterItem;
    const adapter: AssetSourceAdapter = {
      id: 'unsafe-export-adapter',
      listAssets: () => ({ items: [unsafe], warnings: [] }),
    };

    const snapshot = buildAssetCenterSnapshot({
      adapters: [adapter],
      domainSkillsRoot: path.join(root, 'domain-skills'),
    });
    const item = snapshot.items.find((asset) => asset.id === 'role:unsafe-exporter');

    expect(item?.actions).toEqual(['viewDetails']);
    expect(item?.warnings).toContain(
      'Blocked unsafe asset action for role:unsafe-exporter: createPackage'
    );
  });
});
