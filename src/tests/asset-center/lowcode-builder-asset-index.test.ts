import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { indexLowcodeBuilderAssets } from '../../main/asset-center/lowcode-builder-asset-index';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-lowcode-builder-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function writeBlueprints(blocks: unknown[]): void {
  const assetsDir = path.join(root, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(
    path.join(assetsDir, 'component-blueprints.json'),
    JSON.stringify({ version: 1, source: 'lowcode-builder', blocks }, null, 2),
    'utf8'
  );
}

function writeExampleModule(name = 'FishSwarm Low-code Operations Board'): void {
  const examplesDir = path.join(root, 'examples');
  fs.mkdirSync(examplesDir, { recursive: true });
  fs.writeFileSync(
    path.join(examplesDir, 'fishswarm-dashboard.module.json'),
    JSON.stringify(
      {
        name,
        componentName: 'FishSwarmOperationsBoard',
        description: 'A generated dashboard assembled from low-code workflow style reusable blocks.',
        blocks: [{ kind: 'metric-card' }, { kind: 'process-flow' }],
      },
      null,
      2
    ),
    'utf8'
  );
}

function writeGeneratorScript(): void {
  const scriptsDir = path.join(root, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(
    path.join(scriptsDir, 'generate-lowcode-module.mjs'),
    '#!/usr/bin/env node\nconsole.log("generator reference only");\n',
    'utf8'
  );
}

describe('low-code builder asset index', () => {
  it('returns no warnings when optional low-code assets are missing', () => {
    const result = indexLowcodeBuilderAssets({ lowcodeBuilderRoot: root });

    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('indexes component blueprints in deterministic order', () => {
    writeBlueprints([
      { kind: 'module-card', displayName: 'Module Card', description: 'Module' },
      { kind: 'metric-card', displayName: 'Metric Card', description: 'Metric' },
    ]);

    const result = indexLowcodeBuilderAssets({ lowcodeBuilderRoot: root });

    expect(result.warnings).toEqual([]);
    expect(result.items.map((item) => item.id)).toEqual([
      'component.blueprint:lowcode-builder:metric-card',
      'component.blueprint:lowcode-builder:module-card',
    ]);
    expect(result.items[0]?.kind).toBe('component.blueprint');
    expect(result.items[0]?.title).toBe('Metric Card');
    expect(result.items[0]?.summary).toContain('dashboard block');
  });

  it('keeps component blueprint assets read-only and preview-only', () => {
    writeBlueprints([{ kind: 'api-connector', displayName: 'API Connector' }]);

    const result = indexLowcodeBuilderAssets({ lowcodeBuilderRoot: root });

    expect(result.items[0]?.actions).toEqual(['viewDetails', 'preview']);
    expect(result.items[0]?.actions).not.toContain('run');
    expect(result.items[0]?.actions).not.toContain('install');
    expect(result.items[0]?.sourceRef.path).toContain('component-blueprints.json');
    expect(result.items[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('records a warning instead of throwing for malformed blueprint JSON', () => {
    const assetsDir = path.join(root, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'component-blueprints.json'), '{broken', 'utf8');

    const result = indexLowcodeBuilderAssets({ lowcodeBuilderRoot: root });

    expect(result.items).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes('Failed to read'))).toBe(true);
  });

  it('indexes the bundled example module as a workflow template', () => {
    writeExampleModule();

    const result = indexLowcodeBuilderAssets({ lowcodeBuilderRoot: root });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('workflow.template:lowcode-builder:fishswarmoperationsboard');
    expect(result.items[0]?.kind).toBe('workflow.template');
    expect(result.items[0]?.title).toBe('FishSwarm Low-code Operations Board');
    expect(result.items[0]?.actions).toEqual(['viewDetails', 'preview']);
  });

  it('indexes the generator script as a read-only workflow template reference', () => {
    writeGeneratorScript();

    const result = indexLowcodeBuilderAssets({ lowcodeBuilderRoot: root });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('workflow.template:lowcode-builder:generate-lowcode-module');
    expect(result.items[0]?.actions).toEqual(['viewDetails', 'openSource']);
    expect(result.items[0]?.warnings[0]).toContain('read-only');
    expect(result.items[0]?.actions).not.toContain('run');
  });

  it('sorts component, example, and generator assets together deterministically', () => {
    writeBlueprints([{ kind: 'module-card' }]);
    writeExampleModule();
    writeGeneratorScript();

    const result = indexLowcodeBuilderAssets({ lowcodeBuilderRoot: root });

    expect(result.items.map((item) => item.id)).toEqual([
      'component.blueprint:lowcode-builder:module-card',
      'workflow.template:lowcode-builder:fishswarmoperationsboard',
      'workflow.template:lowcode-builder:generate-lowcode-module',
    ]);
  });
});
