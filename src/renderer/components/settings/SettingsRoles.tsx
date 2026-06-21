import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Eye,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  UsersRound,
  XCircle,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import type {
  RoleDefinition,
  RoleCandidate,
  RoleCandidateSnapshot,
  RoleHandbook,
  RoleRegistrySnapshot,
  RoleRunMode,
  RoleTriggerMode,
} from '../../../shared/ipc-types';
import { SettingsContentSection } from './shared';

type HandbookListKey = Exclude<keyof RoleHandbook, 'identity'>;

const TRIGGER_MODES: Array<{ value: RoleTriggerMode; labelKey: string; fallback: string }> = [
  { value: 'automatic', labelKey: 'roles.triggerAutomatic', fallback: 'Automatic' },
  { value: 'manual', labelKey: 'roles.triggerManual', fallback: 'Manual' },
  { value: 'disabled', labelKey: 'roles.triggerDisabled', fallback: 'Disabled' },
];

const RUN_MODES: Array<{ value: RoleRunMode; labelKey: string; fallback: string }> = [
  { value: 'lite', labelKey: 'roles.runLite', fallback: 'Lite' },
  { value: 'review', labelKey: 'roles.runReview', fallback: 'Review' },
  { value: 'validation', labelKey: 'roles.runValidation', fallback: 'Validation' },
];

const HANDBOOK_FIELDS: Array<{
  key: HandbookListKey;
  labelKey: string;
  fallback: string;
  rows: number;
}> = [
  {
    key: 'responsibilities',
    labelKey: 'roles.responsibilities',
    fallback: 'Responsibilities',
    rows: 5,
  },
  { key: 'boundaries', labelKey: 'roles.boundaries', fallback: 'Boundaries', rows: 4 },
  {
    key: 'inputRequirements',
    labelKey: 'roles.inputRequirements',
    fallback: 'Input requirements',
    rows: 4,
  },
  { key: 'outputFormat', labelKey: 'roles.outputFormat', fallback: 'Output format', rows: 4 },
  {
    key: 'completionCriteria',
    labelKey: 'roles.completionCriteria',
    fallback: 'Completion criteria',
    rows: 4,
  },
  {
    key: 'validationCriteria',
    labelKey: 'roles.validationCriteria',
    fallback: 'Validation criteria',
    rows: 4,
  },
  { key: 'safetyRules', labelKey: 'roles.safetyRules', fallback: 'Safety rules', rows: 4 },
  {
    key: 'decisionAuthority',
    labelKey: 'roles.decisionAuthority',
    fallback: 'Decision authority',
    rows: 4,
  },
];

function cloneRole(role: RoleDefinition): RoleDefinition {
  return {
    ...role,
    triggerScopes: [...role.triggerScopes],
    triggerKeywords: [...role.triggerKeywords],
    handbook: {
      identity: role.handbook.identity,
      responsibilities: [...role.handbook.responsibilities],
      boundaries: [...role.handbook.boundaries],
      inputRequirements: [...role.handbook.inputRequirements],
      outputFormat: [...role.handbook.outputFormat],
      completionCriteria: [...role.handbook.completionCriteria],
      validationCriteria: [...role.handbook.validationCriteria],
      safetyRules: [...role.handbook.safetyRules],
      decisionAuthority: [...role.handbook.decisionAuthority],
    },
    locales: role.locales
      ? {
          en: role.locales.en
            ? {
                ...role.locales.en,
                triggerKeywords: role.locales.en.triggerKeywords
                  ? [...role.locales.en.triggerKeywords]
                  : undefined,
                handbook: role.locales.en.handbook
                  ? clonePartialHandbook(role.locales.en.handbook)
                  : undefined,
              }
            : undefined,
          zh: role.locales.zh
            ? {
                ...role.locales.zh,
                triggerKeywords: role.locales.zh.triggerKeywords
                  ? [...role.locales.zh.triggerKeywords]
                  : undefined,
                handbook: role.locales.zh.handbook
                  ? clonePartialHandbook(role.locales.zh.handbook)
                  : undefined,
              }
            : undefined,
        }
      : undefined,
  };
}

