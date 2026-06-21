import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  RotateCcw,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import type {
  ActiveDecision,
  DecisionScope,
  DecisionStoreSnapshot,
  QuestionDefinition,
  QuestionPolicySnapshot,
  QuestionPreference,
} from '../../../shared/ipc-types';
import { SettingsContentSection } from './shared';

const PREF_OPTIONS: Array<{ value: QuestionPreference; label: string }> = [
  { value: 'always-ask', label: 'Always ask' },
  { value: 'ask-only-for-one-way', label: 'Ask one-way only' },
  { value: 'never-ask', label: 'Never ask' },
];

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export function SettingsWorkHabits() {
  const { t } = useTranslation();
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sessions = useAppStore((state) => state.sessions);
  const workingDir = useAppStore((state) => state.workingDir);
  const currentSession = sessions.find((session) => session.id === activeSessionId);
  const currentWorkspace = currentSession?.cwd || workingDir || '';

  const [policy, setPolicy] = useState<QuestionPolicySnapshot | null>(null);
  const [decisions, setDecisions] = useState<DecisionStoreSnapshot | null>(null);
  const [draftPrefs, setDraftPrefs] = useState<Record<string, QuestionPreference>>({});
  const [decisionText, setDecisionText] = useState('');
  const [rationale, setRationale] = useState('');
  const [scope, setScope] = useState<DecisionScope>('repo');
  const [confidence, setConfidence] = useState(7);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preferencesById = useMemo(() => {
    const map = new Map(policy?.preferences.map((item) => [item.questionId, item]) || []);
    return map;
  }, [policy]);

  async function refresh() {
    setBusy(true);
    setStatus(null);
    try {
      const [nextPolicy, nextDecisions] = await Promise.all([
        window.electronAPI.questionPolicy.snapshot(currentWorkspace || undefined),
        window.electronAPI.decisions.snapshot(currentWorkspace || undefined),
      ]);
      setPolicy(nextPolicy);
      setDecisions(nextDecisions);
      setDraftPrefs(
        Object.fromEntries(
          nextPolicy.registry.map((item) => [
            item.id,
            nextPolicy.preferences.find((pref) => pref.questionId === item.id)?.preference ||
              'always-ask',
          ])
        )
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function savePreference(definition: QuestionDefinition) {
    setBusy(true);
    setStatus(null);
    try {
      const preference = draftPrefs[definition.id] || 'always-ask';
      await window.electronAPI.questionPolicy.setPreference({
        cwd: currentWorkspace || undefined,
        questionId: definition.id,
        preference,
        source: 'settings',
      });
      setStatus(`Saved ${definition.id}`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  async function clearPreference(questionId: string) {
    setBusy(true);
    setStatus(null);
    try {
      await window.electronAPI.questionPolicy.clearPreference({
        cwd: currentWorkspace || undefined,
        questionId,
      });
      setStatus(`Cleared ${questionId}`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  async function addDecision() {
    const decision = decisionText.trim();
    if (!decision) return;
    setBusy(true);
    setStatus(null);
    try {
      await window.electronAPI.decisions.add({
        cwd: currentWorkspace || undefined,
        decision,
        rationale: rationale.trim() || undefined,
        scope,
        source: 'user',
        confidence,
      });
      setDecisionText('');
      setRationale('');
      setStatus(t('workHabits.decisionSaved', 'Decision saved'));
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  async function retireDecision(decision: ActiveDecision, action: 'supersede' | 'redact') {
    setBusy(true);
    setStatus(null);
    try {
      if (action === 'supersede') {
        await window.electronAPI.decisions.supersede({
          cwd: currentWorkspace || undefined,
          id: decision.id,
        });
      } else {
        await window.electronAPI.decisions.redact({
          cwd: currentWorkspace || undefined,
          id: decision.id,
        });
      }
      setStatus(`${action}: ${decision.id.slice(0, 8)}`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace]);

  return (
    <div className="space-y-1">
      <SettingsContentSection
        title={t('workHabits.title', 'Work Habits')}
        description={t('workHabits.description', 'Question preferences and project decisions')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-border-muted px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-60"
          >
            <RotateCcw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {t('common.refresh', 'Refresh')}
          </button>
          {currentWorkspace && (
            <span className="min-w-0 truncate rounded-md bg-background-secondary px-2.5 py-1.5 text-xs text-text-muted">
              {currentWorkspace}
            </span>
          )}
        </div>
        {status && (
          <div className="rounded-md border border-border-muted bg-background-secondary px-3 py-2 text-sm text-text-secondary">
            {status}
          </div>
        )}
      </SettingsContentSection>

      <SettingsContentSection title={t('workHabits.questionPolicy', 'Question Policy')}>
        <div className="grid gap-2">
          {(policy?.registry || []).map((definition) => {
            const saved = preferencesById.get(definition.id);
            const selected = draftPrefs[definition.id] || saved?.preference || 'always-ask';
            return (
              <div key={definition.id} className="rounded-md border border-border-muted bg-background p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 flex-shrink-0 text-text-muted" />
                      <span className="truncate text-sm font-medium text-text-primary">
                        {definition.label}
                      </span>
                      {definition.doorType === 'one-way' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                          <ShieldAlert className="h-3 w-3" />
                          one-way
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-text-muted">{definition.id}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <select
                      value={selected}
                      onChange={(event) =>
                        setDraftPrefs((prev) => ({
                          ...prev,
                          [definition.id]: event.target.value as QuestionPreference,
                        }))
                      }
                      className="h-9 rounded-md border border-border-muted bg-background-secondary px-2 text-xs text-text-primary outline-none focus:border-accent"
                    >
                      {PREF_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      title="Save preference"
                      onClick={() => savePreference(definition)}
                      disabled={busy}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-muted text-text-secondary hover:bg-surface-hover disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Clear preference"
                      onClick={() => clearPreference(definition.id)}
                      disabled={busy || !saved}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-muted text-text-secondary hover:bg-surface-hover disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsContentSection>

      <SettingsContentSection title={t('workHabits.decisions', 'Decisions')}>
        <div className="rounded-md border border-border-muted bg-background p-3">
          <div className="grid gap-3">
            <input
              value={decisionText}
              onChange={(event) => setDecisionText(event.target.value)}
              placeholder={t('workHabits.decisionPlaceholder', 'Decision')}
              className="rounded-md border border-border-muted bg-background-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
            <input
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder={t('workHabits.rationalePlaceholder', 'Rationale')}
              className="rounded-md border border-border-muted bg-background-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as DecisionScope)}
                className="h-9 rounded-md border border-border-muted bg-background-secondary px-2 text-xs text-text-primary outline-none focus:border-accent"
              >
                <option value="repo">repo</option>
                <option value="branch">branch</option>
                <option value="issue">issue</option>
              </select>
              <input
                type="number"
                min={1}
                max={10}
                value={confidence}
                onChange={(event) => setConfidence(Number(event.target.value))}
                className="h-9 w-20 rounded-md border border-border-muted bg-background-secondary px-2 text-xs text-text-primary outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={addDecision}
                disabled={busy || !decisionText.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          {(decisions?.active || []).map((decision) => (
            <div key={decision.id} className="rounded-md border border-border-muted bg-background p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{decision.decision}</span>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-text-primary">
                      {decision.scope}
                    </span>
                    <span className="text-xs text-text-muted">{decision.confidence || 7}/10</span>
                  </div>
                  {decision.rationale && (
                    <p className="mt-2 text-xs leading-5 text-text-muted">{decision.rationale}</p>
                  )}
                  <p className="mt-2 text-[11px] text-text-muted">{formatTime(decision.date)}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title="Supersede decision"
                    onClick={() => retireDecision(decision, 'supersede')}
                    disabled={busy}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-muted text-text-secondary hover:bg-surface-hover disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Redact decision"
                    onClick={() => retireDecision(decision, 'redact')}
                    disabled={busy}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {(decisions?.active || []).length === 0 && (
            <div className="rounded-md border border-dashed border-border-muted p-4 text-sm text-text-muted">
              {t('workHabits.noDecisions', 'No active decisions')}
            </div>
          )}
        </div>
      </SettingsContentSection>
    </div>
  );
}
