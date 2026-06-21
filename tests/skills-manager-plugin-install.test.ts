import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let testRoot = '';

vi.mock('electron', () => ({
  app: {
    getAppPath: () => testRoot,
    getVersion: () => '0.0.0-test',
    getPath: (name: string) => {
      if (name === 'userData') return path.join(testRoot, 'userData');
      if (name === 'home') return path.join(testRoot, 'home');
      return testRoot;
    },
  },
}));

vi.mock('../src/main/utils/logger', () => ({
  log: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { SkillsManager } from '../src/main/skills/skills-manager';
import type { DatabaseInstance } from '../src/main/db/database';

function createDbMock(): DatabaseInstance {
  const statement = { run: vi.fn() };
  return {
    raw: {} as any,
    sessions: {} as any,
    messages: {} as any,
    traceSteps: {} as any,
    scheduledTasks: {} as any,
    prepare: vi.fn(() => statement as any),
    exec: vi.fn(),
    pragma: vi.fn(),
    close: vi.fn(),
  };
}

function createPluginDirectory(
  root: string,
  pluginName: string,
  skills: Array<{ name: string; description: string }>,
  withManifest = true
): string {
  const pluginRoot = path.join(root, pluginName);
  if (withManifest) {
    fs.mkdirSync(path.join(pluginRoot, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginRoot, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: pluginName, version: '1.0.0', description: `${pluginName} plugin` }, null, 2),
      'utf8'
    );
  }

  for (const skill of skills) {
    const skillRoot = path.join(pluginRoot, 'skills', skill.name);
    fs.mkdirSync(skillRoot, { recursive: true });
    fs.writeFileSync(
      path.join(skillRoot, 'SKILL.md'),
      `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\nUse ${skill.name}.`,
      'utf8'
    );
  }

  return pluginRoot;
}

describe('SkillsManager installPluginFromDirectory', () => {
  beforeEach(() => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-plugin-test-'));
    fs.mkdirSync(path.join(testRoot, 'userData'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'home'), { recursive: true });
  });

  afterEach(() => {
    if (testRoot && fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('installs all skills from a valid plugin directory', async () => {
    const pluginRoot = createPluginDirectory(testRoot, 'demo-plugin', [
      { name: 'alpha', description: 'Alpha skill' },
      { name: 'beta', description: 'Beta skill' },
    ]);
    const manager = new SkillsManager(createDbMock());

    const result = await manager.installPluginFromDirectory(pluginRoot);

    expect(result.pluginName).toBe('demo-plugin');
    expect(result.installedSkills.sort()).toEqual(['alpha', 'beta']);
    expect(result.errors).toEqual([]);
  });

  it('overwrites same skill when plugin is reinstalled', async () => {
    const pluginRoot = createPluginDirectory(testRoot, 'demo-plugin', [{ name: 'alpha', description: 'Old description' }]);
    const manager = new SkillsManager(createDbMock());
    await manager.installPluginFromDirectory(pluginRoot);

    fs.writeFileSync(
      path.join(pluginRoot, 'skills', 'alpha', 'SKILL.md'),
      '---\nname: alpha\ndescription: New description\n---\n\nUpdated',
      'utf8'
    );

    const result = await manager.installPluginFromDirectory(pluginRoot);
    expect(result.installedSkills).toEqual(['alpha']);

    const installedSkillPath = path.join(testRoot, 'userData', 'claude', 'skills', 'alpha', 'SKILL.md');
    expect(fs.readFileSync(installedSkillPath, 'utf8')).toContain('New description');
  });

  it('removes nested skill directories during uninstall', async () => {
    const pluginRoot = createPluginDirectory(testRoot, 'demo-plugin', [
      { name: 'alpha', description: 'Alpha skill' },
    ]);
    const manager = new SkillsManager(createDbMock());
    const installedSkill = await manager.installPluginFromDirectory(pluginRoot);
    const skillId = `global-${installedSkill.installedSkills[0]}`;
    const installedSkillPath = path.join(testRoot, 'userData', 'claude', 'skills', 'alpha');
    const nestedPath = path.join(installedSkillPath, '.github', 'workflows');
    fs.mkdirSync(nestedPath, { recursive: true });
    fs.writeFileSync(path.join(nestedPath, 'ci.yml'), 'name: ci', 'utf8');

    await manager.uninstallSkill(skillId);

    expect(fs.existsSync(installedSkillPath)).toBe(false);
  });

  it('uninstalls a global skill by its folder id when folder differs from skill name', async () => {
    const manager = new SkillsManager(createDbMock());
    const globalSkillsPath = manager.getGlobalSkillsPath();
    const canonicalPath = path.join(globalSkillsPath, 'alpha');
    const alternatePath = path.join(globalSkillsPath, 'alpha-copy');
    fs.mkdirSync(canonicalPath, { recursive: true });
    fs.mkdirSync(alternatePath, { recursive: true });
    fs.writeFileSync(
      path.join(canonicalPath, 'SKILL.md'),
      '---\nname: alpha\ndescription: Canonical alpha\n---\n\nCanonical',
      'utf8'
    );
    fs.writeFileSync(
      path.join(alternatePath, 'SKILL.md'),
      '---\nname: alpha\ndescription: Alternate alpha\n---\n\nAlternate',
      'utf8'
    );

    await manager.loadGlobalSkills();
    await manager.uninstallSkill('global-alpha-copy');

    expect(fs.existsSync(alternatePath)).toBe(false);
    expect(fs.existsSync(canonicalPath)).toBe(true);
  });

  it('hides a deleted global skill even when its directory still exists', async () => {
    const manager = new SkillsManager(createDbMock());
    const globalSkillsPath = manager.getGlobalSkillsPath();
    const skillPath = path.join(globalSkillsPath, 'alpha');
    fs.mkdirSync(skillPath, { recursive: true });
    fs.writeFileSync(
      path.join(skillPath, 'SKILL.md'),
      '---\nname: alpha\ndescription: Lingering alpha\n---\n\nLingering',
      'utf8'
    );
    fs.writeFileSync(
      path.join(globalSkillsPath, '.deleted-skills.json'),
      JSON.stringify({ names: ['alpha'] }),
      'utf8'
    );

    const skills = await manager.loadGlobalSkills();

    expect(skills.some((skill) => skill.name === 'alpha')).toBe(false);
  });

  it('ignores the deleted-skills marker when loading legacy json skill configs', async () => {
    const manager = new SkillsManager(createDbMock());
    const globalSkillsPath = manager.getGlobalSkillsPath();
    fs.mkdirSync(globalSkillsPath, { recursive: true });
    fs.writeFileSync(
      path.join(globalSkillsPath, '.deleted-skills.json'),
      JSON.stringify({ names: ['gstack'] }),
      'utf8'
    );

    const skills = await manager.listSkills({ type: 'custom' });

    expect(skills.some((skill) => skill.name === undefined)).toBe(false);
  });

  it('clears a deleted marker when reinstalling the same skill name', async () => {
    const pluginRoot = createPluginDirectory(testRoot, 'demo-plugin', [
      { name: 'alpha', description: 'Alpha skill' },
    ]);
    const manager = new SkillsManager(createDbMock());
    const globalSkillsPath = manager.getGlobalSkillsPath();
    fs.mkdirSync(globalSkillsPath, { recursive: true });
    fs.writeFileSync(
      path.join(globalSkillsPath, '.deleted-skills.json'),
      JSON.stringify({ names: ['alpha'] }),
      'utf8'
    );

    await manager.installPluginFromDirectory(pluginRoot);
    const skills = await manager.loadGlobalSkills();

    expect(skills.some((skill) => skill.name === 'alpha')).toBe(true);
    expect(fs.existsSync(path.join(globalSkillsPath, '.deleted-skills.json'))).toBe(false);
  });

  it('returns clear error when plugin has no skills directory', async () => {
    const pluginRoot = createPluginDirectory(testRoot, 'empty-plugin', []);
    const manager = new SkillsManager(createDbMock());

    await expect(manager.installPluginFromDirectory(pluginRoot)).rejects.toThrow('Plugin has no installable skills');
  });

  it('installs skills even when plugin manifest is missing', async () => {
    const pluginRoot = createPluginDirectory(
      testRoot,
      'plugin-dev',
      [{ name: 'skill-development', description: 'Develop plugin skills' }],
      false
    );
    const manager = new SkillsManager(createDbMock());

    const result = await manager.installPluginFromDirectory(pluginRoot);

    expect(result.pluginName).toBe('plugin-dev');
    expect(result.installedSkills).toEqual(['skill-development']);
    expect(result.errors).toEqual([]);
  });

  it('does not show duplicate skills after plugin install', async () => {
    const pluginRoot = createPluginDirectory(testRoot, 'hookify', [
      { name: 'Writing Hookify Rules', description: 'Write hookify rules' },
    ]);
    const manager = new SkillsManager(createDbMock());

    await manager.installPluginFromDirectory(pluginRoot);

    const skills = await manager.listSkills({ type: 'custom' });
    const sameNameSkills = skills.filter(
      (skill) => skill.name.toLowerCase() === 'writing hookify rules'
    );

    expect(sameNameSkills).toHaveLength(1);
    expect(sameNameSkills[0].id.startsWith('global-')).toBe(true);
  });
});
