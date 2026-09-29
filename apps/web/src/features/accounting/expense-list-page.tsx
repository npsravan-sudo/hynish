import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Receipt, Sparkles } from 'lucide-react';
import {
  formatINR, todayISO, monthKey, bucketByPeriod, expenseKpis, expensesByCategory,
  type Expense, type ExpenseCategory, type ReportGranularity,
} from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DataList, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { EmptyState } from '@/components/feedback/empty-state';
import { TrendChart } from '@/components/charts/trend-chart';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, useAccountingService } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';
import { clientSearch } from '@/features/_shared/master-data';
import { mapCallableError } from '@/lib/errors';
import { useLedgerAggregate } from './use-ledger-aggregate';

const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 25, filters: [{ field: 'deletedAt', op: '==', value: null }] };

/** Daily Expenses (BR-EXP-01..04, TD §6.4). Scoped to the working location, the same as the source. */
export function ExpenseListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useAccountingService();
  const locations = useAuthStore((s) => s.locations);
  const currentLocationId = useAuthStore((s) => s.currentLocationId);
  const can = useAuthStore((s) => s.hasPermission);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<'all' | string>('all');
  const [locationId, setLocationId] = useState<'all' | string>('all');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [granularity, setGranularity] = useState<ReportGranularity>('day');

  // BR-EXP-03: KPIs/trend/category breakdown are scoped to the WORKING location, separate from
  // the filterable list above (which defaults to all locations, per the note in PHASE-8 docs).
  const analyticsParams = useMemo(() => ({
    filters: [{ field: 'deletedAt', op: '==' as const, value: null }, { field: 'locationId', op: '==' as const, value: currentLocationId ?? '' }],
    orderByField: 'date' as const, limit: 1000,
  }), [currentLocationId]);
  const { items: locationExpenses, loading: analyticsLoading } = useLedgerAggregate(repos.expenses, analyticsParams);
  const today = todayISO();
  const kpis = useMemo(() => expenseKpis(locationExpenses, today), [locationExpenses, today]);
  const byCategory = useMemo(() => expensesByCategory(locationExpenses), [locationExpenses]);

  // "Net This Month" = this month's sales − this month's expenses, at the working location
  // (TD §6.4). Bounded to the current month only, so this stays a cheap, single extra query.
  const thisMonthKey = monthKey(today);
  const salesParams = useMemo(() => ({
    filters: [
      { field: 'deletedAt', op: '==' as const, value: null },
      { field: 'locationId', op: '==' as const, value: currentLocationId ?? '' },
      { field: 'date', op: '>=' as const, value: `${thisMonthKey}-01` },
    ],
    orderByField: 'date' as const, limit: 1000,
  }), [currentLocationId, thisMonthKey]);
  const { items: monthInvoices, loading: salesLoading } = useLedgerAggregate(repos.invoices, salesParams);
  const thisMonthSalesPaise = useMemo(() => monthInvoices.reduce((s, i) => s + i.grandTotalPaise, 0), [monthInvoices]);
  const netThisMonthPaise = thisMonthSalesPaise - kpis.thisMonthPaise;
  const trendPoints = useMemo(() => {
    const buckets = bucketByPeriod(locationExpenses, (e) => e.date, granularity, 14, today);
    return buckets.map((b) => ({ key: b.period.key, label: b.period.label, value: b.items.reduce((s, e) => s + e.amountPaise, 0) }));
  }, [locationExpenses, granularity, today]);
  const currentLocationName = locations.find((l) => l.id === currentLocationId)?.name ?? '';

  useEffect(() => {
    let cancelled = false;
    void repos.expenseCategories.list({ orderByField: 'name', direction: 'asc', limit: 200, filters: [{ field: 'deletedAt', op: '==', value: null }] })
      .then((p) => { if (!cancelled) { setCategories(p.items); setCategoriesLoaded(true); } }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [repos]);

  async function seedCategories() {
    setSeeding(true);
    try {
      await service.expenses.seedCategories();
      const p = await repos.expenseCategories.list({ orderByField: 'name', direction: 'asc', limit: 200, filters: [{ field: 'deletedAt', op: '==', value: null }] });
      setCategories(p.items);
      toast.success('Default expense categories created');
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setSeeding(false);
    }
  }

  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.expenses, useMemo(() => PARAMS, []));

  const filtered = useMemo(() => {
    let list = items;
    if (categoryId !== 'all') list = list.filter((e) => e.categoryId === categoryId);
    if (locationId !== 'all') list = list.filter((e) => e.locationId === locationId);
    return clientSearch(list, search, (e) => [e.categoryNameSnapshot, e.notes]);
  }, [items, categoryId, locationId, search]);

  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  const columns: Column<Expense>[] = [
    { header: 'Date', cell: (e) => e.date },
    { header: 'Category', cell: (e) => <span className="font-medium">{e.categoryNameSnapshot}</span> },
    { header: 'Location', cell: (e) => locName(e.locationId) },
    { header: 'Mode', cell: (e) => e.mode },
    { header: 'Amount', align: 'right', cell: (e) => <span className="num">{formatINR(e.amountPaise)}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expenses"
        description="Daily expenses by category (BR-EXP-01). Each posts Dr the category account / Cr Cash-or-Bank."
        actions={
          <div className="flex items-center gap-2">
            {can('expenses.manage') && categoriesLoaded && categories.length === 0 && (
              <Button variant="outline" onClick={() => void seedCategories()} loading={seeding}><Sparkles /> Seed categories</Button>
            )}
            {can('expenses.manage') && <Button onClick={() => navigate('/accounting/expenses/new')}><Plus /> New Expense</Button>}
          </div>
        }
        filters={
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search category, notes…"
            filters={
              <>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-44" aria-label="Category filter"><SelectValue placeholder="All categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="w-40" aria-label="Location filter"><SelectValue placeholder="All locations" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            }
          />
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Today" value={formatINR(kpis.todayPaise)} />
        <Stat label="Last 7 days" value={formatINR(kpis.last7DaysPaise)} />
        <Stat label="This month" value={formatINR(kpis.thisMonthPaise)} strong />
        <Stat
          label="Net this month"
          value={(salesLoading ? '…' : formatINR(netThisMonthPaise))}
          strong
          className={netThisMonthPaise >= 0 ? 'text-success' : 'text-danger'}
        />
      </div>

      <SectionCard
        title="Spend trend"
        description={currentLocationName ? `At ${currentLocationName} — last 14 periods.` : 'Last 14 periods.'}
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
        <TrendChart data={trendPoints} formatValue={(v) => formatINR(v, { withSymbol: false })} unitLabel="Spend" loading={analyticsLoading} emptyMessage="No expenses in the last 14 periods" />
      </SectionCard>

      <SectionCard title="By category" description="All-time, at the working location.">
        {byCategory.length === 0 ? (
          <EmptyState icon={Receipt} title="No expenses yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {byCategory.map((c) => (
                <TableRow key={c.categoryId}><TableCell className="font-medium">{c.categoryName}</TableCell><TableCell className="num text-right">{formatINR(c.totalPaise)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <DataList
        items={filtered}
        getRowId={(e) => e.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search && categoryId === 'all' && locationId === 'all'}
        onLoadMore={loadMore}
        onRowClick={(e) => navigate(`/accounting/expenses/${e.id}`)}
        empty={{
          icon: Receipt,
          title: search ? 'No matching expenses' : 'No expenses yet',
          description: search ? 'Try a different search.' : 'Log your first expense to start tracking spend.',
          action: can('expenses.manage') && !search ? <Button onClick={() => navigate('/accounting/expenses/new')}><Plus /> New Expense</Button> : undefined,
        }}
        renderCard={(e) => (
          <Card className="p-4" onClick={() => navigate(`/accounting/expenses/${e.id}`)}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-semibold">{e.categoryNameSnapshot}</p><p className="text-xs text-muted-foreground">{locName(e.locationId)} · {e.date}</p></div>
              <div className="text-right"><p className="num font-semibold">{formatINR(e.amountPaise)}</p><p className="text-xs text-muted-foreground">{e.mode}</p></div>
            </div>
          </Card>
        )}
      />
    </div>
  );
}

function Stat({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`num mt-1 ${strong ? 'text-xl font-bold' : 'text-lg font-semibold'} ${className ?? ''}`}>{value}</p>
    </div>
  );
}
