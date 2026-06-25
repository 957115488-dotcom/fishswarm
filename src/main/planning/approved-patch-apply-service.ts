import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ApplyResultArtifact,
  HumanReviewGateArtifact,
  PatchProposalArtifact,
} from '../../shared/development-artifact-types';
import { buildArtifactLineage } from '../../shared/development-artifact-types';
import {
  readWorkflowArtifact,
  saveWorkflowArtifact,
  type WorkflowArtifactEnvelope,
} from '../workflows/workflow-artifact-store';
import { createRollbackCheckpointArtifact } from './rollback-checkpoint-service';
import { sha256Text, validatePatchProposalPaths } from './patch-proposal-service';
import { validateHumanReviewGateForPatch } from './human-review-gate-service';

export interface ApplyApprovedPatchInput {
  cwd: string;
  patchProposalId: string;
  humanReviewGateId: string;
  now?: Date;
  createdBy?: string;
}

function readRequiredWorkflowArtifact<T>(input: {
  cwd: string;
  kind: 'patch_proposal' | 'human_review_gate';
  id: string;
}): WorkflowArtifactEnvelope<T> {
  const artifact = readWorkflowArtifact<T>({ cwd: input.cwd, kind: input.kind, id: input.id });
  if (!artifact) {
    throw new Error(`${input.kind} not found: ${input.id}`);
  }
  return artifact;
}

function runGitApply(cwd: string, diff: string, checkOnly: boolean): void {
  execFileSync(
    'git',
    ['-C', cwd, 'apply', ...(checkOnly ? ['--check'] : []), '--whitespace=nowarn', '-'],
    {
      input: diff,
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
}

function runGitText(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

function currentDirtyHash(cwd: string): string | undefined {
  const dirtyDiff = runGitText(cwd, ['diff', '--binary']);
  return dirtyDiff.trim() ? sha256Text(dirtyDiff) : undefined;
}

function saveApplyResult(input: {
  cwd: string;
  proposalEnvelope: WorkflowArtifactEnvelope<PatchProposalArtifact>;
  gateEnvelope: WorkflowArtifactEnvelope<HumanReviewGateArtifact>;
  rollbackCheckpointId?: string;
  status: ApplyResultArtifact['status'];
  error?: string;
  now: Date;
  createdBy: string;
}): WorkflowArtifactEnvelope<ApplyResultArtifact> {
  const proposal = input.proposalEnvelope.artifact;
  const gate = input.gateEnvelope.artifact;
  const appliedAt = input.now.toISOString();
  const artifact: ApplyResultArtifact = {
    kind: 'apply_result',
    title: `Apply result: ${proposal.title}`,
    lineage: buildArtifactLineage({
      parentArtifactIds: [input.proposalEnvelope.id, input.gateEnvelope.id].filter(Boolean),
      sourceRefs: [
        { type: 'workflow', id: input.proposalEnvelope.id, title: proposal.title },
        { type: 'workflow', id: input.gateEnvelope.id, title: gate.title },
      ],
      roleRefs: proposal.lineage.roleRefs,
      conceptRefs: proposal.lineage.conceptRefs,
      sessionId: proposal.lineage.sessionId,
      createdBy: input.createdBy,
      createdAt: appliedAt,
      contentSha256: sha256Text(
        JSON.stringify({
          patchProposalId: input.proposalEnvelope.id,
          approvalArtifactId: input.gateEnvelope.id,
          approvedDiffSha256: gate.approvedDiffSha256,
          status: input.status,
          filesChanged: proposal.files,
          rollbackCheckpointId: input.rollbackCheckpointId,
          error: input.error,
        })
      ),
      allowedPaths: gate.allowedPaths,
      deniedPaths: proposal.deniedPaths,
      reviewState: input.status === 'applied' ? 'applied' : 'draft',
    }),
    patchProposalId: input.proposalEnvelope.id,
    approvalArtifactId: input.gateEnvelope.id,
    approvedDiffSha256: gate.approvedDiffSha256,
    appliedAt,
    status: input.status,
    filesChanged: input.status === 'applied' ? proposal.files : [],
    rollbackCheckpointId: input.rollbackCheckpointId,
    error: input.error,
  };

  return saveWorkflowArtifact<ApplyResultArtifact>({
    cwd: input.cwd,
    kind: 'apply_result',
    title: artifact.title,
    status: input.status === 'applied' ? 'pass' : 'fail',
    artifact,
  });
}

export function applyApprovedPatch(
  input: ApplyApprovedPatchInput
): WorkflowArtifactEnvelope<ApplyResultArtifact> {
  if (!input.cwd || !fs.existsSync(input.cwd) || !fs.statSync(input.cwd).isDirectory()) {
    throw new Error('A valid workspace cwd is required to apply an approved patch.');
  }

  const cwd = path.resolve(input.cwd);
  const proposalEnvelope = readRequiredWorkflowArtifact<PatchProposalArtifact>({
    cwd,
    kind: 'patch_proposal',
    id: input.patchProposalId,
  });
  const gateEnvelope = readRequiredWorkflowArtifact<HumanReviewGateArtifact>({
    cwd,
    kind: 'human_review_gate',
    id: input.humanReviewGateId,
  });
  const proposal = proposalEnvelope.artifact;
  const gate = gateEnvelope.artifact;
  const now = input.now || new Date();
  const createdBy = input.createdBy || 'system';

  const gateValidation = validateHumanReviewGateForPatch({
    gate,
    proposal,
    patchProposalId: proposalEnvelope.id,
    now,
  });
  if (!gateValidation.valid) {
    throw new Error(`Human review gate is not valid: ${gateValidation.reason || 'unknown reason'}`);
  }
  if (proposal.secretScan.status === 'blocked') {
    throw new Error('Cannot apply a patch proposal blocked by secret scan.');
  }
  const currentHead = runGitText(cwd, ['rev-parse', 'HEAD']).trim();
  if (currentHead && proposal.baseCommit !== currentHead) {
    throw new Error('Patch proposal baseCommit does not match the current workspace HEAD.');
  }
  if (proposal.baseDirtyHash && proposal.baseDirtyHash !== currentDirtyHash(cwd)) {
    throw new Error('Patch proposal baseDirtyHash does not match the current workspace state.');
  }

  const pathValidation = validatePatchProposalPaths({
    files: proposal.files,
    allowedPaths: gate.allowedPaths,
    deniedPaths: proposal.deniedPaths,
  });
  if (pathValidation.blocked.length > 0) {
    throw new Error(
      `Patch proposal path validation failed before apply: ${pathValidation.blocked
        .map((blocked) => `${blocked.file}: ${blocked.reason}`)
        .join('; ')}`
    );
  }

  try {
    runGitApply(cwd, proposal.diff, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return saveApplyResult({
      cwd,
      proposalEnvelope,
      gateEnvelope,
      status: 'failed',
      error: message,
      now,
      createdBy,
    });
  }

  const rollback = createRollbackCheckpointArtifact({
    cwd,
    patchProposalId: proposalEnvelope.id,
    title: `Before apply: ${proposal.title}`,
    targetFiles: proposal.files,
    now,
    createdBy,
  });

  try {
    runGitApply(cwd, proposal.diff, false);
    return saveApplyResult({
      cwd,
      proposalEnvelope,
      gateEnvelope,
      rollbackCheckpointId: rollback.id,
      status: 'applied',
      now,
      createdBy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return saveApplyResult({
      cwd,
      proposalEnvelope,
      gateEnvelope,
      rollbackCheckpointId: rollback.id,
      status: 'failed',
      error: message,
      now,
      createdBy,
    });
  }
}
