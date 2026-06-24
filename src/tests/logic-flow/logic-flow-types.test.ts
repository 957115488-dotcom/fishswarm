import { describe, expect, it } from 'vitest';
import type { LogicFlowDocument, LogicFlowPreview } from '../../shared/logic-flow-types';

describe('logic flow types', () => {
  it('models preview-only logic flow documents', () => {
    const document: LogicFlowDocument = {
      schemaVersion: 1,
      id: 'flow-1',
      title: 'Review flow',
      nodes: [
        { id: 'plan', type: 'role', title: 'Plan', roleRef: 'engineering-architect' },
        { id: 'review', type: 'role', title: 'Review', roleRef: 'qa-release-steward' },
      ],
      edges: [{ id: 'edge-1', source: 'plan', target: 'review' }],
    };
    const preview: LogicFlowPreview = {
      valid: true,
      executable: false,
      nodeCount: document.nodes.length,
      edgeCount: document.edges.length,
      orderedNodeIds: ['plan', 'review'],
      diagnostics: [],
    };

    expect(document.schemaVersion).toBe(1);
    expect(preview.executable).toBe(false);
  });
});
