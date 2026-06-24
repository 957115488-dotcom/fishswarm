import { describe, expect, it } from 'vitest';
import type { WorkflowArtifactEnvelope } from '../../main/workflows/workflow-artifact-store';
import { indexWorkflowArtifactAssets } from '../../main/asset-center/workflow-artifact-asset-index';

describe('workflow artifact asset index', () => {
  it('maps workflow artifacts to read-only workspace assets', () => {
    const artifact: WorkflowArtifactEnvelope = {
      id: '12345678-1234-1234-1234-123456789abc',
      kind: 'review_gate',
      ts: '2026-06-25T00:00:00.000Z',
      workspaceKey: 'workspace-key',
      cwd: 'D:/myProject/FishSwarm',
      title: 'Review Gate',
      status: 'ready',
      artifact: { ok: true },
    };

    const result = indexWorkflowArtifactAssets({ artifacts: [artifact] });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'workflow.artifact:review_gate:12345678-1234-1234-1234-123456789abc',
      kind: 'workflow.artifact',
      scope: 'workspace',
      status: 'available',
      actions: ['viewDetails'],
    });
    expect(result.items[0]?.warnings[0]).toContain('workspace path');
  });

  it('maps blocked or failed artifacts to unavailable assets', () => {
    const artifact: WorkflowArtifactEnvelope = {
      id: 'blocked-artifact',
      kind: 'ship_gate',
      ts: '2026-06-25T00:00:00.000Z',
      workspaceKey: 'workspace-key',
      title: 'Ship Gate',
      status: 'blocked',
      artifact: {},
    };

    const result = indexWorkflowArtifactAssets({ artifacts: [artifact] });

    expect(result.items[0]?.status).toBe('unavailable');
  });

  it('keeps output ordering deterministic', () => {
    const first: WorkflowArtifactEnvelope = {
      id: 'z-artifact',
      kind: 'review_gate',
      ts: '2026-06-25T00:00:00.000Z',
      workspaceKey: 'workspace-key',
      title: 'Z',
      status: 'ready',
      artifact: {},
    };
    const second: WorkflowArtifactEnvelope = { ...first, id: 'a-artifact', title: 'A' };

    const result = indexWorkflowArtifactAssets({ artifacts: [first, second] });

    expect(result.items.map((item) => item.id)).toEqual([
      'workflow.artifact:review_gate:a-artifact',
      'workflow.artifact:review_gate:z-artifact',
    ]);
  });
});
