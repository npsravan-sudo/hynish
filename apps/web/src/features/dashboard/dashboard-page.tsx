import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReceiptIndianRupee,
  TrendingUp,
  CircleDollarSign,
  Boxes,
  FilePlus2,
  Package,
  ShoppingCart,
  Users,
  ClipboardCheck,
  BarChart3,
} from 'lucide-react';
import {
  formatINR, todayISO, monthKey, addDaysISO, stockStatus, bucketByPeriod, duesSummary,
  type Invoice, type Product, type StockLevel,
} from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { MetricCard, ActionCard, SectionCard } from '@/components/premium';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { TrendChart, type TrendPoint } from '@/components/charts/trend-chart';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboardInvoices } from './use-dashboard-data';
import { useOutstandingInvoiceSource } from '@/features/sales/use-receivables';
import { useProductsById, useStockLevels } from '@/features/inventory/use-inventory-refs';

/**
 * Dashboard (BR-RPT-01/02/03/09, TD §3.1). Today's Sales / Month Sales / Outstanding Dues are
 * ALL-LOCATIONS totals (legacy parity, not scoped to the working location); Low Stock IS scoped to
 * the current location — this asymmetry is deliberate and documented, not a bug (TD §3.1's own
 * "not location-scoped" note for the sales KPIs). The sales trend chart plots amount only — the
 * legacy dashboard's "Number of Bills" trend line was flagged as vestigial dead code (never
 * actually plotted) and is deliberately not reproduced here (§69).
 */
