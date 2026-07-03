import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LOWCODE_CONCEPTS,
  getLowcodeConceptAssets,
} from '../../main/asset-center/lowcode-concepts';

describe('low-code concept mapping', () => {
  it('covers all planned low-code concepts in deterministic order', () => {
    expect(LOWCODE_CONCEPTS.map((concept) => concept.lowcodeKey)).toEqual([
      'asset-center',
      'page-design',
      'logic-design',
      'process-design',
      'data-model',
      'interface-integration',
      'source-export',
    ]);
  });

  it('maps concepts to read-only assets', () => {
    const assets = getLowcodeConceptAssets();

    expect(assets[0]?.id).toBe('lowcode-concept:asset-center');
    expect(assets.every((asset) => asset.kind === 'concept.lowcode')).toBe(true);
    expect(assets.every((asset) => asset.actions.every((action) => action === 'viewDetails'))).toBe(
      true
    );
  });

  it('does not expose placeholder text in concept labels or summaries', () => {
    for (const concept of LOWCODE_CONCEPTS) {
      expect(concept.lowcodeName).not.toContain('???');
      expect(concept.fishSwarmName).not.toContain('???');
      expect(concept.rationale).not.toContain('???');
    }

    const serialized = JSON.stringify(getLowcodeConceptAssets());
    expect(serialized).not.toContain('???');
  });

  it('keeps the Chinese Settings assets label user-facing', () => {
    const zhPath = path.resolve(__dirname, '../../renderer/i18n/locales/zh.json');
    const zh = JSON.parse(fs.readFileSync(zhPath, 'utf8')) as {
      settings?: { assets?: string; assetsDesc?: string };
    };

    expect(zh.settings?.assets).toBe('资源库');
    expect(zh.settings?.assetsDesc).toContain('可复用资产');
    expect(zh.settings?.assetsDesc).not.toContain('???');
  });

  it('adapts page design and source export instead of cloning the low-code runtime', () => {
    expect(LOWCODE_CONCEPTS.find((concept) => concept.lowcodeKey === 'page-design')?.decision).toBe(
      'adapt'
    );
    expect(
      LOWCODE_CONCEPTS.find((concept) => concept.lowcodeKey === 'source-export')?.fishSwarmName
    ).toContain('Auditable Export Package');
  });
});
