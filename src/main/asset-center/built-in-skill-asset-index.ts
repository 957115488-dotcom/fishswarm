import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AssetCenterItem } from './asset-center-types';

export interface BuiltInSkillIndexInput {
  skillsRoot: string;
}

export interface BuiltInSkillIndexResult {
  items: AssetCenterItem[];
  warnings: string[];
}

interface SkillFrontMatter {
  name?: string;
  description?: string;
}

function sha256Text(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function stripYamlQuotes(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function parseSkillFrontMatter(content: string): SkillFrontMatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};

  const result: SkillFrontMatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) continue;
    const key = field[1];
    const value = stripYamlQuotes(field[2]);
    if (key === 'name') result.name = value;
    if (key === 'description') result.description = value;
  }
  return result;
}

function safeRealpath(target: string): string | null {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function indexBuiltInSkillAssets(input: BuiltInSkillIndexInput): BuiltInSkillIndexResult {
  const warnings: string[] = [];
  const root = path.resolve(input.skillsRoot);
  const realRoot = safeRealpath(root);

  if (!realRoot) {
    return { items: [], warnings: [`Built-in skills root not found: ${root}`] };
  }

  const entries = fs
    .readdirSync(realRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const items: AssetCenterItem[] = [];

  for (const name of entries) {
    const skillPath = path.resolve(realRoot, name, 'SKILL.md');
    const realSkillPath = safeRealpath(skillPath);

    if (!realSkillPath) {
      warnings.push(`Missing SKILL.md for built-in skill: ${name}`);
      continue;
    }

    if (!isInside(realRoot, realSkillPath)) {
      warnings.push(`Skipped built-in skill outside root: ${name}`);
      continue;
    }

    const content = fs.readFileSync(realSkillPath, 'utf8');
    const frontMatter = parseSkillFrontMatter(content);

    items.push({
      id: `built-in-skill:${name}`,
      kind: 'skill.builtIn',
      source: 'built-in',
      scope: 'app',
      status: 'available',
      title: frontMatter.name || name,
      summary: frontMatter.description || `Built-in skill: ${name}`,
      tags: ['built-in-skill', name],
      sourceRef: { type: 'file', path: realSkillPath },
      schemaVersion: 1,
      contentHash: sha256Text(content),
      actions: ['viewDetails', 'openSource'],
      warnings: [],
    });
  }

  return { items, warnings };
}
