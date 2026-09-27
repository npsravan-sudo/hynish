import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primary + secondary actions. Stack below the title on mobile (Phase 1 §43). */
  actions?: React.ReactNode;
  /** Optional filter row rendered under the header. */
  filters?: React.ReactNode;
  className?: string;
}

/** Reusable page header (Phase 1 §42–§43). Responsive: actions stack on mobile. */
export function PageHeader({ title, description, actions, filters, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
    </div>
  );
}
