import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  AssetExportCreatePackageResponse,
  AssetExportDryRunResponse,
  AssetCenterSnapshot,
  AssetKind,
  AssetSource,
  AssetStatus,
} from '../../types/asset-center';
import { useAppStore } from '../../store';
import {
  canConfigureProviderAsset,
  getProviderConfigureTarget,
} from '../../utils/asset-provider-configure';
import { canUseAssetInTask, formatAssetTaskReference } from '../../utils/asset-task-reference';
import {
  canCreateAssetExportPackage,
  canRunAssetExportDryRun,
  getAssetExportMode,
} from '../../utils/asset-export-view-model';
import {
  ASSET_GROUPS,
  buildAssetCenterViewModel,
  type AssetCenterFilters,
  type AssetCenterViewItem,
  type AssetGroupId,
} from '../../utils/asset-center-view-model';
import { AssetCard } from '../presets/AssetCard';
import { AssetStatusPill } from '../presets/AssetStatusPill';
import { EmptyState } from '../presets/EmptyState';
import { SectionCard } from '../presets/SectionCard';
import { AssetExportDryRunPanel } from '../release/AssetExportDryRunPanel';
import { AssetExportResultPanel } from '../release/AssetExportResultPanel';
import { SettingsContentSection } from './shared';

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

type SelectValue<T extends string> = T | 'all';

function formatDate(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function sourceRefText(item: AssetCenterViewItem): string {
  return item.sourceRef.path || item.sourceRef.uri || item.sourceRef.id || item.sourceRef.type;
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 text-xs">
      <dt className="text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-mono text-text-secondary">{value || '-'}</dd>
    </div>
  );
}

