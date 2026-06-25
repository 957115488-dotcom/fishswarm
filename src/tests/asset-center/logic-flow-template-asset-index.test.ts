import { describe, expect, it } from 'vitest';
import { indexLogicFlowTemplateAssets } from '../../main/asset-center/logic-flow-template-asset-index';
import type { LogicFlowBuiltinTemplate } from '../../main/logic-flow/logic-flow-compiler';

const template: LogicFlowBuiltinTemplate = {
  id: 'Example Review Flow',
  title: 'Example review flow',
  description: 'Preview a review flow without executing it.',
  document: {
    schemaVersion: 1,
    id: 'example-review-flow',
    title: 'Example review flow',
    nodes: [
      { id: 'plan', type: 'role', title: 'Plan', roleRef: 'planner' },
      { id: 'review', type: 'manual', title: 'Review' },
    ],
    edges: [{ id: 'edge-plan-review', source: 'plan', target: 'review' }],
  },
};

describe('LogicFlow template asset index', () => {
  it('indexes supplied templates as preview-only workflow template assets', () => {
    const result = indexLogicFlowTemplateAssets({ templates: [template] });

    expect(result.warnings).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('workflow.template:logic-flow:example-review-flow');
    expect(result.items[0]?.kind).toBe('workflow.template');
    expect(result.items[0]?.sourceRef).toEqual({ type: 'generated', id: 'Example Review Flow' });
    expect(result.items[0]?.actions).toEqual(['viewDetails', 'preview', 'useInTask']);
    expect(result.items[0]?.warnings[0]).toContain('not executed directly');
    expect(result.items[0]?.tags).toContain('node:manual');
    expect(result.items[0]?.tags).toContain('node:role');
  });

  it('indexes built-in LogicFlow templates without exposing run actions', () => {
    const result = indexLogicFlowTemplateAssets();

    expect(result.items.some((item) => item.id.includes('lowcode-human-review-patch'))).toBe(true);
    expect(JSON.stringify(result.items)).not.toMatch(/runLogicFlow|executeLogicFlow/);
    expect(result.items.every((item) => !item.actions.includes('run' as never))).toBe(true);
  });

  it('keeps output deterministic', () => {
    const alpha = { ...template, id: 'alpha', title: 'Alpha' };
    const zeta = { ...template, id: 'zeta', title: 'Zeta' };
    const result = indexLogicFlowTemplateAssets({ templates: [zeta, alpha] });

    expect(result.items.map((item) => item.id)).toEqual([
      'workflow.template:logic-flow:alpha',
      'workflow.template:logic-flow:zeta',
    ]);
  });
});
