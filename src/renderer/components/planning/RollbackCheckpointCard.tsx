import { RotateCcw, ShieldCheck } from 'lucide-react';
import type { RollbackCheckpointArtifact } from '../../../shared/development-artifact-types';
import { buildRollbackCheckpointViewModel } from '../../utils/patch-review-view-model';

function CompactList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-text-muted">{empty}</p>;
  }

  return (
    <div className="space-y-1">
      {items.slice(0, 6).map((item) => (
        <div
          key={item}
          className="truncate rounded-md border border-border-muted bg-background/70 px-2 py-1 font-mono text-[11px] text-text-secondary"
          title={item}
        >
          {item}
        </div>
      ))}
      {items.length > 6 && (
        <p className="text-[11px] text-text-muted">+{items.length - 6} more files</p>
      )}
    </div>
  );
}

export function RollbackCheckpointCard({ checkpoint }: { checkpoint: RollbackCheckpointArtifact }) {
  const model = buildRollbackCheckpointViewModel(checkpoint);

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
            <RotateCcw className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-primary">{model.title}</h4>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              Created before apply so the patch can be audited and rolled back.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
          <ShieldCheck className="h-3 w-3" />
          checkpoint
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border-muted bg-background/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-muted">Base HEAD</p>
          <p className="mt-1 font-mono text-xs text-text-primary">{model.baseHeadShort}</p>
        </div>
        <div className="rounded-lg border border-border-muted bg-background/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-muted">Dirty diff</p>
          <p className="mt-1 font-mono text-xs text-text-primary">{model.dirtyDiffShaShort}</p>
        </div>
        <div className="rounded-lg border border-border-muted bg-background/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-muted">Tracked files</p>
          <p className="mt-1 text-xs text-text-primary">{model.targetFileCount}</p>
        </div>
        <div className="rounded-lg border border-border-muted bg-background/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-muted">Untracked</p>
          <p className="mt-1 text-xs text-text-primary">{model.untrackedCount}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium text-text-secondary">Target file hashes</p>
          <CompactList items={model.targetFiles} empty="No target file hashes captured." />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-text-secondary">Untracked manifest</p>
          <CompactList items={model.untrackedFiles} empty="No untracked files captured." />
        </div>
      </div>

      <p
        className="mt-3 truncate font-mono text-[11px] text-text-muted"
        title={model.checkpointRef}
      >
        {model.checkpointRef}
      </p>
    </section>
  );
}
