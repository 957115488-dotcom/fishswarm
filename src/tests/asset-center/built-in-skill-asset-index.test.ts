import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { indexBuiltInSkillAssets } from '../../main/asset-center/built-in-skill-asset-index';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-built-in-skills-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function writeSkill(name: string, body: string): void {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), body, 'utf8');
}

describe('built-in skill asset index', () => {
  it('returns a warning instead of throwing when the root is missing', () => {
    const result = indexBuiltInSkillAssets({ skillsRoot: path.join(root, 'missing') });

    expect(result.items).toEqual([]);
    expect(result.warnings[0]).toContain('not found');
  });

  it('indexes built-in skills in deterministic order', () => {
    writeSkill('zeta', '---\nname: Zeta\ndescription: Last\n---\n# Zeta');
    writeSkill('alpha', '---\nname: Alpha\ndescription: First\n---\n# Alpha');

    const result = indexBuiltInSkillAssets({ skillsRoot: root });

    expect(result.items.map((item) => item.id)).toEqual([
      'built-in-skill:alpha',
      'built-in-skill:zeta',
    ]);
    expect(result.items[0]?.kind).toBe('skill.builtIn');
    expect(result.items[0]?.title).toBe('Alpha');
  });

  it('does not expose install, run, configure, or export actions in the read-only MVP', () => {
    writeSkill('safe', '---\nname: Safe\ndescription: Safe skill\n---\n# Safe');

    const result = indexBuiltInSkillAssets({ skillsRoot: root });

    expect(result.items[0]?.actions).toEqual(['viewDetails', 'openSource']);
  });

  it('reports missing SKILL.md as a warning', () => {
    fs.mkdirSync(path.join(root, 'broken'), { recursive: true });

    const result = indexBuiltInSkillAssets({ skillsRoot: root });

    expect(result.items).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes('broken'))).toBe(true);
  });
});
