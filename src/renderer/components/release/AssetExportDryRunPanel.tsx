import { AlertTriangle, CheckCircle2, Loader2, PackageCheck, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AssetExportDryRunResponse } from '../../../shared/ipc-types';
import { buildAssetExportSummaryViewModel } from '../../utils/asset-export-view-model';
import { AssetStatusPill } from '../presets/AssetStatusPill';

export function AssetExportDryRunPanel({
  response,
  error,
  approved,
  isRunning,
  isCreating,
  onRunDryRun,
  onApprovalChange,
  onCreatePackage,
}: {
  response: AssetExportDryRunResponse | null;
  error: string | null;
  approved: boolean;
  isRunning: boolean;
  isCreating: boolean;
  onRunDryRun: () => void;
  onApprovalChange: (approved: boolean) => void;
  onCreatePackage: () => void;
}) {
  const { t } = useTranslation();
  const summary = buildAssetExportSummaryViewModel(response);
  const result = response?.result;
  const canApprove = Boolean(result?.ok && summary.blockerCount === 0);
  const canCreatePackage = canApprove && approved && !isCreating;

  return (
    <div className="space-y-3 rounded-xl border border-accent/20 bg-accent/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <h5 className="text-xs font-semibold text-text-primary">
              {t('assetExport.title', '受控导出工作流')}
            </h5>
            <AssetStatusPill label={summary.statusLabel} tone={summary.statusTone} />
          </div>
          <p className="mt-1 text-[11px] leading-4 text-text-muted">
            {t(
              'assetExport.description',
              '先执行 dry-run，确认 blockers、warnings、redaction report 后，再勾选人工批准创建 ZIP。'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onRunDryRun}
          disabled={isRunning || isCreating}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:cursor-wait disabled:opacity-60"
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          {t('assetExport.runDryRun', '运行 dry-run')}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-error/25 bg-error/10 p-2 text-xs leading-5 text-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-border-muted bg-background/60 p-2">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Files</div>
          <div className="mt-1 font-semibold text-text-primary">{summary.fileCount}</div>
        </div>
        <div className="rounded-lg border border-border-muted bg-background/60 p-2">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Size</div>
          <div className="mt-1 font-semibold text-text-primary">{summary.totalSizeLabel}</div>
        </div>
        <div className="rounded-lg border border-border-muted bg-background/60 p-2">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Blockers</div>
          <div
            className={
              summary.blockerCount > 0
                ? 'mt-1 font-semibold text-error'
                : 'mt-1 font-semibold text-success'
            }
          >
            {summary.blockerCount}
          </div>
        </div>
        <div className="rounded-lg border border-border-muted bg-background/60 p-2">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Redaction</div>
          <div
            className={
              summary.redactionBlockerCount > 0
                ? 'mt-1 font-semibold text-error'
                : 'mt-1 font-semibold text-text-primary'
            }
          >
            {summary.redactionCount}
          </div>
        </div>
      </div>

      {!result && (
        <p className="text-[11px] leading-4 text-text-muted">
          {t('assetExport.notRun', '尚未运行 dry-run；不会创建 ZIP 或写入导出文件。')}
        </p>
      )}

      {result?.blockers.length ? (
        <div className="rounded-lg border border-error/25 bg-error/10 p-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-error">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t('assetExport.blockers', 'Blockers')}
          </div>
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-4 text-text-secondary">
            {result.blockers.slice(0, 5).map((blocker) => (
              <li key={`${blocker.code}:${blocker.path || blocker.message}`}>
                <span className="font-mono">{blocker.code}</span>
                {blocker.path ? ` · ${blocker.path}` : ''} — {blocker.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result && result.blockers.length === 0 && (
        <div className="rounded-lg border border-success/25 bg-success/10 p-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('assetExport.noBlockers', 'Dry-run 通过：未发现 blocker。')}
          </div>
        </div>
      )}

      {result?.warnings.length || result?.redactionFindings.length ? (
        <div className="rounded-lg border border-warning/25 bg-warning/10 p-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warning">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t('assetExport.warnings', 'Warnings / Redaction report')}
          </div>
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-4 text-text-secondary">
            {result.warnings.slice(0, 3).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
            {result.redactionFindings.slice(0, 5).map((finding) => (
              <li key={`${finding.path}:${finding.line || 0}:${finding.type}`}>
                <span className="font-mono">{finding.type}</span> · {finding.path}
                {finding.line ? `:${finding.line}` : ''} — {finding.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label
        className={`flex items-start gap-2 rounded-lg border p-2 text-[11px] leading-4 ${
          canApprove
            ? 'border-border bg-background/60 text-text-secondary'
            : 'border-border-muted bg-surface-muted/40 text-text-muted'
        }`}
      >
        <input
          type="checkbox"
          checked={approved}
          disabled={!canApprove || isCreating}
          onChange={(event) => onApprovalChange(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          {t(
            'assetExport.approval',
            '我已人工检查 dry-run 结果、blockers、warnings 和 redaction report，同意创建导出包。'
          )}
        </span>
      </label>

      <button
        type="button"
        onClick={onCreatePackage}
        disabled={!canCreatePackage}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCreating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <PackageCheck className="h-3.5 w-3.5" />
        )}
        {t('assetExport.createPackage', '创建审计导出包')}
      </button>
    </div>
  );
}
