import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 px-6 py-10 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-background text-text-muted">
        <Inbox className="h-5 w-5" />
      </div>
      <h4 className="mt-3 text-sm font-semibold text-text-primary">{title}</h4>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
