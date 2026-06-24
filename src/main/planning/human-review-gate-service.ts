import type {
  HumanReviewGateArtifact,
  PatchProposalArtifact,
} from '../../shared/development-artifact-types';
import { buildArtifactLineage } from '../../shared/development-artifact-types';
import {
  readWorkflowArtifact,
  saveWorkflowArtifact,
  type WorkflowArtifactEnvelope,
} from '../workflows/workflow-artifact-store';
import { sha256Text } from './patch-proposal-service';

export interface CreateHumanReviewGateInput {
  cwd?: string;
  patchProposalId: string;
  decision: 'approved' | 'rejected';
  approver: string;
  reason?: string;
  expectedDiffSha256?: string;
  expiresAt?: string;
  allowedPaths?: string[];
  allowedActions?: string[];
  now?: Date;
}

export interface HumanReviewGateValidationResult {
  valid: boolean;
  reason?: string;
}

const DEFAULT_APPROVAL_TTL_MS = 60 * 60 * 1000;

function defaultExpiresAt(now: Date): string {
  return new Date(now.getTime() + DEFAULT_APPROVAL_TTL_MS).toISOString();
}

function readPatchProposal(cwd: string | undefined, patchProposalId: string) {
  const proposal = readWorkflowArtifact<PatchProposalArtifact>({
    cwd,
    kind: 'patch_proposal',
    id: patchProposalId,
  });
  if (!proposal) {
    throw new Error(`Patch proposal not found: ${patchProposalId}`);
  }
  return proposal;
}

function gateContentHash(input: {
  patchProposalId: string;
  diffSha256: string;
  decision: 'approved' | 'rejected';
  approver: string;
  approvedAt: string;
}): string {
  return sha256Text(JSON.stringify(input));
}

export function validateHumanReviewGateForPatch(input: {
  gate: HumanReviewGateArtifact;
  proposal: PatchProposalArtifact;
  patchProposalId: string;
  now?: Date;
}): HumanReviewGateValidationResult {
  if (input.gate.decision !== 'approved') {
    return { valid: false, reason: `Gate decision is ${input.gate.decision}.` };
  }
  if (input.gate.patchProposalId !== input.patchProposalId) {
    return { valid: false, reason: 'Gate is bound to a different patch proposal.' };
  }
  if (input.gate.approvedDiffSha256 !== input.proposal.diffSha256) {
    return { valid: false, reason: 'Gate diff hash does not match the current patch proposal.' };
  }
  const now = input.now || new Date();
  const expiresAtMs = new Date(input.gate.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime()) {
    return { valid: false, reason: 'Gate approval has expired.' };
  }
  return { valid: true };
}

export function createHumanReviewGateArtifact(
  input: CreateHumanReviewGateInput
): WorkflowArtifactEnvelope<HumanReviewGateArtifact> {
  if (!input.patchProposalId.trim()) {
    throw new Error('patchProposalId is required.');
  }
  if (!input.approver.trim()) {
    throw new Error('approver is required.');
  }

  const proposalEnvelope = readPatchProposal(input.cwd, input.patchProposalId);
  const proposal = proposalEnvelope.artifact;
  if (input.expectedDiffSha256 && input.expectedDiffSha256 !== proposal.diffSha256) {
    throw new Error('Expected diff hash does not match the patch proposal.');
  }
  if (input.decision === 'approved' && proposal.secretScan.status === 'blocked') {
    throw new Error('Cannot approve a patch proposal blocked by secret scan.');
  }

  const now = input.now || new Date();
  const approvedAt = now.toISOString();
  const expiresAt = input.expiresAt || defaultExpiresAt(now);
  const artifact: HumanReviewGateArtifact = {
    kind: 'human_review_gate',
    title: `Human review gate: ${proposal.title}`,
    lineage: buildArtifactLineage({
      parentArtifactIds: [input.patchProposalId],
      sourceRefs: [
        {
          type: 'workflow',
          id: input.patchProposalId,
          title: proposal.title,
        },
      ],
      roleRefs: proposal.lineage.roleRefs,
      conceptRefs: proposal.lineage.conceptRefs,
      sessionId: proposal.lineage.sessionId,
      createdBy: 'user',
      createdAt: approvedAt,
      contentSha256: gateContentHash({
        patchProposalId: input.patchProposalId,
        diffSha256: proposal.diffSha256,
        decision: input.decision,
        approver: input.approver,
        approvedAt,
      }),
      allowedPaths: input.allowedPaths || proposal.allowedPaths,
      deniedPaths: proposal.deniedPaths,
      reviewState: input.decision === 'approved' ? 'approved' : 'rejected',
    }),
    patchProposalId: input.patchProposalId,
    approvedDiffSha256: proposal.diffSha256,
    approver: input.approver,
    approvedAt,
    expiresAt,
    allowedPaths: input.allowedPaths || proposal.allowedPaths,
    allowedActions: input.allowedActions || ['patch.apply'],
    decision: input.decision,
    reason: input.reason,
  };

  return saveWorkflowArtifact<HumanReviewGateArtifact>({
    cwd: input.cwd,
    kind: 'human_review_gate',
    title: artifact.title,
    status: input.decision === 'approved' ? 'ready' : 'blocked',
    artifact,
  });
}