function clonePartialHandbook(handbook: Partial<RoleHandbook>): Partial<RoleHandbook> {
  return {
    identity: handbook.identity,
    responsibilities: handbook.responsibilities ? [...handbook.responsibilities] : undefined,
    boundaries: handbook.boundaries ? [...handbook.boundaries] : undefined,
    inputRequirements: handbook.inputRequirements ? [...handbook.inputRequirements] : undefined,
    outputFormat: handbook.outputFormat ? [...handbook.outputFormat] : undefined,
    completionCriteria: handbook.completionCriteria ? [...handbook.completionCriteria] : undefined,
    validationCriteria: handbook.validationCriteria ? [...handbook.validationCriteria] : undefined,
    safetyRules: handbook.safetyRules ? [...handbook.safetyRules] : undefined,
    decisionAuthority: handbook.decisionAuthority ? [...handbook.decisionAuthority] : undefined,
  };
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(values: string[] | undefined): string {
  return (values || []).join('\n');
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function triggerModeLabel(value: RoleTriggerMode, t: TFunction): string {
  return t(TRIGGER_MODES.find((option) => option.value === value)?.labelKey || '', value);
}

function runModeLabel(value: RoleRunMode, t: TFunction): string {
  return t(RUN_MODES.find((option) => option.value === value)?.labelKey || '', value);
}

function displayLocale(language: string | undefined): 'en' | 'zh' {
  return language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function localizeRoleForDisplay(
  role: RoleDefinition,
  language: string | undefined
): RoleDefinition {
  const localized = role.locales?.[displayLocale(language)];
  if (!localized) return role;
  const handbook = localized.handbook || {};
  return {
    ...role,
    name: localized.name || role.name,
    shortName: localized.shortName || role.shortName,
    description: localized.description || role.description,
    triggerKeywords: localized.triggerKeywords || role.triggerKeywords,
    handbook: {
      identity: handbook.identity || role.handbook.identity,
      responsibilities: handbook.responsibilities || role.handbook.responsibilities,
      boundaries: handbook.boundaries || role.handbook.boundaries,
      inputRequirements: handbook.inputRequirements || role.handbook.inputRequirements,
      outputFormat: handbook.outputFormat || role.handbook.outputFormat,
      completionCriteria: handbook.completionCriteria || role.handbook.completionCriteria,
      validationCriteria: handbook.validationCriteria || role.handbook.validationCriteria,
      safetyRules: handbook.safetyRules || role.handbook.safetyRules,
      decisionAuthority: handbook.decisionAuthority || role.handbook.decisionAuthority,
    },
  };
}

function roleForSave(
  draft: RoleDefinition,
  source: RoleDefinition | undefined,
  language: string | undefined
): RoleDefinition {
  if (!source?.locales) return draft;
  const locale = displayLocale(language);
  return {
    ...draft,
    name: source.name,
    shortName: source.shortName,
    description: source.description,
    triggerKeywords: source.triggerKeywords,
    handbook: source.handbook,
    locales: {
      ...source.locales,
      [locale]: {
        ...source.locales[locale],
        name: draft.name,
        shortName: draft.shortName,
        description: draft.description,
        triggerKeywords: draft.triggerKeywords,
        handbook: draft.handbook,
      },
    },
  };
}

export function SettingsRoles() {
  const { t, i18n } = useTranslation();
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sessions = useAppStore((state) => state.sessions);
  const workingDir = useAppStore((state) => state.workingDir);
  const currentSession = sessions.find((session) => session.id === activeSessionId);
  const currentWorkspace = currentSession?.cwd || workingDir || '';

  const [snapshot, setSnapshot] = useState<RoleRegistrySnapshot | null>(null);
  const [candidateSnapshot, setCandidateSnapshot] = useState<RoleCandidateSnapshot | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoleDefinition | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roles = useMemo(
    () =>
      (snapshot?.roles || []).map((role) =>
        localizeRoleForDisplay(role, i18n.resolvedLanguage || i18n.language)
      ),
    [snapshot?.roles, i18n.resolvedLanguage, i18n.language]
  );
  const candidates = useMemo(
    () =>
      (candidateSnapshot?.candidates || [])
        .filter((candidate) => candidate.status !== 'accepted' && candidate.status !== 'rejected')
        .map((candidate) => ({
          ...candidate,
          role: localizeRoleForDisplay(candidate.role, i18n.resolvedLanguage || i18n.language),
        })),
    [candidateSnapshot?.candidates, i18n.resolvedLanguage, i18n.language]
  );
  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || roles[0] || null,
    [roles, selectedRoleId]
  );

  function loadRole(role: RoleDefinition | null) {
    setSelectedCandidateId(null);
    setSelectedRoleId(role?.id || null);
    setDraft(
      role ? cloneRole(localizeRoleForDisplay(role, i18n.resolvedLanguage || i18n.language)) : null
    );
  }

  async function refresh(nextSelectedId?: string) {
    setBusy(true);
    setStatus(null);
    try {
      const [next, nextCandidates] = await Promise.all([
        window.electronAPI.roles.snapshot(currentWorkspace || undefined),
        window.electronAPI.roles.candidatesSnapshot(currentWorkspace || undefined),
      ]);
      setSnapshot(next);
      setCandidateSnapshot(nextCandidates);
      const nextRole =
        next.roles.find((role) => role.id === (nextSelectedId || selectedRoleId)) ||
        next.roles[0] ||
        null;
      loadRole(nextRole);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveRole() {
    if (!draft) return;
    setBusy(true);
    setStatus(null);
    const sourceRole =
      (selectedCandidateId
        ? candidateSnapshot?.candidates.find(
            (candidate) => candidate.candidateId === selectedCandidateId
          )?.role
        : undefined) || snapshot?.roles.find((role) => role.id === draft.id);
    const roleToSave = roleForSave(draft, sourceRole, i18n.resolvedLanguage || i18n.language);
    try {
      if (selectedCandidateId) {
        const accepted = await window.electronAPI.roles.acceptCandidate({
          cwd: currentWorkspace || undefined,
          candidateId: selectedCandidateId,
          editedRole: roleToSave,
        });
        setSelectedCandidateId(null);
        setStatus(t('roles.candidateAccepted', 'Candidate role saved'));
        await refresh(accepted.role.id);
        return;
      }
      const saved = await window.electronAPI.roles.save({
        cwd: currentWorkspace || undefined,
        role: roleToSave,
      });
      setStatus(t('roles.saved', 'Role saved'));
      await refresh(saved.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  async function resetRole() {
    if (!draft) return;
    const ok = window.confirm(
      t('roles.resetConfirm', 'Reset this role to the built-in handbook and trigger settings?')
    );
    if (!ok) return;
    setBusy(true);
    setStatus(null);
    try {
      await window.electronAPI.roles.reset({
        cwd: currentWorkspace || undefined,
        roleId: draft.id,
      });
      setStatus(t('roles.resetDone', 'Role reset'));
      await refresh(draft.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  function editCandidate(candidate: RoleCandidate) {
    setSelectedCandidateId(candidate.candidateId);
    setSelectedRoleId(candidate.role.id);
    setDraft(cloneRole({ ...candidate.role, builtIn: false }));
  }

  async function acceptCandidate(candidate: RoleCandidate) {
    setBusy(true);
    setStatus(null);
    try {
      const accepted = await window.electronAPI.roles.acceptCandidate({
        cwd: currentWorkspace || undefined,
        candidateId: candidate.candidateId,
        editedRole:
          selectedCandidateId === candidate.candidateId && draft?.id === candidate.role.id
            ? draft
            : undefined,
      });
      setSelectedCandidateId(null);
      setStatus(t('roles.candidateAccepted', 'Candidate role saved'));
      await refresh(accepted.role.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  async function rejectCandidate(candidate: RoleCandidate) {
    setBusy(true);
    setStatus(null);
    try {
      await window.electronAPI.roles.rejectCandidate({
        cwd: currentWorkspace || undefined,
        candidateId: candidate.candidateId,
      });
      if (selectedCandidateId === candidate.candidateId) {
        setSelectedCandidateId(null);
      }
      setStatus(t('roles.candidateRejected', 'Candidate role rejected'));
      await refresh(selectedRoleId || undefined);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  function updateDraft(updater: (role: RoleDefinition) => RoleDefinition) {
    setDraft((prev) => (prev ? updater(prev) : prev));
  }

  function updateHandbookList(key: HandbookListKey, value: string) {
    updateDraft((role) => ({
      ...role,
      handbook: {
        ...role.handbook,
        [key]: splitLines(value),
      },
    }));
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace]);

  useEffect(() => {
    if (!draft && selectedRole) {
      loadRole(selectedRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole?.id]);

  useEffect(() => {
    if (selectedCandidateId || !selectedRole) return;
    loadRole(selectedRole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage, i18n.language]);

  function candidateRiskLabel(candidate: RoleCandidate): string {
    if (candidate.riskLevel === 'high') return t('roles.riskHigh', 'High risk');
    if (candidate.riskLevel === 'medium') return t('roles.riskMedium', 'Medium risk');
    return t('roles.riskLow', 'Low risk');
  }

  function candidateStatusLabel(candidate: RoleCandidate): string {
    if (candidate.status === 'blocked') return t('roles.blockedCandidate', 'Blocked');
    if (candidate.status === 'used_once') return t('roles.usedOnceCandidate', 'Used once');
    if (candidate.requiresUserApproval) return t('roles.approvalRequired', 'Approval required');
    return t('roles.readyCandidate', 'Ready');
  }

  return (
    <div className="space-y-1">
      <SettingsContentSection
        title={t('roles.title', 'Role Management')}
        description={t(
          'roles.description',
          'Manage multi-role collaboration, role handbooks, and automatic trigger rules.'
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refresh()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-border-muted px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {t('common.refresh', 'Refresh')}
          </button>
          {currentWorkspace && (
            <span className="min-w-0 truncate rounded-md bg-background-secondary px-2.5 py-1.5 text-xs text-text-muted">
              {currentWorkspace}
            </span>
          )}
          {snapshot && (
            <span className="rounded-md bg-accent/10 px-2.5 py-1.5 text-xs text-text-secondary">
              {t('roles.enabledCount', '{{enabled}}/{{total}} enabled', {
                enabled: snapshot.stats.enabled,
                total: snapshot.stats.total,
              })}
            </span>
          )}
        </div>
        {status && (
          <div className="rounded-md border border-border-muted bg-background-secondary px-3 py-2 text-sm text-text-secondary">
            {status}
          </div>
        )}
      </SettingsContentSection>

      <SettingsContentSection
        title={t('roles.candidateQueue', 'Candidate Roles')}
        description={t(
          'roles.candidateQueueDesc',
          'Review roles FishSwarm created when the current role library was not sufficient for a task.'
        )}
      >
        {candidates.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-muted p-4 text-sm text-text-muted">
            {busy
              ? t('common.loading', 'Loading...')
              : t('roles.noCandidates', 'No candidate roles')}
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((candidate) => {
              const blocked = candidate.status === 'blocked';
              const selected = selectedCandidateId === candidate.candidateId;
              return (
                <div
                  key={candidate.candidateId}
                  className={`rounded-md border p-4 ${
                    selected ? 'border-accent bg-accent/10' : 'border-border-muted bg-background'
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {blocked || candidate.riskLevel !== 'low' ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        ) : (
                          <UsersRound className="h-4 w-4 text-text-muted" />
                        )}
                        <h5 className="min-w-0 truncate text-sm font-semibold text-text-primary">
                          {candidate.role.name}
                        </h5>
                        <span className="rounded-full bg-background-secondary px-2 py-0.5 text-[10px] text-text-muted">
                          {candidateStatusLabel(candidate)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            candidate.riskLevel === 'high' || blocked
                              ? 'bg-red-50 text-red-700'
                              : candidate.riskLevel === 'medium'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {candidateRiskLabel(candidate)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-muted">
                        {candidate.role.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {candidate.gap.missingCapabilities.map((capability) => (
                          <span
                            key={capability}
                            className="rounded-full bg-background-secondary px-2 py-0.5 text-[10px] text-text-muted"
                          >
                            {capability}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-text-muted">
                        {candidate.sourceSummary}
                      </p>
                      {blocked && candidate.blockedReasons.length > 0 && (
                        <div className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                          {candidate.blockedReasons.join('；')}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => editCandidate(candidate)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-md border border-border-muted px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-60"
                      >
                        <Eye className="h-4 w-4" />
                        {t('roles.viewEditCandidate', 'View/Edit')}
                      </button>
                      {!blocked && (
                        <button
                          type="button"
                          onClick={() => acceptCandidate(candidate)}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" />
                          {t('roles.saveCandidate', 'Save as role')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => rejectCandidate(candidate)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-md border border-border-muted px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" />
                        {t('roles.rejectCandidate', 'Reject')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsContentSection>

      <SettingsContentSection
        title={t('roles.registry', 'Role Registry')}
        description={t(
          'roles.registryDesc',
          'Select a role, edit its trigger behavior, and tune the handbook mounted when that role comes online.'
        )}
      >
        {roles.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-muted p-4 text-sm text-text-muted">
            {busy ? t('common.loading', 'Loading...') : t('roles.empty', 'No roles yet')}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="space-y-2">
              {roles.map((role) => {
                const active = role.id === draft?.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => loadRole(role)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      active
                        ? 'border-accent bg-accent/10 text-text-primary'
                        : 'border-border-muted bg-background hover:bg-surface-hover'
                    } ${!role.enabled ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <UsersRound className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium">{role.name}</span>
                          {role.builtIn && (
                            <span className="rounded-full border border-border-muted px-2 py-0.5 text-[10px] text-text-muted">
                              {t('roles.builtIn', 'Built-in')}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">
                          {role.description}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                          <span className="rounded-full bg-background-secondary px-2 py-0.5">
                            {triggerModeLabel(role.triggerMode, t)}
                          </span>
                          <span className="rounded-full bg-background-secondary px-2 py-0.5">
                            {runModeLabel(role.defaultRunMode, t)}
                          </span>
                          {!role.enabled && (
                            <span className="rounded-full bg-background-secondary px-2 py-0.5">
                              {t('roles.disabled', 'Disabled')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {draft && (
              <div className="space-y-4">
                <div className="rounded-md border border-border-muted bg-background p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-text-muted" />
                        <h5 className="text-sm font-semibold text-text-primary">{draft.name}</h5>
                        <span className="rounded-full bg-background-secondary px-2 py-0.5 text-[10px] text-text-muted">
                          {draft.id}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        {t('roles.updatedAt', 'Updated')} {formatTime(draft.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={saveRole}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        {selectedCandidateId
                          ? t('roles.saveCandidate', 'Save as role')
                          : t('common.save', 'Save')}
                      </button>
                      {!selectedCandidateId && (
                        <button
                          type="button"
                          onClick={resetRole}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-md border border-border-muted px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-60"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {t('roles.resetBuiltIn', 'Reset')}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 rounded-md border border-border-muted bg-background-secondary px-3 py-2">
                      <span className="text-sm text-text-primary">
                        {t('roles.enabled', 'Enabled')}
                      </span>
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(event) =>
                          updateDraft((role) => ({ ...role, enabled: event.target.checked }))
                        }
                        className="h-4 w-4 accent-accent"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-text-muted">
                        {t('roles.triggerMode', 'Trigger mode')}
                      </span>
                      <select
                        value={draft.triggerMode}
                        onChange={(event) =>
                          updateDraft((role) => ({
                            ...role,
                            triggerMode: event.target.value as RoleTriggerMode,
                          }))
                        }
                        className="h-9 rounded-md border border-border-muted bg-background-secondary px-2 text-xs text-text-primary outline-none focus:border-accent"
                      >
                        {TRIGGER_MODES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(option.labelKey, option.fallback)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-text-muted">
                        {t('roles.defaultRunMode', 'Default run mode')}
                      </span>
                      <select
                        value={draft.defaultRunMode}
                        onChange={(event) =>
                          updateDraft((role) => ({
                            ...role,
                            defaultRunMode: event.target.value as RoleRunMode,
                          }))
                        }
                        className="h-9 rounded-md border border-border-muted bg-background-secondary px-2 text-xs text-text-primary outline-none focus:border-accent"
                      >
                        {RUN_MODES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(option.labelKey, option.fallback)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-text-muted">
                        {t('roles.triggerKeywords', 'Trigger keywords')}
                      </span>
                      <textarea
                        value={joinLines(draft.triggerKeywords)}
                        onChange={(event) =>
                          updateDraft((role) => ({
                            ...role,
                            triggerKeywords: splitLines(event.target.value),
                          }))
                        }
                        rows={4}
                        className="min-h-[7rem] resize-y rounded-md border border-border-muted bg-background-secondary px-3 py-2 text-xs leading-5 text-text-primary outline-none focus:border-accent"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-md border border-border-muted bg-background p-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-text-muted" />
                    <h5 className="text-sm font-semibold text-text-primary">
                      {t('roles.handbook', 'Role handbook')}
                    </h5>
                  </div>
                  <div className="mt-4 space-y-4">
                    <label className="grid gap-1">
                      <span className="text-xs text-text-muted">
                        {t('roles.descriptionField', 'Description')}
                      </span>
                      <textarea
                        value={draft.description}
                        onChange={(event) =>
                          updateDraft((role) => ({ ...role, description: event.target.value }))
                        }
                        rows={3}
                        className="resize-y rounded-md border border-border-muted bg-background-secondary px-3 py-2 text-xs leading-5 text-text-primary outline-none focus:border-accent"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-text-muted">
                        {t('roles.identity', 'Identity')}
                      </span>
                      <textarea
                        value={draft.handbook.identity}
                        onChange={(event) =>
                          updateDraft((role) => ({
                            ...role,
                            handbook: { ...role.handbook, identity: event.target.value },
                          }))
                        }
                        rows={4}
                        className="resize-y rounded-md border border-border-muted bg-background-secondary px-3 py-2 text-xs leading-5 text-text-primary outline-none focus:border-accent"
                      />
                    </label>
                    {HANDBOOK_FIELDS.map((field) => (
                      <label key={field.key} className="grid gap-1">
                        <span className="text-xs text-text-muted">
                          {t(field.labelKey, field.fallback)}
                        </span>
                        <textarea
                          value={joinLines(draft.handbook[field.key])}
                          onChange={(event) => updateHandbookList(field.key, event.target.value)}
                          rows={field.rows}
                          className="resize-y rounded-md border border-border-muted bg-background-secondary px-3 py-2 text-xs leading-5 text-text-primary outline-none focus:border-accent"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-border-muted bg-background-secondary px-3 py-2 text-xs leading-5 text-text-muted">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-muted" />
                    <span>
                      {t(
                        'roles.safetyHint',
                        'Role output is advisory. It will not bypass permissions or persist decisions automatically.'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </SettingsContentSection>
    </div>
  );
}
