import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { linkRoleOutputArtifact } from '../../main/workflows/role-artifact-linker';
import { listWorkflowArtifacts } from '../../main/workflows/workflow-artifact-store';
import {
  buildArtifactLineage,
  type FeatureBlueprintArtifact,
} from '../../shared/development-artifact-types';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-role-artifact-'));
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

describe('role artifact linker', () => {
  it('persists role output as a structured development artifact with workboard lineage', () => {
    const cwd = makeWorkspace();
    const artifact: FeatureBlueprintArtifact = {
      kind: 'feature_blueprint',
      title: 'Asset-driven setup flow',
      lineage: buildArtifactLineage({
        parentArtifactIds: [],
        sourceRefs: [],
        roleRefs: [],
        assetRefs: [],
        conceptRefs: ['lowcode-concept:asset-center'],
        createdBy: 'agent',
        createdAt: '2026-06-25T00:00:00.000Z',
        contentSha256: 'a'.repeat(64),
        allowedPaths: ['src/**'],
        deniedPaths: ['.env'],
        reviewState: 'draft',
      }),
      problem: 'Users need to start work from curated assets.',
      goals: ['Insert selected assets into a reviewed task draft.'],
      nonGoals: ['Run generators automatically.'],
      userStories: ['As a user, I can pick a template before sending a prompt.'],
      acceptanceCriteria: ['No model request is sent when inserting an asset reference.'],
      risks: [{ level: 'medium', summary: 'Prompt injection via asset metadata.' }],
    };

    const envelope = linkRoleOutputArtifact({
      cwd,
      artifact,
      roleRef: 'product-strategist',
      assetRefs: ['workflow.template:lowcode-builder:fishswarmoperationsboard'],
      taskBoardId: 'agent-board:1',
    });
    const artifacts = listWorkflowArtifacts({ cwd, kind: 'feature_blueprint' });

    expect(envelope.kind).toBe('feature_blueprint');
    expect(envelope.artifact.lineage.roleRefs).toEqual(['product-strategist']);
    expect(envelope.artifact.lineage.assetRefs).toEqual([
      'workflow.template:lowcode-builder:fishswarmoperationsboard',
    ]);
    expect(envelope.artifact.lineage.taskBoardId).toBe('agent-board:1');
    expect(artifacts).toHaveLength(1);
  });
});
