import type { ReactNode } from 'react';

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border-muted px-4 py-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
          {description && <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
