import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  GitPullRequest,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  HumanReviewGateArtifact,
  PatchProposalArtifact,
  RollbackCheckpointArtifact,
} from '../../../shared/development-artifact-types';
import { buildPatchReviewViewModel, type ReviewTone } from '../../utils/patch-review-view-model';
import { RollbackCheckpointCard } from './RollbackCheckpointCard';

type ReviewActionPayload = {
  patchProposalId: string;
  expectedDiffSha256: string;
};

type ApplyActionPayload = {
  patchProposalId: string;
  humanReviewGateId: string;
  approvedDiffSha256: string;
};

export interface PatchReviewPanelProps {
  patchProposalId: string;
  proposal: PatchProposalArtifact;
  humanReviewGate?: HumanReviewGateArtifact | null;
  humanReviewGateId?: string;
  rollbackCheckpoint?: RollbackCheckpointArtifact | null;
  now?: Date;
  onApprove?: (payload: ReviewActionPayload) => void;
  onReject?: (payload: ReviewActionPayload) => void;
  onApplyApprovedPatch?: (payload: ApplyActionPayload) => void;
}

const TONE_CLASSES: Record<ReviewTone, string> = {
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  danger: 'border-error/25 bg-error/10 text-error',
  muted: 'border-border bg-surface-muted text-text-muted',
  accent: 'border-accent/25 bg-accent/10 text-accent',
};

function TonePill({ tone, children }: { tone: ReviewTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border-muted bg-background/60 p-3">
      <p className="text-[11px] uppercase tracking-[0.1em] text-text-muted">{label}</p>
      <p className={`mt-1 truncate text-xs text-text-primary ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function SecretFindingList({
  findings,
}: {
  findings: PatchProposalArtifact['secretScan']['findings'];
}) {
  if (findings.length === 0) {
    return (
      <p className="rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-xs text-success">
        No token-like values found in the proposed diff.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {findings.map((finding) => (
        <div
          key={`${finding.fingerprint}-${finding.line || 0}`}
          className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <TonePill tone={finding.severity === 'blocker' ? 'danger' : 'warning'}>
              {finding.severity}
            </TonePill>
            <span className="text-xs font-medium text-text-primary">{finding.type}</span>
            {finding.line && (
              <span className="font-mono text-[11px] text-text-muted">line {finding.line}</span>
            )}
          </div>
          <p className="mt-1 font-mono text-[11px] text-text-muted">{finding.fingerprint}</p>
        </div>
      ))}
    </div>
  );
}

export function PatchReviewPanel({
  patchProposalId,
  proposal,
  humanReviewGate,
  humanReviewGateId,
  rollbackCheckpoint,
  now,
  onApprove,
  onReject,
  onApplyApprovedPatch,
}: PatchReviewPanelProps) {
  const model = buildPatchReviewViewModel({
    patchProposalId,
    proposal,
    humanReviewGate,
    humanReviewGateId,
    rollbackCheckpoint,
    now,
  });

  const reviewPayload: ReviewActionPayload = {
    patchProposalId,
    expectedDiffSha256: proposal.diffSha256,
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-text-muted">
            <GitPullRequest className="h-3.5 w-3.5" />
            Human review gate
          </div>
          <h3 className="mt-1 truncate text-base font-semibold text-text-primary">{model.title}</h3>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            Approval is bound to the exact diff hash before apply can be enabled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TonePill tone={model.secretScan.tone}>
            {model.secretScan.tone === 'danger' ? (
              <ShieldAlert className="h-3 w-3" />
            ) : (
              <ShieldCheck className="h-3 w-3" />
            )}
            {model.secretScan.label}
          </TonePill>
          <TonePill tone={model.gate.tone}>
            {model.gate.isValidApproval ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {model.gate.label}
          </TonePill>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <StatCard label="Files" value={model.changedFileCount} />
        <StatCard label="Base" value={model.baseCommitShort} mono />
        <StatCard label="Diff SHA" value={model.diffShaShort} mono />
        <StatCard label="State" value={model.reviewState} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border-muted bg-surface p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-primary">
              <FileCode2 className="h-3.5 w-3.5 text-accent" />
              Changed files
            </div>
            <div className="space-y-1">
              {model.changedFiles.map((file) => (
                <div
                  key={file}
                  className="truncate rounded-md border border-border-muted bg-background/70 px-2 py-1 font-mono text-[11px] text-text-secondary"
                  title={file}
                >
                  {file}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border-muted bg-surface p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-primary">
              <ShieldAlert className="h-3.5 w-3.5 text-warning" />
              Secret scan
            </div>
            <SecretFindingList findings={model.secretScan.findings} />
          </div>
        </div>

        <aside className="space-y-3 rounded-xl border border-border-muted bg-surface p-3">
          <div>
            <p className="text-xs font-semibold text-text-primary">Approval gate</p>
            <p className="mt-1 text-xs leading-5 text-text-muted">{model.gate.reason}</p>
            {model.gate.expiresAt && (
              <p className="mt-2 font-mono text-[11px] text-text-muted">
                expires: {model.gate.expiresAt}
              </p>
            )}
          </div>

          <div className="space-y-2 border-t border-border-muted pt-3">
            <button
              type="button"
              disabled={!model.actions.canApprove || !onApprove}
              onClick={() => onApprove?.(reviewPayload)}
              className="w-full rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve exact diff
            </button>
            <button
              type="button"
              disabled={!model.actions.canReject || !onReject}
              onClick={() => onReject?.(reviewPayload)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reject proposal
            </button>
            <button
              type="button"
              disabled={!model.actions.canApply || !onApplyApprovedPatch || !humanReviewGateId}
              onClick={() => {
                if (!model.actions.canApply || !humanReviewGateId) return;
                onApplyApprovedPatch?.({
                  patchProposalId,
                  humanReviewGateId,
                  approvedDiffSha256: proposal.diffSha256,
                });
              }}
              title={model.actions.applyDisabledReason}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success transition-colors hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Apply approved patch
            </button>
            {!model.actions.canApply && (
              <p className="text-[11px] leading-4 text-text-muted">
                {model.actions.applyDisabledReason}
              </p>
            )}
          </div>
        </aside>
      </div>

      {rollbackCheckpoint && <RollbackCheckpointCard checkpoint={rollbackCheckpoint} />}

      <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-[11px] leading-5 text-text-muted">
        <strong className="text-accent">Safety:</strong> This panel does not apply patches by
        itself. Apply must remain bound to an approved human review gate, the exact diff hash, and a
        rollback checkpoint.
      </div>
    </section>
  );
}
