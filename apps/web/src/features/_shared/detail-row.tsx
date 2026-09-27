import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Label/value row for detail views (§45). Renders an em-dash when empty. */
export function DetailRow({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{empty ? <span className="text-muted-foreground">—</span> : value}</span>
    </div>
  );
}
