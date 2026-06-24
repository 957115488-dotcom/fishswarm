import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  UsersRound,
} from 'lucide-react';
import type { RoleLifecycleEvent } from '../../../shared/ipc-types';
import { getLocalizedRoleName, localizeRoleText } from '../../utils/role-localization';

interface RoleActivitySectionProps {
  events: RoleLifecycleEvent[];
  sessionId?: string | null;
}

const STATUS_LABELS: Record<RoleLifecycleEvent['status'], string> = {
  gap_detected: 'context.roleStatus.gapDetected',
  incubating_role: 'context.roleStatus.incubatingRole',
  candidate_ready: 'context.roleStatus.candidateReady',
  candidate_blocked: 'context.roleStatus.candidateBlocked',
  approval_required: 'context.roleStatus.approvalRequired',
  queued: 'context.roleStatus.queued',
  mounting_handbook: 'context.roleStatus.mountingHandbook',
  online: 'context.roleStatus.online',
  working: 'context.roleStatus.working',
  returned: 'context.roleStatus.returned',
  validating: 'context.roleStatus.validating',
  accepted: 'context.roleStatus.accepted',
  needs_revision: 'context.roleStatus.needsRevision',
  blocked: 'context.roleStatus.blocked',
  skipped: 'context.roleStatus.skipped',
  failed: 'context.roleStatus.failed',
};

const STATUS_FALLBACKS: Record<RoleLifecycleEvent['status'], string> = {
  gap_detected: 'Gap detected',
  incubating_role: 'Incubating role',
  candidate_ready: 'Candidate ready',
  candidate_blocked: 'Candidate blocked',
  approval_required: 'Approval required',
  queued: 'Queued',
  mounting_handbook: 'Mounting handbook',
  online: 'Online',
  working: 'Working',
  returned: 'Returned',
  validating: 'Validating',
  accepted: 'Accepted',
  needs_revision: 'Needs revision',
  blocked: 'External input needed',
  skipped: 'Skipped',
  failed: 'Failed',
};

function statusIcon(status: RoleLifecycleEvent['status']) {
  if (status === 'gap_detected' || status === 'approval_required') return AlertTriangle;
  if (status === 'incubating_role') return Loader2;
  if (status === 'candidate_ready') return CheckCircle2;
  if (status === 'candidate_blocked') return AlertTriangle;
  if (status === 'mounting_handbook') return BookOpen;
  if (status === 'failed' || status === 'needs_revision' || status === 'blocked') {
    return AlertTriangle;
  }
  if (status === 'returned' || status === 'accepted') return CheckCircle2;
  if (status === 'working' || status === 'validating') return Loader2;
  return UsersRound;
}

function statusClass(status: RoleLifecycleEvent['status']): string {
  if (
    status === 'failed' ||
    status === 'needs_revision' ||
    status === 'blocked' ||
    status === 'candidate_blocked'
  ) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (status === 'approval_required' || status === 'gap_detected') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (status === 'returned' || status === 'accepted' || status === 'candidate_ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border-border-muted bg-background-secondary text-text-secondary';
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RoleActivitySection({ events, sessionId }: RoleActivitySectionProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const language = i18n.resolvedLanguage || i18n.language;
  const visibleEvents = useMemo(
    () =>
      [...events].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 8),
    [events]
  );
  const roleCount = useMemo(
    () => new Set(events.map((event) => event.roleId || event.roleName)).size,
    [events]
  );
  const latestEvent = visibleEvents[0];
  const latestStatus = latestEvent
    ? t(STATUS_LABELS[latestEvent.status], STATUS_FALLBACKS[latestEvent.status])
    : '';
  const latestRoleName = latestEvent
    ? getLocalizedRoleName(latestEvent.roleId, latestEvent.roleName, language)
    : '';

  useEffect(() => {
    setOpen(false);
  }, [sessionId]);

  return (
    <div className="border-b border-border-muted">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-surface-hover transition-colors"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
            {t('context.roleActivity', 'Role Activity')}
          </span>
          {roleCount > 0 && (
            <span className="rounded-full border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] leading-none text-text-muted">
              {roleCount}
            </span>
          )}
        </span>
        <span className="ml-2 flex min-w-0 items-center gap-1.5">
          {latestEvent && (
            <span className="max-w-28 truncate text-[11px] font-normal normal-case tracking-normal text-text-muted">
              {latestRoleName} · {latestStatus}
            </span>
          )}
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 shrink-0 text-text-muted" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-text-muted" />
          )}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-2">
          {visibleEvents.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-text-muted py-1">
              <UsersRound className="w-3.5 h-3.5 shrink-0" />
              <span>{t('context.noRoleActivityYet', 'No role activity yet')}</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleEvents.map((event) => {
                const Icon = statusIcon(event.status);
                const roleName = getLocalizedRoleName(event.roleId, event.roleName, language);
                const summary = localizeRoleText(event.summary, language);
                const spinning =
                  event.status === 'working' ||
                  event.status === 'validating' ||
                  event.status === 'incubating_role';
                return (
                  <div
                    key={event.id}
                    className="rounded-md border border-border-subtle bg-surface/80 px-2.5 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <Icon
                        className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-text-muted ${spinning ? 'animate-spin' : ''}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-xs font-medium text-text-primary">
                            {roleName}
                          </span>
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] ${statusClass(event.status)}`}
                          >
                            {t(STATUS_LABELS[event.status], STATUS_FALLBACKS[event.status])}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-text-muted">
                          {summary}
                        </p>
                        <p className="mt-1 text-[10px] text-text-muted">
                          {formatTime(event.ts)} · {event.taskId.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
