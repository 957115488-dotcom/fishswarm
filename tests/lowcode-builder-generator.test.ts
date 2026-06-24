import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(
  repoRoot,
  'resources',
  'domain-skills',
  'lowcode-builder',
  'scripts',
  'generate-lowcode-module.mjs'
);
const manifestPath = path.join(
  repoRoot,
  'resources',
  'domain-skills',
  'lowcode-builder',
  'examples',
  'fishswarm-dashboard.module.json'
);

describe('low-code builder generator', () => {
  it('turns a block manifest into a finished React module', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-lowcode-builder-'));

    execFileSync(process.execPath, [scriptPath, '--manifest', manifestPath, '--out', outDir], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    const tsxPath = path.join(outDir, 'FishSwarmOperationsBoard.tsx');
    const cssPath = path.join(outDir, 'fish-swarm-operations-board.css');
    const tsx = fs.readFileSync(tsxPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(tsx).toContain('export function FishSwarmOperationsBoard');
    expect(tsx).toContain('低代码模块工厂');
    expect(tsx).toContain('plugin.catalog.install');
    expect(css).toContain('.cwgen-grid');
  });
});
