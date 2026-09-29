import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Receipt, Sparkles } from 'lucide-react';
import { formatINR, type Expense, type ExpenseCategory } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DataList, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, useAccountingService } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';
import { clientSearch } from '@/features/_shared/master-data';
import { mapCallableError } from '@/lib/errors';

const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 25, filters: [{ field: 'deletedAt', op: '==', value: null }] };

/** Daily Expenses (BR-EXP-01..04, TD §6.4). Scoped to the working location, the same as the source. */
export function ExpenseListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useAccountingService();
  const locations = useAuthStore((s) => s.locations);
  const can = useAuthStore((s) => s.hasPermission);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<'all' | string>('all');
  const [locationId, setLocationId] = useState<'all' | string>('all');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [seeding, setSeeding] = useState(false);

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
