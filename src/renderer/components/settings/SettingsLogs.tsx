import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Loader2,
  Save,
  Globe,
  Trash2,
  Copy,
} from 'lucide-react';
import { formatAppDateTime } from '../../utils/i18n-format';
import { useAppDialog } from '../AppDialog';
import { SettingsContentSection } from './shared';
import type { ProjectTimelineEvent } from '../../../shared/ipc-types';

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

export function SettingsLogs({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const [logFiles, setLogFiles] = useState<
    Array<{ name: string; path: string; size: number; mtime: Date }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logsDirectory, setLogsDirectory] = useState('');
  const [devLogsEnabled, setDevLogsEnabled] = useState(true);
  const [timelineEvents, setTimelineEvents] = useState<ProjectTimelineEvent[]>([]);

  const loadLogs = useCallback(async () => {
    try {
      const [files, dir, recentTimeline] = await Promise.all([
        window.electronAPI.logs.getAll(),
        window.electronAPI.logs.getDirectory(),
        window.electronAPI.timeline.list({ limit: 12 }),
      ]);
      setLogFiles(files || []);
      setLogsDirectory(dir || '');
      setTimelineEvents(recentTimeline || []);
      setError('');
    } catch (err) {
      console.error('Failed to load logs:', err);
      setError(t('logs.exportFailed'));
    }
  }, [t]);

  const loadDevLogsStatus = useCallback(async () => {
    try {
      const result = await window.electronAPI.logs.isEnabled();
      if (result.success && typeof result.enabled === 'boolean') {
        setDevLogsEnabled(result.enabled);
      }
    } catch (err) {
      console.error('Failed to load dev logs status:', err);
    }
  }, []);

  useEffect(() => {
    if (!isElectron || !isActive) {
      return;
    }
    void loadLogs();
    void loadDevLogsStatus();
    const interval = setInterval(() => {
      void loadLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [isActive, loadDevLogsStatus, loadLogs]);

  async function handleToggleDevLogs() {
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const newEnabled = !devLogsEnabled;
      const result = await window.electronAPI.logs.setEnabled(newEnabled);
      if (result.success) {
        setDevLogsEnabled(newEnabled);
        setSuccess(newEnabled ? t('logs.devLogsEnabled') : t('logs.devLogsDisabled'));
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || t('logs.toggleFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('logs.toggleFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExport() {
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await window.electronAPI.logs.export();
      if (result.success) {
        setSuccess(t('logs.exportSuccess', { path: result.path }));
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(result.error || t('logs.exportFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('logs.exportFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpen() {
    setIsLoading(true);
    try {
      await window.electronAPI.logs.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('logs.exportFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClear() {
    const confirmed = await dialog.confirm({
      message: t('logs.clearConfirm'),
      intent: 'danger',
      confirmLabel: t('logs.clearAll'),
    });
    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await window.electronAPI.logs.clear();
      if (result.success) {
        setSuccess(t('logs.clearSuccess', { count: result.deletedCount }));
        await loadLogs();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || t('logs.clearFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('logs.clearFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(date: Date): string {
    return formatAppDateTime(date);
  }

  function formatTimelineDate(value: string): string {
    return formatAppDateTime(new Date(value));
  }

  const totalSize = logFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="space-y-4">
      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-error/10 text-error text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-success/10 text-success text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Developer Logs Toggle */}
      <section className="rounded-lg border border-border-subtle bg-background px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-text-primary">{t('logs.enableDevLogs')}</h4>
            <p className="mt-1 text-xs leading-5 text-text-muted">{t('logs.enableDevLogsDesc')}</p>
          </div>
          <button
            onClick={handleToggleDevLogs}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 flex-shrink-0 ${
              devLogsEnabled ? 'bg-accent' : 'bg-surface-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-text-primary transition-transform ${
                devLogsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Stats */}
      <SettingsContentSection
        title={t('logs.logFiles')}
        description={t('logs.inventoryDescription')}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-background border border-border-subtle">
            <div className="text-2xl font-bold text-text-primary">{logFiles.length}</div>
            <div className="text-sm text-text-muted">{t('logs.logFiles')}</div>
          </div>
          <div className="p-4 rounded-lg bg-background border border-border-subtle">
            <div className="text-2xl font-bold text-text-primary">{formatFileSize(totalSize)}</div>
            <div className="text-sm text-text-muted">{t('logs.totalSize')}</div>
          </div>
        </div>
      </SettingsContentSection>

      {/* Log Files List */}
      <SettingsContentSection title={t('logs.logFiles')} description={t('logs.recentDescription')}>
        {logFiles.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>{t('logs.noLogFiles')}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logFiles.map((file) => (
              <div
                key={file.path}
                className="p-3 rounded-lg bg-background border border-border-subtle"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-text-primary truncate">{file.name}</div>
                    <div className="text-xs text-text-muted mt-1">
                      {formatFileSize(file.size)} • {formatDate(file.mtime)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsContentSection>

      {/* Project Timeline */}
      <SettingsContentSection
        title={t('logs.projectTimeline', '项目时间线')}
        description={t(
          'logs.projectTimelineDescription',
          '最近的 MCP、浏览器、安全、上下文和健康检查事件。'
        )}
      >
        {timelineEvents.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>{t('logs.noProjectTimeline', '暂无项目时间线事件')}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {timelineEvents.map((event) => (
              <div
                key={event.id}
                className="p-3 rounded-lg bg-background border border-border-subtle"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-text-primary break-all">
                        {event.event}
                      </span>
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-text-muted">
                        {event.category}
                      </span>
                      {event.status && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            event.status === 'error'
                              ? 'bg-error/10 text-error'
                              : event.status === 'ok'
                                ? 'bg-success/10 text-success'
                                : 'bg-surface-muted text-text-muted'
                          }`}
                        >
                          {event.status}
                        </span>
                      )}
                    </div>
                    {event.summary && (
                      <p className="mt-1 text-xs leading-5 text-text-secondary break-words">
                        {event.summary}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs text-text-muted">
                    <div>{formatTimelineDate(event.ts)}</div>
                    {typeof event.durationMs === 'number' && (
                      <div className="mt-1">{Math.round(event.durationMs)}ms</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsContentSection>

      {/* Directory Path */}
      {logsDirectory && (
        <SettingsContentSection
          title={t('logs.logsDirectory')}
          description={t('logs.directoryDescription')}
        >
          <div className="p-3 rounded-lg bg-background border border-border-subtle">
            <div className="text-xs text-text-muted mb-1">{t('logs.logsDirectory')}</div>
            <div className="flex items-start gap-2">
              <button
                className="font-mono text-xs text-text-secondary break-all text-left hover:text-accent hover:underline cursor-pointer bg-transparent border-none p-0"
                onClick={() => window.electronAPI.logs.open()}
                title={t('logs.openFolder')}
              >
                {logsDirectory}
              </button>
              <button
                className="shrink-0 p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                onClick={() => navigator.clipboard.writeText(logsDirectory)}
                title={t('common.copy')}
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </SettingsContentSection>
      )}

      {/* Action Buttons */}
      <SettingsContentSection
        title={t('logs.actionsTitle')}
        description={t('logs.actionsDescription')}
      >
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleExport}
            disabled={isLoading}
            className="py-3 px-4 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="text-sm">{t('logs.exportZip')}</span>
          </button>
          <button
            onClick={handleOpen}
            disabled={isLoading}
            className="py-3 px-4 rounded-lg bg-background border border-border-subtle text-text-primary font-medium hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Globe className="w-4 h-4" />
            <span className="text-sm">{t('logs.openFolder')}</span>
          </button>
          <button
            onClick={handleClear}
            disabled={isLoading || logFiles.length === 0}
            className="py-3 px-4 rounded-lg bg-error/10 text-error font-medium hover:bg-error/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm">{t('logs.clearAll')}</span>
          </button>
        </div>
      </SettingsContentSection>

      {/* Help Text */}
      <div className="text-xs text-text-muted text-center space-y-1">
        <p>{t('logs.helpText1')}</p>
        <p>{t('logs.helpText2')}</p>
      </div>
    </div>
  );
}
