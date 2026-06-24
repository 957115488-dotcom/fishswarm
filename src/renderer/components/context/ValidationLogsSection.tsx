import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ShieldAlert,
} from 'lucide-react';
import type { ValidationLog } from '../../../shared/ipc-types';
import { getLocalizedRoleName, localizeRoleText } from '../../utils/role-localization';

interface AcceptanceFallback {
  messageId: string;
  timestamp: number;
  content: string;
}

interface ValidationLogsSectionProps {
  logs: ValidationLog[];
  fallbackAcceptance?: AcceptanceFallback | null;
  open: boolean;
  onToggle: () => void;
}

function verdictLabel(verdict: ValidationLog['verdict']): { key: string; fallback: string } {
  if (verdict === 'passed') return { key: 'context.validationPassed', fallback: 'Passed' };
  if (verdict === 'blocked') {
    return { key: 'context.validationBlocked', fallback: 'External input needed' };
  }
  return { key: 'context.validationNeedsRevision', fallback: 'Needs revision' };
}

function verdictClass(verdict: ValidationLog['verdict']): string {
  if (verdict === 'passed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (verdict === 'blocked') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function verdictIcon(verdict: ValidationLog['verdict']) {
  if (verdict === 'passed') return CheckCircle2;
  if (verdict === 'blocked') return ShieldAlert;
  return AlertTriangle;
}

function verdictHintKey(verdict: ValidationLog['verdict']): { key: string; fallback: string } {
  if (verdict === 'passed') {
    return { key: 'context.validationPassedHint', fallback: 'This handoff can continue.' };
  }
  if (verdict === 'blocked') {
    return {
      key: 'context.validationBlockedHint',
      fallback:
        'The workflow is paused until user input, tool permission, credentials, or an external condition is available.',
    };
  }
  return {
    key: 'context.validationNeedsRevisionHint',
    fallback:
      'The handoff was returned to the same role for revision before the next role can continue.',
  };
}

function reworkLabelKey(verdict: ValidationLog['verdict']): { key: string; fallback: string } {
  if (verdict === 'blocked') {
    return { key: 'context.requiredUnblock', fallback: 'Required unblock items' };
  }
  return { key: 'context.requiredRework', fallback: 'Required rework' };
}

function formatTime(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export function ValidationLogsSection({
  logs,
  fallbackAcceptance,
  open,
  onToggle,
}: ValidationLogsSectionProps) {
  const { t, i18n } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const language = i18n.resolvedLanguage || i18n.language;
  const sortedLogs = useMemo(
    () =>
      [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [logs]
  );
  const validationCount = sortedLogs.length || (fallbackAcceptance ? 1 : 0);

  return (
    <div className="border-b border-border-muted">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-surface-hover transition-colors"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
            {t('context.acceptance')}
          </span>
          {validationCount > 0 && (
            <span className="rounded-full border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] leading-none text-text-muted">
              {validationCount}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 shrink-0 text-text-muted" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-text-muted" />
        )}
      </button>

      {open && (
        <div className="pb-2">
          {sortedLogs.length > 0 ? (
            <div className="mx-4 space-y-1.5">
              {sortedLogs.map((log) => {
                const Icon = verdictIcon(log.verdict);
                const label = verdictLabel(log.verdict);
                const hint = verdictHintKey(log.verdict);
                const reworkLabel = reworkLabelKey(log.verdict);
                const expanded = expandedId === log.validationId;
                const validatorRoleName = getLocalizedRoleName(
                  log.validatorRoleId,
                  log.validatorRoleName,
                  language
                );
                const summary = localizeRoleText(log.summary, language);
                return (
                  <div
                    key={log.validationId}
                    className="rounded-lg border border-border-subtle bg-surface/80 p-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : log.validationId)}
                      className="flex w-full items-start gap-2 text-left"
                    >
                      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-medium text-text-primary">
                            {validatorRoleName}
                          </span>
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] ${verdictClass(log.verdict)}`}
                          >
                            {t(label.key, label.fallback)}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {log.taskId.slice(0, 8)}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-text-muted">
                          {summary}
                        </p>
                        <p className="mt-1 text-[10px] text-text-muted">
                          {log.acceptedFindings.length} {t('context.acceptedFindings', 'accepted')}{' '}
                          · {log.requiredRework.length} {t(reworkLabel.key, reworkLabel.fallback)} ·{' '}
                          {formatTime(log.createdAt)}
                        </p>
                      </div>
                      {expanded ? (
                        <ChevronUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
                      ) : (
                        <ChevronDown className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
                      )}
                    </button>

                    {expanded && (
                      <div className="mt-2 space-y-2 rounded-md bg-background/60 px-2.5 py-2 text-[11px] leading-4 text-text-secondary">
                        <p className="text-text-muted">{t(hint.key, hint.fallback)}</p>
                        {log.acceptedFindings.length > 0 && (
                          <div>
                            <p className="font-medium text-text-primary">
                              {t('context.acceptedFindings', 'Accepted findings')}
                            </p>
                            <ul className="mt-1 list-disc space-y-1 pl-4">
                              {log.acceptedFindings.map((item, index) => (
                                <li key={`${log.validationId}-accepted-${index}`}>
                                  {localizeRoleText(item, language)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {log.requiredRework.length > 0 && (
                          <div>
                            <p className="font-medium text-text-primary">
                              {t(reworkLabel.key, reworkLabel.fallback)}
                            </p>
                            <ul className="mt-1 list-disc space-y-1 pl-4">
                              {log.requiredRework.map((item, index) => (
                                <li key={`${log.validationId}-rework-${index}`}>
                                  {localizeRoleText(item, language)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {log.checkedRoleRunIds.length > 0 && (
                          <p className="text-text-muted">
                            {t('context.checkedRuns', 'Checked runs')}:{' '}
                            {log.checkedRoleRunIds.map((id) => id.slice(0, 8)).join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : fallbackAcceptance ? (
            <div className="mx-4 rounded-lg border border-border-subtle bg-surface/80 p-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-text-primary">
                <ClipboardCheck className="w-3.5 h-3.5 shrink-0 text-accent" />
                <span>{t('context.acceptancePending')}</span>
              </div>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md bg-background/60 px-2.5 py-2 text-[11px] leading-4 text-text-secondary whitespace-pre-wrap">
                {fallbackAcceptance.content}
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-text-muted">
                {t('context.acceptanceFromAi')} · {formatTime(fallbackAcceptance.timestamp)}
              </p>
            </div>
          ) : (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{t('context.noAcceptanceYet')}</span>
              </div>
              <p className="mt-1 pl-5 text-[11px] leading-4 text-text-muted">
                {t('context.acceptanceHint')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
