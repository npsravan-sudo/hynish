import { useMemo, useState } from 'react';
import { Scale } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatINR, todayISO } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories } from '@/hooks/use-master-data';
import { useLedgerAggregate } from '@/features/accounting/use-ledger-aggregate';
import { useAllAccounts } from '@/features/accounting/use-accounts';
import { shopComparisonRows } from './shop-comparison-helpers';

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Shop Comparison (BR-ACC-20/21, TD §3.5). Cross-location performance from the SAME double-entry
 * ledger as the accounting statements — not raw invoice sums (except bill count) — so it can never
 * disagree with Trial Balance/P&L for the same period (§60/§61). All locations, all-time by
 * default range is month-to-date, matching the legacy default.
 */
export function ShopComparisonPage() {
  const repos = useRepositories();
  const locations = useAuthStore((s) => s.locations);
  const { accounts, loading: accountsLoading } = useAllAccounts();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());

  const journalParams = useMemo(() => ({
    filters: [
      { field: 'status', op: '==' as const, value: 'posted' },
      { field: 'date', op: '>=' as const, value: from },
      { field: 'date', op: '<=' as const, value: to },
    ],
    orderByField: 'date' as const,
    limit: 500,
  }), [from, to]);
  const { items: entries, loading: entriesLoading, error: entriesError, truncated, refresh } = useLedgerAggregate(repos.journalEntries, journalParams);

  const invoiceParams = useMemo(() => ({
    filters: [
      { field: 'deletedAt', op: '==' as const, value: null },
      { field: 'date', op: '>=' as const, value: from },
      { field: 'date', op: '<=' as const, value: to },
    ],
    orderByField: 'date' as const,
    limit: 2000,
  }), [from, to]);
  const { items: invoices, loading: invoicesLoading } = useLedgerAggregate(repos.invoices, invoiceParams);

  const { rows, combined } = useMemo(
    () => shopComparisonRows(entries, accounts, invoices, locations),
    [entries, accounts, invoices, locations],
  );

  const loading = accountsLoading || entriesLoading || invoicesLoading;
  const chartData = rows.map((r) => ({ name: r.name, Sales: r.salesPaise / 100, 'Gross Profit': r.grossProfitPaise / 100, 'Net Profit': r.netProfitPaise / 100 }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Shop Comparison" description="Per-location performance from the accounting ledger (BR-ACC-20)." />

      <SectionCard title="Period">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="From" htmlFor="sc-from"><Input id="sc-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" htmlFor="sc-to"><Input id="sc-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      </SectionCard>

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : entriesError ? (
        <ErrorState message={entriesError} onRetry={refresh} />
      ) : locations.length === 0 ? (
        <EmptyState icon={Scale} title="No locations" />
      ) : (
        <>
          <SectionCard title="Sales, Gross Profit & Net Profit by location" {...(truncated ? { description: 'The ledger for this period is large — figures may be incomplete.' } : {})}>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => formatINR(Math.round(v * 100), { withSymbol: false })} />
                  <Tooltip
                    formatter={(v: number) => formatINR(Math.round(v * 100))}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--popover-foreground))', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Sales" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gross Profit" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Net Profit" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="Comparison table">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Bills</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Gross Profit</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net Profit</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.locationId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="num text-right">{r.billCount}</TableCell>
                      <TableCell className="num text-right">{formatINR(r.salesPaise)}</TableCell>
                      <TableCell className="num text-right">{formatINR(r.cogsPaise)}</TableCell>
                      <TableCell className="num text-right">{formatINR(r.grossProfitPaise)}</TableCell>
                      <TableCell className="num text-right">{formatINR(r.expenseTotalPaise)}</TableCell>
                      <TableCell className={`num text-right font-medium ${r.netProfitPaise >= 0 ? 'text-success' : 'text-danger'}`}>{formatINR(r.netProfitPaise)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-border font-semibold">
                    <TableCell>{combined.name}</TableCell>
                    <TableCell className="num text-right">{combined.billCount}</TableCell>
                    <TableCell className="num text-right">{formatINR(combined.salesPaise)}</TableCell>
                    <TableCell className="num text-right">{formatINR(combined.cogsPaise)}</TableCell>
                    <TableCell className="num text-right">{formatINR(combined.grossProfitPaise)}</TableCell>
                    <TableCell className="num text-right">{formatINR(combined.expenseTotalPaise)}</TableCell>
                    <TableCell className={`num text-right ${combined.netProfitPaise >= 0 ? 'text-success' : 'text-danger'}`}>{formatINR(combined.netProfitPaise)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
