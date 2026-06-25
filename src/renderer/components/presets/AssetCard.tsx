import { AlertTriangle, Eye, FileText } from 'lucide-react';
import type { AssetCenterViewItem } from '../../utils/asset-center-view-model';
import { AssetStatusPill } from './AssetStatusPill';

export function AssetCard({
  item,
  selected,
  onSelect,
}: {
  item: AssetCenterViewItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition-colors active:scale-[0.99] ${
        selected
          ? 'border-accent bg-accent/5 shadow-sm'
          : 'border-border bg-surface hover:border-accent/60 hover:bg-surface-hover'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            selected ? 'bg-accent text-white' : 'bg-background text-text-muted'
          }`}
        >
          <FileText className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
              {item.title}
            </h4>
            <AssetStatusPill label={item.statusLabel} tone={item.statusTone} />
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">{item.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] text-text-secondary">
              {item.kindLabel}
            </span>
            <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] text-text-muted">
              {item.sourceLabel}
            </span>
            <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
              {item.scope}
            </span>
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-background px-2 py-0.5 text-[11px] text-text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {item.actions.join(' · ')}
            </span>
            {item.warnings.length > 0 && (
              <span className="inline-flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {item.warnings.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
