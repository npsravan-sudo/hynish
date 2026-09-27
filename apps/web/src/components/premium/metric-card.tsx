import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { GradientCard } from './gradient-card';
import type { GradientVariant } from './gradient';

export interface MetricCardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  /** When set, renders as a premium gradient card; otherwise a neutral surface. */
  variant?: GradientVariant;
  delta?: { value: string; direction: 'up' | 'down' | 'neutral' };
  hint?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * KPI metric card (Phase 1 §21, §49). Example:
 *   <MetricCard title="Today's Sales" value="₹84,250" variant="sales" />
 */
export function MetricCard({
  title,
  value,
  icon: Icon,
  variant,
  delta,
  hint,
  className,
  children,
}: MetricCardProps) {
  const gradient = Boolean(variant);
  const Body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={cn('text-sm font-medium', gradient ? 'text-white/80' : 'text-muted-foreground')}>
          {title}
        </p>
        {Icon && (
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-xl',
              gradient ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary',
            )}
          >
            <Icon className="size-5" />
          </span>
        )}
      </div>
      <p className={cn('num mt-3 text-3xl font-extrabold tracking-tight', gradient && 'text-white')}>
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold',
              gradient
                ? 'text-white/90'
                : delta.direction === 'up'
                  ? 'text-success'
                  : delta.direction === 'down'
                    ? 'text-danger'
                    : 'text-muted-foreground',
            )}
          >
            {delta.direction === 'up' && <ArrowUpRight className="size-3.5" />}
            {delta.direction === 'down' && <ArrowDownRight className="size-3.5" />}
            {delta.value}
          </span>
        )}
        {hint && (
          <span className={cn('text-xs', gradient ? 'text-white/70' : 'text-muted-foreground')}>{hint}</span>
        )}
      </div>
      {children}
    </>
  );

  if (gradient && variant) {
    return <GradientCard variant={variant} className={className}>{Body}</GradientCard>;
  }
  return <Card className={cn('p-5 sm:p-6', className)}>{Body}</Card>;
}
