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

function normalizePolicyPattern(pattern: string): string {
  return pattern.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/g, '');
}

function isPolicySubset(candidatePattern: string, allowedPattern: string): boolean {
  const candidate = normalizePolicyPattern(candidatePattern);
  const allowed = normalizePolicyPattern(allowedPattern);
  if (!candidate || !allowed) return false;
  if (allowed === '**' || allowed === '*') return true;
  if (candidate === allowed) return true;
  if (allowed.endsWith('/**')) {
    const allowedPrefix = allowed.slice(0, -3);
    if (candidate === allowedPrefix || candidate.startsWith(`${allowedPrefix}/`)) return true;
    if (candidate.endsWith('/**')) {
      return candidate.slice(0, -3).startsWith(`${allowedPrefix}/`);
    }
  }
  return false;
}

function allowedPathsAreSubset(candidatePaths: string[], proposalAllowedPaths: string[]): boolean {
  if (proposalAllowedPaths.length === 0) return true;
  return candidatePaths.every((candidate) =>
    proposalAllowedPaths.some((allowed) => isPolicySubset(candidate, allowed))
  );
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
  if (!input.gate.allowedActions.includes('patch.apply')) {
    return { valid: false, reason: 'Gate does not approve patch.apply.' };
  }
  if (!allowedPathsAreSubset(input.gate.allowedPaths, input.proposal.allowedPaths)) {
    return { valid: false, reason: 'Gate allowed paths are wider than the patch proposal.' };
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
  const allowedPaths = input.allowedPaths || proposal.allowedPaths;
  const allowedActions = input.allowedActions || ['patch.apply'];
  if (input.decision === 'approved' && !allowedActions.includes('patch.apply')) {
    throw new Error('Approved review gates must include the patch.apply action.');
  }
  if (!allowedPathsAreSubset(allowedPaths, proposal.allowedPaths)) {
    throw new Error('Review gate allowedPaths must not be wider than the patch proposal.');
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
      allowedPaths,
      deniedPaths: proposal.deniedPaths,
      reviewState: input.decision === 'approved' ? 'approved' : 'rejected',
    }),
    patchProposalId: input.patchProposalId,
    approvedDiffSha256: proposal.diffSha256,
    approver: input.approver,
    approvedAt,
    expiresAt,
    allowedPaths,
    allowedActions,
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
