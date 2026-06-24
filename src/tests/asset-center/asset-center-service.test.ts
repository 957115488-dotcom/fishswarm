import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAssetCenterSnapshot } from '../../main/asset-center/asset-center-service';
import type {
  AssetCenterItem,
  AssetSourceAdapter,
} from '../../main/asset-center/asset-center-types';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-asset-center-'));
  const skillDir = path.join(root, 'domain-skills', 'lowcode-builder');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: Lowcode Lowcode\ndescription: Blueprints\n---\n# Skill',
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

describe('asset center service', () => {
  it('builds a snapshot with concepts, domain skills, stats, and warnings', () => {
    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'domain-skills'),
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

  it('includes scanner warnings without throwing', () => {
    const snapshot = buildAssetCenterSnapshot({ domainSkillsRoot: path.join(root, 'missing') });

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
    expect(snapshot.stats.role).toBe(1);
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
    expect(snapshot.warnings).toContain(
      'Duplicate asset id skipped: lowcode-concept:asset-center'
    );
  });
});
