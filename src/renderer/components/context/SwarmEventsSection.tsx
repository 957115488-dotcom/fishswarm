import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Loader2,
  MessageSquareText,
} from 'lucide-react';
import type { SwarmEvent, SwarmEventType } from '../../../shared/ipc-types';
import { localizeRoleText, localizeSpeakerName } from '../../utils/role-localization';

interface SwarmEventsSectionProps {
  events: SwarmEvent[];
  sessionId?: string | null;
}

const TYPE_LABELS: Record<SwarmEventType, string> = {
  'user.input': 'context.swarmEventType.userInput',
  'xiaoyu.intent': 'context.swarmEventType.xiaoyuIntent',
  'xiaoyu.dispatch': 'context.swarmEventType.xiaoyuDispatch',
  'role.online': 'context.swarmEventType.roleOnline',
  'role.plan': 'context.swarmEventType.rolePlan',
  'role.thinking': 'context.swarmEventType.roleThinking',
  'role.tool': 'context.swarmEventType.roleTool',
  'role.delivery': 'context.swarmEventType.roleDelivery',
  'validation.started': 'context.swarmEventType.validationStarted',
  'validation.accepted': 'context.swarmEventType.validationAccepted',
  'validation.needs_revision': 'context.swarmEventType.validationNeedsRevision',
  'validation.blocked': 'context.swarmEventType.validationBlocked',
  'xiaoyu.rework': 'context.swarmEventType.xiaoyuRework',
  'xiaoyu.pause': 'context.swarmEventType.xiaoyuPause',
  'xiaoyu.next_role': 'context.swarmEventType.xiaoyuNextRole',
  'xiaoyu.final': 'context.swarmEventType.xiaoyuFinal',
};

const TYPE_FALLBACKS: Record<SwarmEventType, string> = {
  'user.input': 'User input',
  'xiaoyu.intent': 'Xiaoyu intent',
  'xiaoyu.dispatch': 'Xiaoyu dispatch',
  'role.online': 'Role online',
  'role.plan': 'Role plan',
  'role.thinking': 'Role thinking',
  'role.tool': 'Role tool',
  'role.delivery': 'Role delivery',
  'validation.started': 'Validation started',
  'validation.accepted': 'Validation accepted',
  'validation.needs_revision': 'Validation needs revision',
  'validation.blocked': 'Validation blocked',
  'xiaoyu.rework': 'Xiaoyu rework',
  'xiaoyu.pause': 'Xiaoyu pause',
  'xiaoyu.next_role': 'Xiaoyu next role',
  'xiaoyu.final': 'Xiaoyu final',
};

function eventIcon(event: SwarmEvent) {
  if (event.status === 'running' || event.status === 'pending') return Loader2;
  if (event.status === 'completed') return CheckCircle2;
  if (
    event.status === 'blocked' ||
    event.status === 'failed' ||
    event.status === 'needs_revision'
  ) {
    return AlertTriangle;
  }
  if (event.type.startsWith('xiaoyu.')) return GitBranch;
  return MessageSquareText;
}

function eventClass(event: SwarmEvent): string {
  if (event.status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (event.status === 'needs_revision') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (event.status === 'blocked' || event.status === 'failed') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-border-muted bg-background-secondary text-text-secondary';
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function SwarmEventsSection({ events, sessionId }: SwarmEventsSectionProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const language = i18n.resolvedLanguage || i18n.language;
  const visibleEvents = useMemo(
    () =>
      [...events]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
    [events]
  );
  const latestEvent = visibleEvents[0];

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
            {t('context.swarmEvents', 'Swarm Events')}
          </span>
          {events.length > 0 && (
            <span className="rounded-full border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] leading-none text-text-muted">
              {events.length}
            </span>
          )}
        </span>
        <span className="ml-2 flex min-w-0 items-center gap-1.5">
          {latestEvent && (
            <span className="max-w-28 truncate text-[11px] font-normal normal-case tracking-normal text-text-muted">
              {localizeSpeakerName(latestEvent.speaker, language)} ·{' '}
              {t(TYPE_LABELS[latestEvent.type], TYPE_FALLBACKS[latestEvent.type])}
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
              <GitBranch className="w-3.5 h-3.5 shrink-0" />
              <span>{t('context.noSwarmEventsYet', 'No swarm events yet')}</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleEvents.map((event) => {
                const Icon = eventIcon(event);
                const label = t(TYPE_LABELS[event.type], TYPE_FALLBACKS[event.type]);
                const content = localizeRoleText(event.content, language);
                const speaker = localizeSpeakerName(event.speaker, language);
                const spinning = event.status === 'running' || event.status === 'pending';
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
                            {speaker}
                          </span>
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] ${eventClass(event)}`}
                          >
                            {label}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-text-muted">
                          {content}
                        </p>
                        <p className="mt-1 text-[10px] text-text-muted">
                          {formatTime(event.createdAt)} · {event.runId.slice(0, 8)}
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