export function DashboardPage() {
  const businessName = useAuthStore((s) => s.businessName);
  const currentLocationId = useAuthStore((s) => s.currentLocationId);
  const locations = useAuthStore((s) => s.locations);
  const [trendDays, setTrendDays] = useState<14 | 30 | 90>(14);

  const { invoices, loading: invLoading, error: invError, refresh: refreshInv } = useDashboardInvoices();
  const { invoices: outstandingSource, loading: duesLoading, error: duesError } = useOutstandingInvoiceSource();
  const { byId: productsById, loading: productsLoading } = useProductsById();
  const { levels, loading: levelsLoading, error: levelsError } = useStockLevels(currentLocationId);

  const today = todayISO();
  const yesterday = addDaysISO(today, -1);
  const thisMonthKey = monthKey(today);
  const lastMonthKey = monthKey(addDaysISO(`${thisMonthKey}-01`, -1));

  const salesKpis = useMemo(() => {
    let todaySales = 0, todayCount = 0, yesterdaySales = 0;
    let thisMonthSales = 0, lastMonthSales = 0;
    for (const inv of invoices) {
      if (inv.date === today) { todaySales += inv.grandTotalPaise; todayCount++; }
      if (inv.date === yesterday) yesterdaySales += inv.grandTotalPaise;
      const mk = monthKey(inv.date);
      if (mk === thisMonthKey) thisMonthSales += inv.grandTotalPaise;
      else if (mk === lastMonthKey) lastMonthSales += inv.grandTotalPaise;
    }
    return { todaySales, todayCount, yesterdaySales, thisMonthSales, lastMonthSales };
  }, [invoices, today, yesterday, thisMonthKey, lastMonthKey]);

  // BR-RPT-01: "vs yesterday %" only shown when yesterday's sales were > 0.
  const vsYesterday = salesKpis.yesterdaySales > 0
    ? Math.round(((salesKpis.todaySales - salesKpis.yesterdaySales) / salesKpis.yesterdaySales) * 100)
    : null;
  const vsLastMonth = salesKpis.lastMonthSales > 0
    ? Math.round(((salesKpis.thisMonthSales - salesKpis.lastMonthSales) / salesKpis.lastMonthSales) * 100)
    : null;

  const dues = useMemo(
    () => duesSummary(outstandingSource, (i) => i.grandTotalPaise, (i) => i.paidPaise, (i) => i.customerId, today),
    [outstandingSource, today],
  );

  const lowStockRows = useMemo(() => {
    return levels
      .map((level) => ({ level, product: productsById.get(level.productId) }))
      .filter((r) => stockStatus(r.level.qty, r.product?.lowStockThreshold ?? null) !== 'healthy');
  }, [levels, productsById]);

  const recentInvoices = invoices.slice(0, 4);

  const trendPoints: TrendPoint[] = useMemo(() => {
    const buckets = bucketByPeriod(invoices, (i) => i.date, 'day', trendDays, today);
    return buckets.map((b) => ({
      key: b.period.key,
      label: b.period.label,
      value: b.items.reduce((s, i) => s + i.grandTotalPaise, 0),
    }));
  }, [invoices, trendDays, today]);

  const greeting = getGreeting();
  const locName = locations.find((l) => l.id === currentLocationId)?.name ?? '';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting}${businessName ? `, ${businessName}` : ''}`}
        description="Your business at a glance."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Today's Sales"
          value={invLoading ? '…' : invError ? '—' : formatINR(salesKpis.todaySales)}
          variant="sales"
          icon={ReceiptIndianRupee}
          hint={invError ? 'Failed to load' : `${salesKpis.todayCount} bill${salesKpis.todayCount === 1 ? '' : 's'} · all locations`}
          {...(vsYesterday !== null && !invLoading && !invError
            ? { delta: { value: `${vsYesterday >= 0 ? '+' : ''}${vsYesterday}%`, direction: vsYesterday >= 0 ? ('up' as const) : ('down' as const) } }
            : {})}
        />
        <MetricCard
          title="This Month"
          value={invLoading ? '…' : invError ? '—' : formatINR(salesKpis.thisMonthSales)}
          variant="revenue"
          icon={TrendingUp}
          hint={invError ? 'Failed to load' : 'vs last month · all locations'}
          {...(vsLastMonth !== null && !invLoading && !invError
            ? { delta: { value: `${vsLastMonth >= 0 ? '+' : ''}${vsLastMonth}%`, direction: vsLastMonth >= 0 ? ('up' as const) : ('down' as const) } }
            : {})}
        />
        <MetricCard
          title="Outstanding Dues"
          value={duesLoading ? '…' : duesError ? '—' : formatINR(dues.totalOutstandingPaise)}
          variant="customer"
          icon={CircleDollarSign}
          hint={duesError ? 'Failed to load' : `${dues.partiesWithDuesCount} customer${dues.partiesWithDuesCount === 1 ? '' : 's'} · all locations`}
        />
        <MetricCard
          title="Low Stock"
          value={levelsLoading || productsLoading ? '…' : levelsError ? '—' : String(lowStockRows.length)}
          variant="inventory"
          icon={Boxes}
          hint={levelsError ? 'Failed to load' : locName ? `At ${locName}` : 'Current location'}
        />
      </div>

      <SectionCard
        title="Sales trend"
        description="Daily total sales, amount only."
        action={
          <Select value={String(trendDays)} onValueChange={(v) => setTrendDays(Number(v) as 14 | 30 | 90)}>
            <SelectTrigger className="w-28" aria-label="Trend window"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <TrendChart
          data={trendPoints}
          formatValue={(v) => formatINR(v, { withSymbol: false })}
          unitLabel="Sales"
          loading={invLoading}
          {...(invError ? { error: invError, onRetry: refreshInv } : {})}
          emptyMessage="No sales in this period"
        />
      </SectionCard>

      <SectionCard title="Quick actions" description="Jump straight into common tasks.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ActionCard title="New Bill" description="Create an invoice" icon={FilePlus2} to="/sales/new" />
          <ActionCard title="Products" description="Manage catalogue" icon={Package} to="/inventory/products" />
          <ActionCard title="New Purchase" description="Record stock in" icon={ShoppingCart} to="/inventory/purchases" />
          <ActionCard title="Customers" description="View customers" icon={Users} to="/customers" />
          <ActionCard title="Stock Count" description="Reconcile stock" icon={ClipboardCheck} to="/inventory/stock-count" />
          <ActionCard title="Reports" description="Sales & performance" icon={BarChart3} to="/reports" />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Recent invoices">
          {invLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : invError ? (
            <ErrorState message={invError} onRetry={refreshInv} />
          ) : recentInvoices.length === 0 ? (
            <EmptyState icon={ReceiptIndianRupee} title="No invoices yet" description="Recent bills will appear here once billing is live." />
          ) : (
            <RecentInvoicesTable invoices={recentInvoices} />
          )}
        </SectionCard>
        <SectionCard title="Low stock">
          {levelsLoading || productsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : levelsError ? (
            <ErrorState message={levelsError} />
          ) : lowStockRows.length === 0 ? (
            <EmptyState icon={Boxes} title="Nothing to reorder" description="Low-stock items at your current location will show here." />
          ) : (
            <LowStockTable rows={lowStockRows.slice(0, 4)} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function RecentInvoicesTable({ invoices }: { invoices: Invoice[] }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-2">
      {invoices.map((inv) => (
        <button
          key={inv.id}
          type="button"
          onClick={() => navigate(`/sales/invoices/${inv.id}`)}
          className="flex items-center justify-between rounded-md border border-border p-3 text-left text-sm transition hover:bg-accent"
        >
          <span><span className="num font-medium">{inv.number}</span> · {inv.customerSnapshot?.name ?? 'Cash sale'} · {inv.date}</span>
          <span className="num">{formatINR(inv.grandTotalPaise)}</span>
        </button>
      ))}
    </div>
  );
}

function LowStockTable({ rows }: { rows: { level: StockLevel; product: Product | undefined }[] }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <button
          key={`${r.level.productId}_${r.level.variantId}`}
          type="button"
          onClick={() => navigate(`/inventory/stock/${r.level.productId}`)}
          className="flex items-center justify-between rounded-md border border-border p-3 text-left text-sm transition hover:bg-accent"
        >
          <span className="truncate font-medium">{r.product?.name ?? r.level.productId}</span>
          <span className="num text-muted-foreground">{r.level.qty} in stock</span>
        </button>
      ))}
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
