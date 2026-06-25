import { CheckCircle2, CircleDashed, ShieldCheck, TimerReset } from 'lucide-react';
import type {
  AgentTaskBoardArtifact,
  AgentTaskBoardTask,
  AgentTaskBoardTaskStatus,
} from '../../../shared/development-artifact-types';

const STATUS_LABELS: Record<AgentTaskBoardTaskStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  blocked: 'Blocked',
  ready_for_review: 'Ready for review',
  approved: 'Approved',
  done: 'Done',
  failed: 'Failed',
};

function statusTone(status: AgentTaskBoardTaskStatus): string {
  if (status === 'done' || status === 'approved') return 'text-success bg-success/10';
  if (status === 'blocked' || status === 'failed') return 'text-error bg-error/10';
  if (status === 'ready_for_review') return 'text-warning bg-warning/10';
  return 'text-text-secondary bg-surface-muted';
}

function WorkboardMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function TaskRow({ task }: { task: AgentTaskBoardTask }) {
  return (
    <li className="rounded-lg border border-border-muted bg-background/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">
              {task.description}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(
            task.status
          )}`}
        >
          {STATUS_LABELS[task.status]}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
        {task.roleRefs.length > 0 && <span>{task.roleRefs.length} roles</span>}
        {task.assetRefs.length > 0 && <span>{task.assetRefs.length} assets</span>}
        {task.artifactRefs.length > 0 && <span>{task.artifactRefs.length} artifacts</span>}
        {task.approvalRefs.length > 0 && <span>{task.approvalRefs.length} approvals</span>}
      </div>
    </li>
  );
}

export function AgentWorkboardSection({ board }: { board: AgentTaskBoardArtifact | null }) {
  if (!board) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <CircleDashed className="h-4 w-4 text-text-muted" />
          Agent Workboard
        </div>
        <p className="mt-2 text-xs leading-5 text-text-muted">
          No active workboard yet. Select assets and roles to create a reviewed task board.
        </p>
      </section>
    );
  }

  const completedCount = board.tasks.filter((task) =>
    ['done', 'approved'].includes(task.status)
  ).length;
  const blockedCount = board.tasks.filter((task) =>
    ['blocked', 'failed'].includes(task.status)
  ).length;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Agent Workboard
          </div>
          <h3 className="mt-2 text-base font-semibold text-text-primary">{board.title}</h3>
          <p className="mt-1 text-xs leading-5 text-text-muted">{board.goal}</p>
        </div>
        <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
          {board.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <WorkboardMetric label="Tasks" value={board.tasks.length} />
        <WorkboardMetric label="Done" value={completedCount} />
        <WorkboardMetric label="Blocked" value={blockedCount} />
        <WorkboardMetric label="Approvals" value={board.approvalRefs.length} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {board.assetRefs.length} assets
        </span>
        <span>{board.roleRefs.length} roles</span>
        <span>{board.artifactRefs.length} artifacts</span>
        <span className="inline-flex items-center gap-1">
          <TimerReset className="h-3.5 w-3.5" />
          Updated {board.updatedAt}
        </span>
      </div>

      {board.tasks.length > 0 && (
        <ul className="mt-4 space-y-2">
          {board.tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}
