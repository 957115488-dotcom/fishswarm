import type { AssetStatusTone } from '../../utils/asset-center-view-model';

const TONE_CLASS: Record<AssetStatusTone, string> = {
  success: 'border-success/25 bg-success/10 text-success',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  danger: 'border-error/25 bg-error/10 text-error',
  muted: 'border-border-muted bg-surface-muted text-text-muted',
  accent: 'border-accent/25 bg-accent/10 text-accent',
};

export function AssetStatusPill({ label, tone }: { label: string; tone: AssetStatusTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}
