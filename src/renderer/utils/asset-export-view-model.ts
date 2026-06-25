import type {
  AssetExportDryRunResponse,
  AssetExportCreatePackageResponse,
  ExportPackageMode,
} from '../../shared/ipc-types';
import type { AssetCenterItem } from '../types/asset-center';

export interface AssetExportSummaryViewModel {
  fileCount: number;
  totalBytes: number;
  totalSizeLabel: string;
  blockerCount: number;
  warningCount: number;
  redactionCount: number;
  redactionBlockerCount: number;
  canCreatePackage: boolean;
  statusLabel: string;
  statusTone: 'success' | 'warning' | 'danger' | 'muted';
}

export function formatExportBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function canRunAssetExportDryRun(item: AssetCenterItem | null | undefined): boolean {
  return Boolean(
    item &&
    item.kind === 'export.package' &&
    item.status !== 'unavailable' &&
    item.actions.includes('dryRunExport')
  );
}

export function canCreateAssetExportPackage(item: AssetCenterItem | null | undefined): boolean {
  return Boolean(
    item &&
    item.kind === 'export.package' &&
    item.status !== 'unavailable' &&
    item.actions.includes('createPackage')
  );
}

export function getAssetExportMode(item: AssetCenterItem): ExportPackageMode {
  return item.sourceRef.id === 'deployable-source' ? 'deployable-source' : 'audit-source';
}

export function buildAssetExportSummaryViewModel(
  response: AssetExportDryRunResponse | null | undefined
): AssetExportSummaryViewModel {
  const result = response?.result;
  const blockerCount = result?.blockers.length || 0;
  const redactionCount = result?.redactionFindings.length || 0;
  const redactionBlockerCount =
    result?.redactionFindings.filter((finding) => finding.severity === 'blocker').length || 0;
  const warningCount = (result?.warnings.length || 0) + redactionCount;
  const totalBytes = result?.candidates.reduce((sum, file) => sum + file.size, 0) || 0;
  const canCreatePackage = Boolean(result?.ok && blockerCount === 0);

  return {
    fileCount: result?.candidates.length || 0,
    totalBytes,
    totalSizeLabel: formatExportBytes(totalBytes),
    blockerCount,
    warningCount,
    redactionCount,
    redactionBlockerCount,
    canCreatePackage,
    statusLabel: !result
      ? 'Not run'
      : canCreatePackage
        ? 'Ready'
        : blockerCount > 0
          ? 'Blocked'
          : 'Needs review',
    statusTone: !result ? 'muted' : canCreatePackage ? 'success' : 'danger',
  };
}

export function buildAssetExportResultSummary(
  result: AssetExportCreatePackageResponse | null | undefined
): { sizeLabel: string; shaShort: string; dryRunShaShort: string } {
  return {
    sizeLabel: formatExportBytes(result?.size || 0),
    shaShort: result?.sha256.slice(0, 12) || '',
    dryRunShaShort: result?.dryRunSha256.slice(0, 12) || '',
  };
}
