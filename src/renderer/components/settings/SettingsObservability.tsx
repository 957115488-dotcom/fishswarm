import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  CheckCircle2,
  FlaskConical,
  GitBranch,
  HeartPulse,
  PauseCircle,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import type {
  BrowserSkillDraft,
  BrowserSkillEntry,
  BrowserSkillRuntimeSnapshot,
  BrowserSkillTestResult,
  ChangeScopeReport,
  HealthSummary,
  ProjectLearning,
  ProjectTimelineEvent,
} from '../../../shared/ipc-types';
import { SettingsContentSection } from './shared';

function statusTone(status: string): string {
  if (status === 'ok') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'error' || status === 'blocked') return 'text-red-700 bg-red-50 border-red-200';
  return 'text-amber-700 bg-amber-50 border-amber-200';
}

function formatTime(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export function SettingsObservability() {
  const { t } = useTranslation();
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sessions = useAppStore((state) => state.sessions);
  const workingDir = useAppStore((state) => state.workingDir);
  const currentSession = sessions.find((session) => session.id === activeSessionId);
  const currentWorkspace = currentSession?.cwd || workingDir || '';

  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [scope, setScope] = useState<ChangeScopeReport | null>(null);
  const [timeline, setTimeline] = useState<ProjectTimelineEvent[]>([]);
  const [learnings, setLearnings] = useState<ProjectLearning[]>([]);
  const [browserRuntime, setBrowserRuntime] = useState<BrowserSkillRuntimeSnapshot>({
    skills: [],
    drafts: [],
  });
  const [browserTest, setBrowserTest] = useState<BrowserSkillTestResult | null>(null);
  const [skillName, setSkillName] = useState('browser-workflow');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runtimeBusy, setRuntimeBusy] = useState<string | null>(null);

  const activeScopes = useMemo(() => {
    if (!scope) return [];
    return Object.entries(scope.scopes)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);
  }, [scope]);

  async function refresh() {
    setBusy(true);
    setStatus(null);
    try {
      const [nextHealth, nextScope, nextTimeline, nextLearnings, nextBrowserRuntime] =
        await Promise.all([
        window.electronAPI.health.summary(currentWorkspace || undefined),
        window.electronAPI.changeScope.analyze(currentWorkspace || undefined),
        window.electronAPI.timeline.list({ cwd: currentWorkspace || undefined, limit: 20 }),
        window.electronAPI.learnings.list({ cwd: currentWorkspace || undefined, limit: 12 }),
        window.electronAPI.browserSkills.list(currentWorkspace || undefined),
      ]);
      setHealth(nextHealth);
      setScope(nextScope);
      setTimeline(nextTimeline);
      setLearnings(nextLearnings);
      setBrowserRuntime(nextBrowserRuntime);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('common.error', '出错了'));
    } finally {
      setBusy(false);
    }
  }

  async function createSkillDraft() {
    if (!currentWorkspace) {
      setStatus(t('observability.noWorkspace', '暂无工作区'));
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const result = await window.electronAPI.browserSkillify.createDraft({
        cwd: currentWorkspace,
        name: skillName,
        trigger: skillName,
      });
      setStatus(
        t('observability.skillCreated', '已暂存 Browser Skill 草稿：{{name}}（{{count}} 步）', {
          name: result.skillName,
          count: result.commandCount,
        })
      );
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('common.error', '出错了'));
    } finally {
      setBusy(false);
    }
  }

  async function runRuntimeAction(actionId: string, action: () => Promise<string | null | void>) {
    if (!currentWorkspace) {
      setStatus(t('observability.noWorkspace', '暂无工作区'));
      return;
    }
    setRuntimeBusy(actionId);
    setStatus(null);
    try {
      const message = await action();
      if (message) setStatus(message);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('common.error', '出错了'));
    } finally {
      setRuntimeBusy(null);
    }
  }

  async function testDraft(draft: BrowserSkillDraft) {
    await runRuntimeAction(`test-draft:${draft.stageId}`, async () => {
      const result = await window.electronAPI.browserSkills.testDraft({
        cwd: currentWorkspace,
        stageId: draft.stageId,
      });
      setBrowserTest(result);
      return formatTestMessage(result);
    });
  }

  async function commitDraft(draft: BrowserSkillDraft) {
    await runRuntimeAction(`commit-draft:${draft.stageId}`, async () => {
      const result = await window.electronAPI.browserSkills.commitDraft({
        cwd: currentWorkspace,
        stageId: draft.stageId,
      });
      return t('observability.browserSkillEnabled', '已启用 Browser Skill：{{name}}', {
        name: result.name,
      });
    });
  }

  async function discardDraft(draft: BrowserSkillDraft) {
    await runRuntimeAction(`discard-draft:${draft.stageId}`, async () => {
      await window.electronAPI.browserSkills.discardDraft({
        cwd: currentWorkspace,
        stageId: draft.stageId,
      });
      return t('observability.browserSkillDiscarded', '已丢弃草稿：{{name}}', {
        name: draft.skillName,
      });
    });
  }

  async function testSkill(skill: BrowserSkillEntry) {
    await runRuntimeAction(`test-skill:${skill.name}`, async () => {
      const result = await window.electronAPI.browserSkills.test({
        cwd: currentWorkspace,
        name: skill.name,
      });
      setBrowserTest(result);
      return formatTestMessage(result);
    });
  }

  async function toggleSkill(skill: BrowserSkillEntry) {
    await runRuntimeAction(`toggle-skill:${skill.name}`, async () => {
      const nextEnabled = !skill.enabled;
      await window.electronAPI.browserSkills.setEnabled({
        cwd: currentWorkspace,
        name: skill.name,
        enabled: nextEnabled,
      });
      return nextEnabled
        ? t('observability.browserSkillEnabled', '已启用 Browser Skill：{{name}}', { name: skill.name })
        : t('observability.browserSkillDisabled', '已禁用 Browser Skill：{{name}}', { name: skill.name });
    });
  }

  async function removeSkill(skill: BrowserSkillEntry) {
    await runRuntimeAction(`remove-skill:${skill.name}`, async () => {
      await window.electronAPI.browserSkills.remove({
        cwd: currentWorkspace,
        name: skill.name,
      });
      return t('observability.browserSkillRemoved', '已移除 Browser Skill：{{name}}', {
        name: skill.name,
      });
    });
  }

  async function runSkill(skill: BrowserSkillEntry) {
    await runRuntimeAction(`run-skill:${skill.name}`, async () => {
      const result = await window.electronAPI.browserSkills.run({
        cwd: currentWorkspace,
        name: skill.name,
      });
      return result.ok
        ? t('observability.browserSkillRunOk', '运行完成：{{name}}（{{count}} 步）', {
            name: skill.name,
            count: result.stepCount,
          })
        : result.error || t('common.error', '出错了');
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace]);

  return (
    <div className="space-y-1">
      <SettingsContentSection
        title={t('observability.title', '健康与时间线')}
        description={t('observability.description', '项目健康、改动范围、浏览器执行与经验沉淀。')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={refresh}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-border-muted px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {t('common.refresh', '刷新')}
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

      <SettingsContentSection title={t('observability.health', '健康')}>
        <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
          <div className="rounded-md border border-border-muted bg-background-secondary p-4">
            <div className="flex items-center gap-2 text-text-muted">
              <HeartPulse className="h-4 w-4" />
              <span className="text-xs">{t('observability.score', '评分')}</span>
            </div>
            <div className="mt-3 text-3xl font-semibold text-text-primary">{health?.score ?? '--'}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(health?.checks || []).map((check) => (
              <div key={check.id} className="rounded-md border border-border-muted bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-text-primary">{check.label}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusTone(check.status)}`}>
                    {check.status}
                  </span>
                </div>
                {check.detail && <p className="mt-2 truncate text-xs text-text-muted">{check.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      </SettingsContentSection>

      <SettingsContentSection title={t('observability.scope', '改动范围')}>
        <div className="rounded-md border border-border-muted bg-background p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <GitBranch className="h-4 w-4" />
            {scope?.files.length ?? 0} {t('observability.changedFiles', '个改动文件')}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeScopes.length ? (
              activeScopes.map((item) => (
                <span key={item} className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-text-primary">
                  {item}
                </span>
              ))
            ) : (
              <span className="text-sm text-text-muted">{t('observability.noScopes', '暂无范围')}</span>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RecommendationList
              title={t('observability.skills', '建议技能')}
              items={scope?.recommendedSkills || []}
            />
            <RecommendationList
              title={t('observability.commands', '建议命令')}
              items={scope?.recommendedCommands || []}
            />
          </div>
        </div>
      </SettingsContentSection>

      <SettingsContentSection title={t('observability.timeline', '时间线')}>
        <div className="space-y-2">
          {timeline.length ? (
            timeline.map((event) => (
              <div key={event.id} className="rounded-md border border-border-muted bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Activity className="h-4 w-4 flex-shrink-0 text-text-muted" />
                    <span className="truncate text-sm font-medium text-text-primary">{event.event}</span>
                  </div>
                  <span className="text-xs text-text-muted">{formatTime(event.ts)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                  <span>{event.category}</span>
                  {event.status && <span>{event.status}</span>}
                  {typeof event.durationMs === 'number' && <span>{event.durationMs}ms</span>}
                  {event.command && <span>{event.command}</span>}
                </div>
                {event.summary && <p className="mt-2 text-xs leading-5 text-text-muted">{event.summary}</p>}
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-border-muted p-4 text-sm text-text-muted">
              {t('observability.noTimeline', '暂无时间线')}
            </div>
          )}
        </div>
      </SettingsContentSection>

      <SettingsContentSection title={t('observability.skillify', 'Browse Skillify')}>
        <div className="flex flex-col gap-3 rounded-md border border-border-muted bg-background p-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2">
            <Sparkles className="h-4 w-4 text-text-muted" />
            <input
              value={skillName}
              onChange={(event) => setSkillName(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-border-muted bg-background-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={createSkillDraft}
            disabled={busy || !currentWorkspace}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {t('observability.createSkill', '生成草稿')}
          </button>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <BrowserDraftList
            drafts={browserRuntime.drafts}
            busy={runtimeBusy}
            onTest={testDraft}
            onCommit={commitDraft}
            onDiscard={discardDraft}
          />
          <BrowserSkillList
            skills={browserRuntime.skills}
            busy={runtimeBusy}
            onTest={testSkill}
            onRun={runSkill}
            onToggle={toggleSkill}
            onRemove={removeSkill}
          />
        </div>
        {browserTest && (
          <div className="rounded-md border border-border-muted bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {browserTest.ok ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
                )}
                <span className="truncate text-sm font-medium text-text-primary">
                  {browserTest.skillName}
                </span>
              </div>
              <span className="text-xs text-text-muted">{browserTest.commandCount} steps</span>
            </div>
            <div className="mt-2 grid gap-1 text-xs leading-5 text-text-muted">
              {[...browserTest.errors, ...browserTest.warnings].map((item) => (
                <span key={item}>{item}</span>
              ))}
              {browserTest.errors.length === 0 && browserTest.warnings.length === 0 && (
                <span>{t('observability.browserSkillTestClean', '检查通过')}</span>
              )}
            </div>
          </div>
        )}
        <div className="grid gap-2">
          {learnings.map((learning) => (
            <div key={learning.id} className="rounded-md border border-border-muted bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text-primary">{learning.key}</span>
                <span className="text-xs text-text-muted">{learning.confidence}/10</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-text-muted">{learning.insight}</p>
            </div>
          ))}
        </div>
      </SettingsContentSection>
    </div>
  );
}

function BrowserDraftList({
  drafts,
  busy,
  onTest,
  onCommit,
  onDiscard,
}: {
  drafts: BrowserSkillDraft[];
  busy: string | null;
  onTest: (draft: BrowserSkillDraft) => void;
  onCommit: (draft: BrowserSkillDraft) => void;
  onDiscard: (draft: BrowserSkillDraft) => void;
}) {
  return (
    <div className="rounded-md border border-border-muted bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">Drafts</span>
        <span className="text-xs text-text-muted">{drafts.length}</span>
      </div>
      <div className="space-y-2">
        {drafts.length ? (
          drafts.map((draft) => (
            <div key={draft.stageId} className="rounded-md bg-background-secondary p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{draft.skillName}</p>
                  <p className="text-xs text-text-muted">
                    {draft.commandCount} steps · {draft.requiresReview ? 'review' : 'ready'}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <IconButton
                    title="Test draft"
                    disabled={busy !== null}
                    busy={busy === `test-draft:${draft.stageId}`}
                    onClick={() => onTest(draft)}
                  >
                    <FlaskConical className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    title="Enable draft"
                    disabled={busy !== null}
                    busy={busy === `commit-draft:${draft.stageId}`}
                    onClick={() => onCommit(draft)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    title="Discard draft"
                    disabled={busy !== null}
                    busy={busy === `discard-draft:${draft.stageId}`}
                    onClick={() => onDiscard(draft)}
                    danger
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border-muted p-3 text-sm text-text-muted">
            No staged drafts
          </div>
        )}
      </div>
    </div>
  );
}

function BrowserSkillList({
  skills,
  busy,
  onTest,
  onRun,
  onToggle,
  onRemove,
}: {
  skills: BrowserSkillEntry[];
  busy: string | null;
  onTest: (skill: BrowserSkillEntry) => void;
  onRun: (skill: BrowserSkillEntry) => void;
  onToggle: (skill: BrowserSkillEntry) => void;
  onRemove: (skill: BrowserSkillEntry) => void;
}) {
  return (
    <div className="rounded-md border border-border-muted bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">Runtime</span>
        <span className="text-xs text-text-muted">{skills.length}</span>
      </div>
      <div className="space-y-2">
        {skills.length ? (
          skills.map((skill) => (
            <div key={`${skill.tier}:${skill.name}`} className="rounded-md bg-background-secondary p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-text-primary">{skill.name}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        skill.enabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      {skill.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-text-muted">
                    {skill.tier} · {skill.commandCount} steps · {skill.frontmatter.host || 'local'}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <IconButton
                    title="Test skill"
                    disabled={busy !== null}
                    busy={busy === `test-skill:${skill.name}`}
                    onClick={() => onTest(skill)}
                  >
                    <FlaskConical className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    title="Run skill"
                    disabled={busy !== null || !skill.enabled}
                    busy={busy === `run-skill:${skill.name}`}
                    onClick={() => onRun(skill)}
                  >
                    <Play className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    title={skill.enabled ? 'Disable skill' : 'Enable skill'}
                    disabled={busy !== null || skill.tier === 'bundled'}
                    busy={busy === `toggle-skill:${skill.name}`}
                    onClick={() => onToggle(skill)}
                  >
                    {skill.enabled ? <PauseCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </IconButton>
                  <IconButton
                    title="Remove skill"
                    disabled={busy !== null || skill.tier === 'bundled'}
                    busy={busy === `remove-skill:${skill.name}`}
                    onClick={() => onRemove(skill)}
                    danger
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border-muted p-3 text-sm text-text-muted">
            No runtime skills
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  title,
  disabled,
  busy,
  danger,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  busy?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-50 ${
        danger
          ? 'border-red-200 text-red-700 hover:bg-red-50'
          : 'border-border-muted text-text-secondary hover:bg-surface-hover'
      }`}
    >
      {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function formatTestMessage(result: BrowserSkillTestResult): string {
  if (result.ok && result.warnings.length === 0) {
    return `Browser Skill checked: ${result.skillName}`;
  }
  if (result.ok) {
    return `Browser Skill checked with warnings: ${result.warnings.join('; ')}`;
  }
  return `Browser Skill check failed: ${result.errors.join('; ')}`;
}

function RecommendationList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md bg-background-secondary p-3">
      <p className="text-xs font-medium text-text-muted">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span key={item} className="rounded-md bg-background px-2 py-1 text-xs text-text-primary">
              {item}
            </span>
          ))
        ) : (
          <span className="text-xs text-text-muted">--</span>
        )}
      </div>
    </div>
  );
}
