import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addAgentWorkboardTask,
  createAgentWorkboard,
  createAgentWorkboardArtifact,
  recordAgentWorkboardApproval,
  saveAgentWorkboardArtifact,
  updateAgentWorkboardTask,
} from '../../main/agent-workboard/agent-workboard-service';
import { listWorkflowArtifacts } from '../../main/workflows/workflow-artifact-store';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-workboard-'));
  tempRoots.push(root);
  process.env.FISHSWARM_TIMELINE_ROOT = path.join(root, 'timeline');
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(cwd, { recursive: true });
  return cwd;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv('FISHSWARM_TIMELINE_ROOT', previousTimelineRoot);
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('agent workboard service', () => {
  it('creates and saves a board artifact with asset and role lineage', () => {
    const cwd = makeWorkspace();
    const envelope = createAgentWorkboard({
      cwd,
      title: 'low-code integration board',
      goal: 'Turn selected low-code assets into reviewed development artifacts.',
      assetRefs: ['component.blueprint:lowcode-builder:metric-card'],
      roleRefs: ['product-strategist', 'qa-release-steward'],
      now: new Date('2026-06-25T00:00:00.000Z'),
    });
    const artifacts = listWorkflowArtifacts({ cwd, kind: 'agent_task_board' });

    expect(envelope.kind).toBe('agent_task_board');
    expect(envelope.artifact.boardId).toMatch(/^agent-board:/);
    expect(envelope.artifact.lineage.taskBoardId).toBe(envelope.artifact.boardId);
    expect(envelope.artifact.lineage.assetRefs).toContain(
      'component.blueprint:lowcode-builder:metric-card'
    );
    expect(artifacts).toHaveLength(1);
  });

  it('adds, updates, and approval-links tasks without losing refs', () => {
    const cwd = makeWorkspace();
    const board = createAgentWorkboardArtifact({
      title: 'Patch review board',
      goal: 'Coordinate patch review and approval.',
      roleRefs: ['security-officer'],
      now: new Date('2026-06-25T00:00:00.000Z'),
    });
    const withTask = addAgentWorkboardTask(board, {
      id: 'task-review',
      title: 'Review patch proposal',
      status: 'ready_for_review',
      assetRefs: ['patch.proposal:123'],
      artifactRefs: ['workflow-artifact:patch_proposal:123'],
      now: new Date('2026-06-25T00:01:00.000Z'),
    });
    const updated = updateAgentWorkboardTask(withTask, 'task-review', {
      roleRefs: ['qa-release-steward'],
      now: new Date('2026-06-25T00:02:00.000Z'),
    });
    const approved = recordAgentWorkboardApproval(updated, {
      taskId: 'task-review',
      approvalRef: 'workflow-artifact:human_review_gate:456',
      artifactRef: 'workflow-artifact:apply_result:789',
      now: new Date('2026-06-25T00:03:00.000Z'),
    });
    const envelope = saveAgentWorkboardArtifact({ cwd, board: approved });

    expect(envelope.artifact.tasks[0]).toMatchObject({
      id: 'task-review',
      status: 'approved',
    });
    expect(envelope.artifact.assetRefs).toContain('patch.proposal:123');
    expect(envelope.artifact.roleRefs).toEqual(['security-officer', 'qa-release-steward']);
    expect(envelope.artifact.approvalRefs).toEqual(['workflow-artifact:human_review_gate:456']);
    expect(envelope.artifact.artifactRefs).toContain('workflow-artifact:apply_result:789');
  });
});
