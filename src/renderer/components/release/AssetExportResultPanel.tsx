import { CheckCircle2, ExternalLink, FileArchive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AssetExportCreatePackageResponse } from '../../../shared/ipc-types';
import { buildAssetExportResultSummary } from '../../utils/asset-export-view-model';

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2 text-[11px] leading-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-mono text-text-secondary">{value || '-'}</dd>
    </div>
  );
}

export function AssetExportResultPanel({
  result,
  onReveal,
}: {
  result: AssetExportCreatePackageResponse | null;
  onReveal: (path: string) => void;
}) {
  const { t } = useTranslation();
  const summary = buildAssetExportResultSummary(result);

  if (!result) return null;

  return (
    <div className="space-y-3 rounded-xl border border-success/25 bg-success/10 p-3">
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
          <FileArchive className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h5 className="text-xs font-semibold text-text-primary">
              {t('assetExport.resultTitle', '导出包已创建')}
            </h5>
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          </div>
          <p className="mt-1 text-[11px] leading-4 text-text-muted">
            {t(
              'assetExport.resultDesc',
              'ZIP、manifest、redaction report 和 checksum 已由 main process 生成。'
            )}
          </p>
        </div>
      </div>

      <dl className="space-y-1.5 rounded-lg border border-border-muted bg-background/60 p-2">
        <ResultRow label="Package" value={result.packagePath} />
        <ResultRow label="Checksum" value={result.checksumPath} />
        <ResultRow label="Size" value={summary.sizeLabel} />
        <ResultRow label="SHA" value={summary.shaShort} />
        <ResultRow label="Dry-run" value={summary.dryRunShaShort} />
        <ResultRow
          label="Policy"
          value={`${result.policyDecision.effect} · ${result.policyDecision.risk}`}
        />
      </dl>

      <button
        type="button"
        onClick={() => onReveal(result.packagePath)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {t('assetExport.revealPackage', '在文件夹中显示')}
      </button>
    </div>
  );
}
