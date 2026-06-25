import { describe, expect, it } from 'vitest';
import type {
  HumanReviewGateArtifact,
  PatchProposalArtifact,
  RollbackCheckpointArtifact,
  SecretScanFinding,
} from '../../shared/development-artifact-types';
import { buildArtifactLineage } from '../../shared/development-artifact-types';
import {
  buildPatchReviewViewModel,
  buildRollbackCheckpointViewModel,
} from '../../renderer/utils/patch-review-view-model';

const now = new Date('2026-06-25T08:00:00.000Z');

function proposal(overrides: Partial<PatchProposalArtifact> = {}): PatchProposalArtifact {
  const diffSha256 = 'a'.repeat(64);
  return {
    kind: 'patch_proposal',
    title: 'Patch proposal',
    lineage: buildArtifactLineage({
      parentArtifactIds: [],
      sourceRefs: [],
      roleRefs: ['role:reviewer'],
      conceptRefs: ['lowcode-concept:human-review'],
      createdBy: 'agent',
      createdAt: '2026-06-25T07:00:00.000Z',
      contentSha256: diffSha256,
      allowedPaths: ['src/**'],
      deniedPaths: ['.env', '.git/**'],
      reviewState: 'ready_for_review',
    }),
    baseCommit: 'b'.repeat(40),
    diff: 'diff --git a/src/a.ts b/src/a.ts',
    diffSha256,
    files: ['src/a.ts', 'src/b.ts'],
    allowedPaths: ['src/**'],
    deniedPaths: ['.env', '.git/**'],
    secretScan: { status: 'pass', findings: [] },
    riskSummary: 'Ready for human review.',
    ...overrides,
  };
}

function gate(overrides: Partial<HumanReviewGateArtifact> = {}): HumanReviewGateArtifact {
  return {
    kind: 'human_review_gate',
    title: 'Gate',
    lineage: buildArtifactLineage({
      parentArtifactIds: ['patch-1'],
      sourceRefs: [],
      roleRefs: ['role:reviewer'],
      conceptRefs: ['lowcode-concept:human-review'],
      createdBy: 'user',
      createdAt: '2026-06-25T07:30:00.000Z',
      contentSha256: 'c'.repeat(64),
      allowedPaths: ['src/**'],
      deniedPaths: ['.env', '.git/**'],
      reviewState: 'approved',
    }),
    patchProposalId: 'patch-1',
    approvedDiffSha256: 'a'.repeat(64),
    approver: 'human',
    approvedAt: '2026-06-25T07:30:00.000Z',
    expiresAt: '2026-06-25T09:00:00.000Z',
    allowedPaths: ['src/**'],
    allowedActions: ['patch.apply'],
    decision: 'approved',
    ...overrides,
  };
}

function secretFinding(overrides: Partial<SecretScanFinding> = {}): SecretScanFinding {
  return {
    type: 'api_key',
    line: 12,
    severity: 'blocker',
    fingerprint: 'api_key:abcdef',
    ...overrides,
  };
}

function checkpoint(): RollbackCheckpointArtifact {
  return {
    kind: 'rollback_checkpoint',
    title: 'Before apply',
    lineage: buildArtifactLineage({
      parentArtifactIds: ['patch-1'],
      sourceRefs: [],
      roleRefs: [],
      conceptRefs: ['lowcode-concept:source-export'],
      createdBy: 'system',
      createdAt: '2026-06-25T07:45:00.000Z',
      contentSha256: 'd'.repeat(64),
      allowedPaths: ['src/a.ts'],
      deniedPaths: ['.env', '.git/**'],
      reviewState: 'ready_for_review',
    }),
    baseHead: 'e'.repeat(40),
    dirtyDiffSha256: 'f'.repeat(64),
    untrackedManifest: [{ path: 'scratch/tmp.txt', size: 10, sha256: '1'.repeat(64) }],
    targetFileHashes: [{ path: 'src/a.ts', sha256: '2'.repeat(64) }],
    checkpointRef: 'rollback-checkpoint:123',
    createdAt: '2026-06-25T07:45:00.000Z',
  };
}

describe('patch review view model', () => {
  it('enables apply only when an approved gate matches the exact diff hash', () => {
    const model = buildPatchReviewViewModel({
      patchProposalId: 'patch-1',
      proposal: proposal(),
      humanReviewGate: gate(),
      humanReviewGateId: 'gate-1',
      now,
    });

    expect(model.gate.isValidApproval).toBe(true);
    expect(model.actions.canApply).toBe(true);
    expect(model.actions.canApprove).toBe(false);
    expect(model.diffShaShort).toBe('aaaaaaaaaaaa');
  });

  it('blocks apply when the approval hash no longer matches', () => {
    const model = buildPatchReviewViewModel({
      patchProposalId: 'patch-1',
      proposal: proposal({ diffSha256: '9'.repeat(64) }),
      humanReviewGate: gate(),
      humanReviewGateId: 'gate-1',
      now,
    });

    expect(model.gate.label).toBe('Diff hash changed');
    expect(model.actions.canApply).toBe(false);
    expect(model.actions.applyDisabledReason).toContain('approved diff hash');
  });

  it('allows approval before a human review gate exists', () => {
    const model = buildPatchReviewViewModel({
      patchProposalId: 'patch-1',
      proposal: proposal(),
      now,
    });

    expect(model.gate.label).toBe('Needs human review');
    expect(model.actions.canApprove).toBe(true);
    expect(model.actions.canReject).toBe(true);
    expect(model.actions.canApply).toBe(false);
  });

  it('blocks approve and apply when secret scan has blockers', () => {
    const model = buildPatchReviewViewModel({
      patchProposalId: 'patch-1',
      proposal: proposal({
        secretScan: { status: 'blocked', findings: [secretFinding()] },
      }),
      humanReviewGate: gate(),
      humanReviewGateId: 'gate-1',
      now,
    });

    expect(model.secretScan.tone).toBe('danger');
    expect(model.secretScan.blockerCount).toBe(1);
    expect(model.actions.canApprove).toBe(false);
    expect(model.actions.canApply).toBe(false);
    expect(model.actions.applyDisabledReason).toContain('secret scan');
  });

  it('blocks apply after the approval expires', () => {
    const model = buildPatchReviewViewModel({
      patchProposalId: 'patch-1',
      proposal: proposal(),
      humanReviewGate: gate({ expiresAt: '2026-06-25T07:59:59.000Z' }),
      humanReviewGateId: 'gate-1',
      now,
    });

    expect(model.gate.label).toBe('Approval expired');
    expect(model.actions.canApply).toBe(false);
  });

  it('summarizes rollback checkpoints for compact UI display', () => {
    const model = buildRollbackCheckpointViewModel(checkpoint());

    expect(model.baseHeadShort).toBe('eeeeeeeeeeee');
    expect(model.dirtyDiffShaShort).toBe('ffffffffffff');
    expect(model.targetFileCount).toBe(1);
    expect(model.untrackedCount).toBe(1);
    expect(model.targetFiles).toEqual(['src/a.ts']);
  });
});
