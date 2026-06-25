import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createHumanReviewGateArtifact,
  validateHumanReviewGateForPatch,
} from '../../main/planning/human-review-gate-service';
import { createPatchProposalArtifact } from '../../main/planning/patch-proposal-service';
import { listWorkflowArtifacts } from '../../main/workflows/workflow-artifact-store';
import type { PatchProposalArtifact } from '../../shared/development-artifact-types';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-review-gate-'));
  tempRoots.push(root);
  process.env.FISHSWARM_TIMELINE_ROOT = path.join(root, 'timeline');
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
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

const safeDiff = `diff --git a/src/main/asset.ts b/src/main/asset.ts
--- a/src/main/asset.ts
+++ b/src/main/asset.ts
@@ -1 +1 @@
-export const value = 1;
+export const value = 2;
`;

function createProposal(cwd: string) {
  return createPatchProposalArtifact({
    cwd,
    title: 'Update asset value',
    diff: safeDiff,
    baseCommit: 'abc1234',
    allowedPaths: ['src/**'],
    deniedPaths: ['.env'],
  });
}

describe('human review gate service', () => {
  it('approves a patch proposal by exact proposal id and diff hash', () => {
    const cwd = makeWorkspace();
    const proposal = createProposal(cwd);
    const gate = createHumanReviewGateArtifact({
      cwd,
      patchProposalId: proposal.id,
      expectedDiffSha256: proposal.artifact.diffSha256,
      decision: 'approved',
      approver: 'xufangjun',
      now: new Date('2026-06-25T00:00:00.000Z'),
    });
    const artifacts = listWorkflowArtifacts({ cwd, kind: 'human_review_gate' });

    expect(gate.status).toBe('ready');
    expect(gate.artifact.patchProposalId).toBe(proposal.id);
    expect(gate.artifact.approvedDiffSha256).toBe(proposal.artifact.diffSha256);
    expect(gate.artifact.allowedActions).toEqual(['patch.apply']);
    expect(gate.artifact.lineage.reviewState).toBe('approved');
    expect(artifacts).toHaveLength(1);
    expect(
      validateHumanReviewGateForPatch({
        gate: gate.artifact,
        proposal: proposal.artifact,
        patchProposalId: proposal.id,
        now: new Date('2026-06-25T00:10:00.000Z'),
      }).valid
    ).toBe(true);
  });

  it('rejects approvals when the expected diff hash changed', () => {
    const cwd = makeWorkspace();
    const proposal = createProposal(cwd);

    expect(() =>
      createHumanReviewGateArtifact({
        cwd,
        patchProposalId: proposal.id,
        expectedDiffSha256: '0'.repeat(64),
        decision: 'approved',
        approver: 'xufangjun',
      })
    ).toThrow(/diff hash/i);
  });

  it('treats rejected and expired gates as invalid for apply', () => {
    const cwd = makeWorkspace();
    const proposal = createProposal(cwd);
    const rejected = createHumanReviewGateArtifact({
      cwd,
      patchProposalId: proposal.id,
      decision: 'rejected',
      approver: 'reviewer',
      reason: 'Needs more tests.',
    });
    const expired = createHumanReviewGateArtifact({
      cwd,
      patchProposalId: proposal.id,
      decision: 'approved',
      approver: 'reviewer',
      expiresAt: '2026-06-25T00:00:00.000Z',
      now: new Date('2026-06-24T23:00:00.000Z'),
    });

    expect(
      validateHumanReviewGateForPatch({
        gate: rejected.artifact,
        proposal: proposal.artifact,
        patchProposalId: proposal.id,
      })
    ).toMatchObject({ valid: false });
    expect(
      validateHumanReviewGateForPatch({
        gate: expired.artifact,
        proposal: proposal.artifact,
        patchProposalId: proposal.id,
        now: new Date('2026-06-25T00:01:00.000Z'),
      })
    ).toMatchObject({ valid: false, reason: 'Gate approval has expired.' });
  });

  it('invalidates a gate when the patch proposal diff hash no longer matches', () => {
    const cwd = makeWorkspace();
    const proposal = createProposal(cwd);
    const gate = createHumanReviewGateArtifact({
      cwd,
      patchProposalId: proposal.id,
      decision: 'approved',
      approver: 'reviewer',
    });
    const changedProposal: PatchProposalArtifact = {
      ...proposal.artifact,
      diffSha256: 'd'.repeat(64),
    };

    expect(
      validateHumanReviewGateForPatch({
        gate: gate.artifact,
        proposal: changedProposal,
        patchProposalId: proposal.id,
      })
    ).toMatchObject({
      valid: false,
      reason: 'Gate diff hash does not match the current patch proposal.',
    });
  });

  it('requires patch.apply and prevents gate paths from widening proposal policy', () => {
    const cwd = makeWorkspace();
    const proposal = createProposal(cwd);

    expect(() =>
      createHumanReviewGateArtifact({
        cwd,
        patchProposalId: proposal.id,
        decision: 'approved',
        approver: 'reviewer',
        allowedActions: ['patch.preview'],
      })
    ).toThrow(/patch\.apply/i);

    expect(() =>
      createHumanReviewGateArtifact({
        cwd,
        patchProposalId: proposal.id,
        decision: 'approved',
        approver: 'reviewer',
        allowedPaths: ['**'],
      })
    ).toThrow(/allowedPaths/i);

    const narrowed = createHumanReviewGateArtifact({
      cwd,
      patchProposalId: proposal.id,
      decision: 'approved',
      approver: 'reviewer',
      allowedPaths: ['src/main/**'],
    });

    expect(
      validateHumanReviewGateForPatch({
        gate: { ...narrowed.artifact, allowedActions: [] },
        proposal: proposal.artifact,
        patchProposalId: proposal.id,
      })
    ).toMatchObject({ valid: false, reason: 'Gate does not approve patch.apply.' });
  });
});
