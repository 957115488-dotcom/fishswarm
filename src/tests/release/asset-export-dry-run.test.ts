import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runAssetExportDryRun } from '../../main/release/asset-export-dry-run';

const tempRoots: string[] = [];

function git(cwd: string, args: string[]) {
  execFileSync('git', ['-C', cwd, ...args], { stdio: 'ignore' });
}

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-export-'));
  tempRoots.push(root);
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  git(root, ['init', 'workspace']);
  git(cwd, ['config', 'user.email', 'test@example.com']);
  git(cwd, ['config', 'user.name', 'Test User']);
  fs.writeFileSync(path.join(cwd, 'src', 'index.ts'), 'export const ok = true;\n');
  fs.writeFileSync(path.join(cwd, 'docs', 'guide.md'), '# Guide\n');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', 'initial']);
  return cwd;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('asset export dry-run', () => {
  it('generates a deterministic manifest preview without creating a zip', () => {
    const cwd = makeWorkspace();
    const result = runAssetExportDryRun({
      cwd,
      includeRules: ['src/**', 'docs/**'],
      excludeRules: ['docs/private/**'],
      artifactRefs: ['logic-flow:1'],
      now: new Date('2026-06-25T00:00:00.000Z'),
    });

    expect(result.dryRun).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.candidates.map((file) => file.path)).toEqual(['docs/guide.md', 'src/index.ts']);
    expect(result.manifest.createdAt).toBe('2026-06-25T00:00:00.000Z');
    expect(result.manifest.artifactRefs).toEqual(['logic-flow:1']);
    expect(fs.existsSync(path.join(cwd, 'export.zip'))).toBe(false);
  });

  it('reports denylist blockers before include candidates are emitted', () => {
    const cwd = makeWorkspace();
    fs.writeFileSync(path.join(cwd, '.env'), 'OPENAI_API_KEY=sk-1234567890abcdefghijklmnop\n');

    const result = runAssetExportDryRun({ cwd });

    expect(result.ok).toBe(false);
    expect(result.blockers.some((blocker) => blocker.path === '.env')).toBe(true);
    expect(result.candidates.map((file) => file.path)).not.toContain('.env');
  });

  it('adds redaction blockers for included secret-shaped content', () => {
    const cwd = makeWorkspace();
    fs.writeFileSync(path.join(cwd, 'src', 'config.ts'), 'export const key = "sk-1234567890abcdefghijklmnop";\n');

    const result = runAssetExportDryRun({ cwd, includeRules: ['src/**'], excludeRules: [] });

    expect(result.ok).toBe(false);
    expect(result.redactionFindings[0]?.path).toBe('src/config.ts');
    expect(result.blockers.some((blocker) => blocker.code === 'redaction.api_key')).toBe(true);
  });

  it('blocks symlink escapes', () => {
    const cwd = makeWorkspace();
    const outside = path.join(path.dirname(cwd), 'outside.txt');
    fs.writeFileSync(outside, 'secret');
    try {
      fs.symlinkSync(outside, path.join(cwd, 'src', 'outside-link.txt'));
    } catch {
      // Windows without developer mode may require elevated privileges; skip by returning early.
      return;
    }

    const result = runAssetExportDryRun({ cwd, includeRules: ['src/**'], excludeRules: [] });

    expect(result.ok).toBe(false);
    expect(result.blockers.some((blocker) => blocker.code === 'symlink.escape')).toBe(true);
  });
});
