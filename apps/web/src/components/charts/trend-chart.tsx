import { useId, useState } from 'react';
import { Table2, LineChart as LineChartIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { cn } from '@/lib/utils';

export interface TrendPoint {
  key: string;
  label: string;
  value: number;
}

export interface TrendChartProps {
  /** Precomputed points — this component never calculates a total or a trend itself (§40). */
  data: TrendPoint[];
  /** Formats a raw value for the axis/tooltip/table, e.g. formatINR or a plain integer. */
  formatValue: (v: number) => string;
  unitLabel?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  className?: string;
}

/**
 * A single-series trend chart with a text-table fallback (§38/§39: charts must remain
 * understandable without relying on color, and a tabular view must exist). Uses the app's
 * theme-aware --chart-1 token — never a hard-coded color — so it matches Light/Dark/System.
 */
export function TrendChart({ data, formatValue, unitLabel, loading, error, onRetry, emptyMessage, className }: TrendChartProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const gradientId = useId();

  if (loading) {
    return <div className={cn('h-64 animate-pulse rounded-lg bg-muted', className)} aria-hidden="true" />;
  }
  if (error) {
    return <ErrorState message={error} {...(onRetry ? { onRetry } : {})} {...(className ? { className } : {})} />;
  }
  const hasData = data.some((d) => d.value !== 0);
  if (!hasData) {
    return <EmptyState icon={LineChartIcon} title={emptyMessage ?? 'No data for this period'} {...(className ? { className } : {})} />;
  }

  return (
    <div className={className}>
      <div className="mb-2 flex justify-end">
        <div className="inline-flex rounded-md border border-border p-0.5">
          <Button
            type="button"
            variant={view === 'chart' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setView('chart')}
            aria-pressed={view === 'chart'}
          >
            <LineChartIcon className="size-3.5" /> Chart
          </Button>
          <Button
            type="button"
            variant={view === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setView('table')}
            aria-pressed={view === 'table'}
          >
            <Table2 className="size-3.5" /> Table
          </Button>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v: number) => formatValue(v)}
              />
              <Tooltip
                formatter={(v: number) => [formatValue(v), unitLabel ?? 'Value']}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  color: 'hsl(var(--popover-foreground))',
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2} fill={`url(#${gradientId})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-64 overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Period</TableHead><TableHead className="text-right">{unitLabel ?? 'Value'}</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.key}><TableCell>{d.label}</TableCell><TableCell className="num text-right">{formatValue(d.value)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
