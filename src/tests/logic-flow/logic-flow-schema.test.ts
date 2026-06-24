import { describe, expect, it } from 'vitest';
import type { LogicFlowDocument } from '../../shared/logic-flow-types';
import {
  previewLogicFlowDocument,
  validateLogicFlowDocument,
} from '../../main/logic-flow/logic-flow-schema';

function validFlow(overrides: Partial<LogicFlowDocument> = {}): LogicFlowDocument {
  return {
    schemaVersion: 1,
    id: 'flow-1',
    title: 'Review flow',
    nodes: [
      {
        id: 'plan',
        type: 'role',
        title: 'Plan',
        roleRef: 'engineering-architect',
        allowedPaths: ['src/**'],
      },
      { id: 'review', type: 'role', title: 'Review', roleRef: 'qa-release-steward' },
    ],
    edges: [{ id: 'edge-1', source: 'plan', target: 'review' }],
    ...overrides,
  };
}

describe('logic flow schema validator', () => {
  it('validates a preview-only acyclic flow and creates a deterministic order', () => {
    const preview = previewLogicFlowDocument(validFlow());

    expect(preview.valid).toBe(true);
    expect(preview.executable).toBe(false);
    expect(preview.orderedNodeIds).toEqual(['plan', 'review']);
    expect(preview.diagnostics).toEqual([]);
  });

  it('reports duplicate nodes and missing edge references', () => {
    const diagnostics = validateLogicFlowDocument(
      validFlow({
        nodes: [
          { id: 'plan', type: 'role', title: 'Plan' },
          { id: 'plan', type: 'role', title: 'Plan duplicate' },
        ],
        edges: [{ id: 'edge-1', source: 'plan', target: 'missing' }],
      })
    );

    expect(diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(['node.duplicate', 'edge.target'])
    );
  });

  it('blocks cycles unless allowCycles is explicitly true', () => {
    const document = validFlow({
      edges: [
        { id: 'edge-1', source: 'plan', target: 'review' },
        { id: 'edge-2', source: 'review', target: 'plan' },
      ],
    });

    expect(validateLogicFlowDocument(document).map((item) => item.code)).toContain('graph.cycle');
    expect(
      validateLogicFlowDocument({ ...document, allowCycles: true }).map((item) => item.code)
    ).not.toContain('graph.cycle');
  });

  it('validates role refs and path patterns', () => {
    const diagnostics = validateLogicFlowDocument(
      validFlow({
        nodes: [
          { id: 'bad-role', type: 'role', title: 'Bad Role', roleRef: '../root' },
          { id: 'bad-path', type: 'manual', title: 'Bad Path', deniedPaths: ['../secret.txt'] },
        ],
        edges: [],
      })
    );

    expect(diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(['node.roleRef', 'node.deniedPaths'])
    );
  });
});
