import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Users, UserCircle } from 'lucide-react';
import {
  formatINR, todayISO, bucketByPeriod, salesSummary, topProductsFromInvoices,
  topCustomersFromInvoices, performanceByCreator, type ReportGranularity,
} from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/feedback/empty-state';
import { TrendChart } from '@/components/charts/trend-chart';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories } from '@/hooks/use-master-data';
import { useLedgerAggregate } from '@/features/accounting/use-ledger-aggregate';

const PERIODS = 14; // BR-RPT-04: "last 14 periods"

/** Sales Reports (BR-RPT-04, TD §3.7). Scoped to the WORKING LOCATION only — legacy parity, not a
 * cross-location report (Shop Comparison covers that). Finalized invoices only, never drafts. */
export function ReportsPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const locations = useAuthStore((s) => s.locations);
  const currentLocationId = useAuthStore((s) => s.currentLocationId);
  const [granularity, setGranularity] = useState<ReportGranularity>('day');

  const params = useMemo(() => ({
    filters: [
      { field: 'deletedAt', op: '==' as const, value: null },
      { field: 'locationId', op: '==' as const, value: currentLocationId ?? '' },
    ],
    orderByField: 'date' as const,
    direction: 'desc' as const,
    limit: 500,
  }), [currentLocationId]);
  const { items: invoices, loading, error, truncated, refresh } = useLedgerAggregate(repos.invoices, params);

  const today = todayISO();
  const summary = useMemo(() => salesSummary(invoices), [invoices]);
  const trendBuckets = useMemo(() => bucketByPeriod(invoices, (i) => i.date, granularity, PERIODS, today), [invoices, granularity, today]);
  const trendPoints = useMemo(
    () => trendBuckets.map((b) => ({ key: b.period.key, label: b.period.label, value: b.items.reduce((s, i) => s + i.grandTotalPaise, 0) })),
    [trendBuckets],
  );
  const topProducts = useMemo(() => topProductsFromInvoices(invoices, 10), [invoices]);
  const topCustomers = useMemo(() => topCustomersFromInvoices(invoices, 10), [invoices]);
  const performance = useMemo(() => performanceByCreator(invoices, 10), [invoices]);

  const locName = locations.find((l) => l.id === currentLocationId)?.name ?? 'your location';

  if (!currentLocationId) {
    return <EmptyState icon={Package} title="Choose a location" description="Sales Reports are scoped to your current working location." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales Reports"
        description={`Scoped to ${locName} — the working location (BR-RPT-04).`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Invoices" value={String(summary.invoiceCount)} />
        <Stat label="Subtotal" value={formatINR(summary.subtotalPaise)} />
        <Stat label="Discount" value={formatINR(summary.discountPaise)} />
        <Stat label="Tax" value={formatINR(summary.taxPaise)} />
        <Stat label="Grand total" value={formatINR(summary.grandTotalPaise)} strong />
        <Stat label="Outstanding" value={formatINR(summary.outstandingPaise)} />
      </div>

      <SectionCard
        title="Sales trend"
        {...(truncated ? { description: 'Showing the most recent 500 invoices at this location — older history is not included.' } : {})}
        action={
          <Select value={granularity} onValueChange={(v) => setGranularity(v as ReportGranularity)}>
            <SelectTrigger className="w-32" aria-label="Group by"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">By day</SelectItem>
              <SelectItem value="week">By week</SelectItem>
              <SelectItem value="month">By month</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <TrendChart
          data={trendPoints}
          formatValue={(v) => formatINR(v, { withSymbol: false })}
          unitLabel="Sales"
          loading={loading}
          {...(error ? { error, onRetry: refresh } : {})}
          emptyMessage="No sales in the last 14 periods"
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Top products" description="By revenue, from billed line items.">
          {topProducts.length === 0 ? (
            <EmptyState icon={Package} title="No sales yet" />
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Sales</TableHead></TableRow></TableHeader>
              <TableBody>
                {topProducts.map((p) => (
                  <TableRow key={`${p.productId}_${p.variantId}`}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="num text-right">{p.qty}</TableCell>
                    <TableCell className="num text-right">{formatINR(p.totalPaise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard title="Top customers" description="By sales amount.">
          {topCustomers.length === 0 ? (
            <EmptyState icon={Users} title="No sales yet" />
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Bills</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
              <TableBody>
                {topCustomers.map((c) => (
                  <TableRow
                    key={c.customerId ?? 'walkin'}
                    className={c.customerId ? 'cursor-pointer' : undefined}
                    onClick={() => c.customerId && navigate(`/customers/${c.customerId}`)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="num text-right">{c.invoiceCount}</TableCell>
                    <TableCell className="num text-right">{formatINR(c.grandTotalPaise)}</TableCell>
                    <TableCell className="num text-right">{formatINR(c.outstandingPaise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Account performance" description="By billing account — not named-employee performance (TD §3.7).">
        {performance.length === 0 ? (
          <EmptyState icon={UserCircle} title="No sales yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Bills</TableHead><TableHead className="text-right">Sales</TableHead></TableRow></TableHeader>
            <TableBody>
              {performance.map((p) => (
                <TableRow key={p.createdByName}>
                  <TableCell className="font-medium">{p.createdByName}</TableCell>
                  <TableCell className="num text-right">{p.invoiceCount}</TableCell>
                  <TableCell className="num text-right">{formatINR(p.grandTotalPaise)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`num mt-1 ${strong ? 'text-xl font-bold' : 'text-lg font-semibold'}`}>{value}</p>
    </div>
  );
}
