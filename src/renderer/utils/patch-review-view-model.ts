import type {
  HumanReviewGateArtifact,
  PatchProposalArtifact,
  RollbackCheckpointArtifact,
  SecretScanFinding,
} from '../../shared/development-artifact-types';

export type ReviewTone = 'success' | 'warning' | 'danger' | 'muted' | 'accent';

export interface PatchReviewViewModelInput {
  patchProposalId: string;
  proposal: PatchProposalArtifact;
  humanReviewGate?: HumanReviewGateArtifact | null;
  humanReviewGateId?: string;
  rollbackCheckpoint?: RollbackCheckpointArtifact | null;
  now?: Date;
}

export interface PatchReviewViewModel {
  patchProposalId: string;
  title: string;
  reviewState: string;
  diffShaShort: string;
  baseCommitShort: string;
  changedFiles: string[];
  changedFileCount: number;
  secretScan: {
    label: string;
    tone: ReviewTone;
    findings: SecretScanFinding[];
    blockerCount: number;
    warningCount: number;
  };
  gate: {
    label: string;
    tone: ReviewTone;
    reason: string;
    isValidApproval: boolean;
    approvalId?: string;
    expiresAt?: string;
  };
  actions: {
    canApprove: boolean;
    canReject: boolean;
    canApply: boolean;
    applyDisabledReason: string;
  };
  rollback?: RollbackCheckpointViewModel;
}

export interface RollbackCheckpointViewModel {
  title: string;
  baseHeadShort: string;
  dirtyDiffShaShort: string;
  checkpointRef: string;
  createdAt: string;
  targetFileCount: number;
  untrackedCount: number;
  targetFiles: string[];
  untrackedFiles: string[];
}

function shortHash(value: string | undefined, length = 12): string {
  return value ? value.slice(0, length) : '-';
}

function secretScanTone(status: PatchProposalArtifact['secretScan']['status']): ReviewTone {
  if (status === 'pass') return 'success';
  if (status === 'warn') return 'warning';
  return 'danger';
}

function secretScanLabel(status: PatchProposalArtifact['secretScan']['status']): string {
  if (status === 'pass') return 'Secret scan passed';
  if (status === 'warn') return 'Secret scan warnings';
  return 'Blocked by secret scan';
}

function buildGateState(input: PatchReviewViewModelInput): PatchReviewViewModel['gate'] {
  const gate = input.humanReviewGate;
  if (!gate) {
    return {
      label: 'Needs human review',
      tone: 'warning',
      reason: 'No approval gate is bound to this patch proposal yet.',
      isValidApproval: false,
    };
  }

  if (gate.decision !== 'approved') {
    return {
      label: `Gate ${gate.decision}`,
      tone: gate.decision === 'rejected' ? 'danger' : 'muted',
      reason: gate.reason || `Gate decision is ${gate.decision}.`,
      isValidApproval: false,
      approvalId: input.humanReviewGateId,
      expiresAt: gate.expiresAt,
    };
  }

  if (gate.patchProposalId !== input.patchProposalId) {
    return {
      label: 'Gate mismatch',
      tone: 'danger',
      reason: 'Approval gate is bound to a different patch proposal.',
      isValidApproval: false,
      approvalId: input.humanReviewGateId,
      expiresAt: gate.expiresAt,
    };
  }

  if (gate.approvedDiffSha256 !== input.proposal.diffSha256) {
    return {
      label: 'Diff hash changed',
      tone: 'danger',
      reason: 'The approved diff hash does not match the current patch proposal.',
      isValidApproval: false,
      approvalId: input.humanReviewGateId,
      expiresAt: gate.expiresAt,
    };
  }

  const now = input.now || new Date();
  const expiresAtMs = new Date(gate.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime()) {
    return {
      label: 'Approval expired',
      tone: 'danger',
      reason: 'The approval gate has expired and must be renewed.',
      isValidApproval: false,
      approvalId: input.humanReviewGateId,
      expiresAt: gate.expiresAt,
    };
  }

  return {
    label: 'Approved',
    tone: 'success',
    reason: `Approved by ${gate.approver}.`,
    isValidApproval: true,
    approvalId: input.humanReviewGateId,
    expiresAt: gate.expiresAt,
  };
}

export function buildRollbackCheckpointViewModel(
  checkpoint: RollbackCheckpointArtifact
): RollbackCheckpointViewModel {
  return {
    title: checkpoint.title,
    baseHeadShort: shortHash(checkpoint.baseHead),
    dirtyDiffShaShort: shortHash(checkpoint.dirtyDiffSha256),
    checkpointRef: checkpoint.checkpointRef,
    createdAt: checkpoint.createdAt,
    targetFileCount: checkpoint.targetFileHashes.length,
    untrackedCount: checkpoint.untrackedManifest.length,
    targetFiles: checkpoint.targetFileHashes.map((item) => item.path),
    untrackedFiles: checkpoint.untrackedManifest.map((item) => item.path),
  };
}

export function buildPatchReviewViewModel(input: PatchReviewViewModelInput): PatchReviewViewModel {
  const findings = input.proposal.secretScan.findings;
  const blockerCount = findings.filter((finding) => finding.severity === 'blocker').length;
  const warningCount = findings.filter((finding) => finding.severity === 'warning').length;
  const gate = buildGateState(input);
  const secretBlocked = input.proposal.secretScan.status === 'blocked';
  const applied = input.proposal.lineage.reviewState === 'applied';
  const canApply = gate.isValidApproval && !secretBlocked && Boolean(input.humanReviewGateId);

  let applyDisabledReason = '';
  if (secretBlocked) {
    applyDisabledReason = 'Patch is blocked by secret scan.';
  } else if (!gate.isValidApproval) {
    applyDisabledReason = gate.reason;
  } else if (!input.humanReviewGateId) {
    applyDisabledReason = 'Approval artifact id is required before apply.';
  }

  return {
    patchProposalId: input.patchProposalId,
    title: input.proposal.title,
    reviewState: input.proposal.lineage.reviewState,
    diffShaShort: shortHash(input.proposal.diffSha256),
    baseCommitShort: shortHash(input.proposal.baseCommit),
    changedFiles: [...input.proposal.files].sort((a, b) => a.localeCompare(b)),
    changedFileCount: input.proposal.files.length,
    secretScan: {
      label: secretScanLabel(input.proposal.secretScan.status),
      tone: secretScanTone(input.proposal.secretScan.status),
      findings,
      blockerCount,
      warningCount,
    },
    gate,
    actions: {
      canApprove: !secretBlocked && !applied && !gate.isValidApproval,
      canReject: !applied && !gate.isValidApproval,
      canApply,
      applyDisabledReason,
    },
    rollback: input.rollbackCheckpoint
      ? buildRollbackCheckpointViewModel(input.rollbackCheckpoint)
      : undefined,
  };
}
