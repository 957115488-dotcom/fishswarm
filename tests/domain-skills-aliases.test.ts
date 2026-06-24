import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..');
const settingsSkillsPath = path.join(
  repoRoot,
  'src',
  'renderer',
  'components',
  'settings',
  'SettingsSkills.tsx'
);
const domainSkillsPath = path.join(repoRoot, 'resources', 'domain-skills');

function normalizeSkillLookupValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readSkillName(skillMarkdown: string): string | undefined {
  return skillMarkdown.match(/^name:\s*(.+)$/m)?.[1]?.trim();
}

interface DomainSkillEntry {
  id: string;
  name: string;
  aliases: string[];
}

function readConfiguredDomainSkills(): DomainSkillEntry[] {
  const settingsSource = fs.readFileSync(settingsSkillsPath, 'utf8');
  const skillObjectPattern =
    /\{\s*id: '([^']+)',\s*name: '([^']+)',([\s\S]*?)descriptionKey: 'skills\.domainSkillsList\.[^']+',\s*\}/g;

  return [...settingsSource.matchAll(skillObjectPattern)].map((match) => {
    const aliasesSource = match[3].match(/aliases:\s*\[([^\]]*)\]/)?.[1] || '';
    const aliases = [...aliasesSource.matchAll(/'([^']+)'/g)].map((aliasMatch) => aliasMatch[1]);

    return {
      id: match[1],
      name: match[2],
      aliases,
    };
  });
}

describe('domain skills aliases', () => {
  it('recognizes installed bundled skills whose SKILL.md name differs from the folder id', () => {
    const missingAliases: string[] = [];

    for (const domainSkill of readConfiguredDomainSkills()) {
      const skillMarkdownPath = path.join(domainSkillsPath, domainSkill.id, 'SKILL.md');
      if (!fs.existsSync(skillMarkdownPath)) continue;

      const skillName = readSkillName(fs.readFileSync(skillMarkdownPath, 'utf8'));
      if (!skillName) continue;

      const lookupKeys = [domainSkill.id, domainSkill.name, ...domainSkill.aliases].map(
        normalizeSkillLookupValue
      );
      if (!lookupKeys.includes(normalizeSkillLookupValue(skillName))) {
        missingAliases.push(`${domainSkill.id} -> ${skillName}`);
      }
    }

    expect(missingAliases).toEqual([]);
  });
});