function AssetDetailPanel({
  item,
  onUseInTask,
  onConfigureProvider,
  exportDryRun,
  exportResult,
  exportError,
  exportApproved,
  isExportDryRunRunning,
  isExportPackageCreating,
  onRunExportDryRun,
  onExportApprovalChange,
  onCreateExportPackage,
  onRevealExportPackage,
}: {
  item: AssetCenterViewItem | null;
  onUseInTask: (item: AssetCenterViewItem) => void;
  onConfigureProvider: (item: AssetCenterViewItem) => void;
  exportDryRun: AssetExportDryRunResponse | null;
  exportResult: AssetExportCreatePackageResponse | null;
  exportError: string | null;
  exportApproved: boolean;
  isExportDryRunRunning: boolean;
  isExportPackageCreating: boolean;
  onRunExportDryRun: (item: AssetCenterViewItem) => void;
  onExportApprovalChange: (approved: boolean) => void;
  onCreateExportPackage: (item: AssetCenterViewItem) => void;
  onRevealExportPackage: (path: string) => void;
}) {
  const { t } = useTranslation();

  if (!item) {
    return (
      <SectionCard title={t('assetCenter.detail', '详情')}>
        <EmptyState
          title={t('assetCenter.noSelection', '选择一个资产')}
          description={t(
            'assetCenter.noSelectionDesc',
            '在左侧选择卡片后，这里会显示元数据、来源、警告和只读动作。'
          )}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title={t('assetCenter.detail', '详情')} description={item.title}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <AssetStatusPill label={item.statusLabel} tone={item.statusTone} />
          <span className="rounded-md bg-surface-muted px-2 py-1 text-xs text-text-secondary">
            {item.kindLabel}
          </span>
          <span className="rounded-md bg-surface-muted px-2 py-1 text-xs text-text-muted">
            {item.sourceLabel}
          </span>
        </div>

        <p className="text-sm leading-6 text-text-secondary">{item.summary}</p>

        <div className="space-y-2 rounded-lg border border-border-muted bg-background/60 p-3">
          <MetadataRow label="ID" value={item.id} />
          <MetadataRow label={t('assetCenter.scope', '作用域')} value={item.scope} />
          <MetadataRow label={t('assetCenter.source', '来源')} value={sourceRefText(item)} />
          <MetadataRow
            label={t('assetCenter.updatedAt', '更新时间')}
            value={formatDate(item.updatedAt || '')}
          />
          <MetadataRow label="Hash" value={item.contentHash || ''} />
        </div>

        <div>
          <h5 className="mb-2 text-xs font-semibold text-text-primary">
            {t('assetCenter.actions', '动作')}
          </h5>
          <div className="flex flex-wrap gap-2">
            {item.actions.map((action) => (
              <span
                key={action}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-secondary"
              >
                {action}
              </span>
            ))}
          </div>
          {canUseAssetInTask(item) && (
            <button
              type="button"
              onClick={() => onUseInTask(item)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/15"
            >
              <Send className="h-3.5 w-3.5" />
              {t('assetCenter.useInTask', '插入到任务输入框')}
            </button>
          )}
          {canConfigureProviderAsset(item) && (
            <button
              type="button"
              onClick={() => onConfigureProvider(item)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent/40 hover:bg-surface-hover hover:text-text-primary"
            >
              <Settings className="h-3.5 w-3.5" />
              {t('assetCenter.configureProvider', '打开模型配置')}
            </button>
          )}
          {canRunAssetExportDryRun(item) && (
            <div className="mt-3 space-y-3">
              <AssetExportDryRunPanel
                response={exportDryRun}
                error={exportError}
                approved={exportApproved}
                isRunning={isExportDryRunRunning}
                isCreating={isExportPackageCreating}
                onRunDryRun={() => onRunExportDryRun(item)}
                onApprovalChange={onExportApprovalChange}
                onCreatePackage={() => onCreateExportPackage(item)}
              />
              <AssetExportResultPanel result={exportResult} onReveal={onRevealExportPackage} />
            </div>
          )}
          <p className="mt-2 text-[11px] leading-4 text-text-muted">
            {t(
              'assetCenter.readOnlyHint',
              '当前阶段不会安装或运行资产；导出只能通过 dry-run、人工批准和 main process 受控服务完成。'
            )}
          </p>
        </div>

        {item.tags.length > 0 && (
          <div>
            <h5 className="mb-2 text-xs font-semibold text-text-primary">Tags</h5>
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-background px-2 py-0.5 text-[11px] text-text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {item.warnings.length > 0 && (
          <div className="rounded-lg border border-warning/25 bg-warning/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('assetCenter.warnings', '警告')}
            </div>
            <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-text-secondary">
              {item.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export function SettingsAssets({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation();
  const queuePromptInsert = useAppStore((state) => state.queuePromptInsert);
  const queueProviderConfigure = useAppStore((state) => state.queueProviderConfigure);
  const setShowSettings = useAppStore((state) => state.setShowSettings);
  const setSettingsTab = useAppStore((state) => state.setSettingsTab);
  const setGlobalNotice = useAppStore((state) => state.setGlobalNotice);
  const [snapshot, setSnapshot] = useState<AssetCenterSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<AssetCenterFilters>({
    keyword: '',
    groupId: 'all',
    kind: 'all',
    source: 'all',
    status: 'all',
  });
  const [exportDryRun, setExportDryRun] = useState<AssetExportDryRunResponse | null>(null);
  const [exportResult, setExportResult] = useState<AssetExportCreatePackageResponse | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportApproved, setExportApproved] = useState(false);
  const [isExportDryRunRunning, setIsExportDryRunRunning] = useState(false);
  const [isExportPackageCreating, setIsExportPackageCreating] = useState(false);

  const baseViewModel = useMemo(() => buildAssetCenterViewModel(snapshot), [snapshot]);
  const viewModel = useMemo(
    () => buildAssetCenterViewModel(snapshot, filters),
    [snapshot, filters]
  );
  const selectedItem = useMemo(
    () => viewModel.items.find((item) => item.id === selectedId) || viewModel.items[0] || null,
    [selectedId, viewModel.items]
  );

  useEffect(() => {
    if (!selectedItem) {
      setSelectedId(null);
      return;
    }
    if (selectedItem.id !== selectedId) {
      setSelectedId(selectedItem.id);
    }
  }, [selectedId, selectedItem]);

  useEffect(() => {
    setExportDryRun(null);
    setExportResult(null);
    setExportError(null);
    setExportApproved(false);
  }, [selectedItem?.id]);

  const loadSnapshot = useCallback(async () => {
    if (!isElectron) {
      setError(t('assetCenter.desktopOnly', '资源库需要在 Electron 桌面端读取。'));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const nextSnapshot = await window.electronAPI.assetCenter.getSnapshot();
      setSnapshot(nextSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('assetCenter.loadFailed', '资源库加载失败'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isActive) return;
    void loadSnapshot();
  }, [isActive, loadSnapshot]);

  function updateFilter<K extends keyof AssetCenterFilters>(key: K, value: AssetCenterFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const resetFilters = () =>
    setFilters({ keyword: '', groupId: 'all', kind: 'all', source: 'all', status: 'all' });

  const handleUseInTask = useCallback(
    (item: AssetCenterViewItem) => {
      if (!canUseAssetInTask(item)) return;
      queuePromptInsert({
        text: formatAssetTaskReference(item),
        source: 'assetCenter',
        assetId: item.id,
      });
      setGlobalNotice({
        id: `asset-use-in-task-${Date.now()}`,
        type: 'success',
        message: t('assetCenter.useInTaskQueued', '已将资产引用插入任务输入框，请检查后手动发送。'),
      });
      setShowSettings(false);
    },
    [queuePromptInsert, setGlobalNotice, setShowSettings, t]
  );

  const handleConfigureProvider = useCallback(
    (item: AssetCenterViewItem) => {
      const target = getProviderConfigureTarget(item);
      if (!target) return;
      queueProviderConfigure({
        source: 'assetCenter',
        assetId: target.assetId,
        providerId: target.providerId,
        setupId: target.setupId,
      });
      setGlobalNotice({
        id: `asset-configure-provider-${Date.now()}`,
        type: 'info',
        message: t(
          'assetCenter.providerConfigureQueued',
          '已打开模型配置页；资产只传递 provider/setup 引用，不包含密钥。'
        ),
      });
      setSettingsTab('api');
      setShowSettings(true);
    },
    [queueProviderConfigure, setGlobalNotice, setSettingsTab, setShowSettings, t]
  );

  const handleRunExportDryRun = useCallback(
    async (item: AssetCenterViewItem) => {
      if (!canRunAssetExportDryRun(item)) return;
      if (!isElectron || !window.electronAPI.assetExport) {
        setExportError(t('assetExport.desktopOnly', '导出工作流需要在 Electron 桌面端运行。'));
        return;
      }

      setIsExportDryRunRunning(true);
      setExportError(null);
      setExportResult(null);
      setExportApproved(false);
      try {
        const response = await window.electronAPI.assetExport.dryRun({
          mode: getAssetExportMode(item),
          artifactRefs: [item.id],
        });
        setExportDryRun(response);
      } catch (err) {
        setExportError(
          err instanceof Error ? err.message : t('assetExport.dryRunFailed', '导出 dry-run 失败')
        );
      } finally {
        setIsExportDryRunRunning(false);
      }
    },
    [t]
  );

  const handleCreateExportPackage = useCallback(
    async (item: AssetCenterViewItem) => {
      if (!canCreateAssetExportPackage(item) || !exportDryRun || !exportApproved) return;
      if (!isElectron || !window.electronAPI.assetExport) {
        setExportError(t('assetExport.desktopOnly', '导出工作流需要在 Electron 桌面端运行。'));
        return;
      }

      const mode = getAssetExportMode(item);
      const date = new Date().toISOString().slice(0, 10);
      setIsExportPackageCreating(true);
      setExportError(null);
      try {
        const result = await window.electronAPI.assetExport.createPackage({
          dryRun: exportDryRun.result,
          expectedDryRunSha256: exportDryRun.dryRunSha256,
          approved: exportApproved,
          artifactRefs: [item.id],
          packageFileName: `fishswarm-${mode}-${date}.zip`,
        });
        setExportResult(result);
        setExportApproved(false);
        setGlobalNotice({
          id: `asset-export-package-${Date.now()}`,
          type: 'success',
          message: t(
            'assetExport.packageCreated',
            '导出包已创建，并生成 checksum 与 redaction report。'
          ),
        });
      } catch (err) {
        setExportError(
          err instanceof Error ? err.message : t('assetExport.packageFailed', '导出包创建失败')
        );
      } finally {
        setIsExportPackageCreating(false);
      }
    },
    [exportApproved, exportDryRun, setGlobalNotice, t]
  );

  const handleRevealExportPackage = useCallback((packagePath: string) => {
    if (!isElectron) return;
    void window.electronAPI.showItemInFolder(packagePath);
  }, []);

  return (
    <div className="space-y-5">
      <SettingsContentSection
        title={t('assetCenter.title', '资源库 / Assets')}
        description={t(
          'assetCenter.description',
          '统一浏览 Lowcode 概念、Skills、Roles、MCP、Plugins、模型提供商与工作流交付物。当前为只读模式。'
        )}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Total</div>
            <div className="mt-1 text-2xl font-semibold text-text-primary">
              {baseViewModel.stats.total}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Filtered</div>
            <div className="mt-1 text-2xl font-semibold text-text-primary">
              {viewModel.stats.filtered}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Warnings</div>
            <div className="mt-1 text-2xl font-semibold text-warning">
              {baseViewModel.stats.warnings}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadSnapshot()}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:cursor-wait disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t('assetCenter.refresh', '刷新')}
          </button>
        </div>

        <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
          <div className="flex items-start gap-2 text-xs leading-5 text-text-secondary">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              {t(
                'assetCenter.securityHint',
                '安全边界：资源浏览只调用 assetCenter.getSnapshot；导出只调用 assetExport.dryRun/createPackage，renderer 不执行命令、不直接写文件。'
              )}
            </span>
          </div>
        </div>
      </SettingsContentSection>

      <SectionCard title={t('assetCenter.filters', '搜索与筛选')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={filters.keyword || ''}
              onChange={(event) => updateFilter('keyword', event.target.value)}
              placeholder={t('assetCenter.searchPlaceholder', '搜索标题、摘要、tag、来源或 ID...')}
              className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            />
          </label>

          <select
            value={filters.kind || 'all'}
            onChange={(event) => updateFilter('kind', event.target.value as SelectValue<AssetKind>)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="all">{t('assetCenter.allKinds', '全部类型')}</option>
            {baseViewModel.kindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>

          <select
            value={filters.source || 'all'}
            onChange={(event) =>
              updateFilter('source', event.target.value as SelectValue<AssetSource>)
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="all">{t('assetCenter.allSources', '全部来源')}</option>
            {baseViewModel.sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>

          <select
            value={filters.status || 'all'}
            onChange={(event) =>
              updateFilter('status', event.target.value as SelectValue<AssetStatus>)
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="all">{t('assetCenter.allStatuses', '全部状态')}</option>
            {baseViewModel.statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
          >
            {t('assetCenter.resetFilters', '重置筛选')}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateFilter('groupId', 'all')}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              (filters.groupId || 'all') === 'all'
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-background text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {t('assetCenter.allGroups', '全部分组')}
          </button>
          {ASSET_GROUPS.map((group) => {
            const count = baseViewModel.groups.find((entry) => entry.id === group.id)?.count || 0;
            return (
              <button
                type="button"
                key={group.id}
                onClick={() => updateFilter('groupId', group.id)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  filters.groupId === group.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-background text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {t(group.labelKey, group.fallbackLabel)} ({count})
              </button>
            );
          })}
        </div>
      </SectionCard>

      {error && (
        <div className="rounded-xl border border-error/25 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {baseViewModel.warnings.length > 0 && (
        <div className="rounded-xl border border-warning/25 bg-warning/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" />
            {t('assetCenter.snapshotWarnings', 'Snapshot 警告')}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-text-secondary">
            {baseViewModel.warnings.slice(0, 8).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {isLoading && !snapshot ? (
        <SectionCard title={t('assetCenter.loadingTitle', '正在加载资源库')}>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        </SectionCard>
      ) : viewModel.items.length === 0 ? (
        <EmptyState
          title={t('assetCenter.empty', '没有匹配的资产')}
          description={t('assetCenter.emptyDesc', '请尝试清空搜索词或切换筛选条件。')}
          action={
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {t('assetCenter.resetFilters', '重置筛选')}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {viewModel.groups
              .filter((group) => group.count > 0)
              .map((group) => (
                <SectionCard
                  key={group.id}
                  title={t(group.labelKey, group.fallbackLabel)}
                  description={t(group.descriptionKey, group.fallbackDescription)}
                >
                  <div className="space-y-3">
                    {viewModel.groupedItems[group.id as AssetGroupId].map((item) => (
                      <AssetCard
                        key={item.id}
                        item={item}
                        selected={selectedItem?.id === item.id}
                        onSelect={() => setSelectedId(item.id)}
                      />
                    ))}
                  </div>
                </SectionCard>
              ))}
          </div>
          <div className="lg:sticky lg:top-0 lg:self-start">
            <AssetDetailPanel
              item={selectedItem}
              onUseInTask={handleUseInTask}
              onConfigureProvider={handleConfigureProvider}
              exportDryRun={exportDryRun}
              exportResult={exportResult}
              exportError={exportError}
              exportApproved={exportApproved}
              isExportDryRunRunning={isExportDryRunRunning}
              isExportPackageCreating={isExportPackageCreating}
              onRunExportDryRun={handleRunExportDryRun}
              onExportApprovalChange={setExportApproved}
              onCreateExportPackage={handleCreateExportPackage}
              onRevealExportPackage={handleRevealExportPackage}
            />
            {snapshot?.generatedAt && (
              <p className="mt-2 text-center text-[11px] text-text-muted">
                {t('assetCenter.generatedAt', '生成时间')}: {formatDate(snapshot.generatedAt)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
