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

  it('adapts page design and source export instead of cloning the low-code runtime', () => {
    expect(
      LOWCODE_CONCEPTS.find((concept) => concept.lowcodeKey === 'page-design')?.decision
    ).toBe('adapt');
    expect(
      LOWCODE_CONCEPTS.find((concept) => concept.lowcodeKey === 'source-export')?.fishSwarmName
    ).toBe('Auditable Export Package');
  });
});
