import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileSpreadsheet } from 'lucide-react';
import { formatINR, type Quotation, type QuotationStatus } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DataList, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { RowActions, type RowAction } from '@/components/data/row-actions';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';
import { clientSearch } from '@/features/_shared/master-data';

const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 25, filters: [{ field: 'deletedAt', op: '==', value: null }] };
const STATUS_VARIANT: Record<QuotationStatus, 'info' | 'success'> = { open: 'info', converted: 'success' };

export function QuotationListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const can = useAuthStore((s) => s.hasPermission);
  const canManage = can('quotations.manage');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | QuotationStatus>('all');
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.quotations, useMemo(() => PARAMS, []));

  const filtered = useMemo(() => {
    let list = items;
    if (status !== 'all') list = list.filter((q) => q.status === status);
    return clientSearch(list, search, (q) => [q.number, q.customerSnapshot?.name ?? '']);
  }, [items, status, search]);

  function actionsFor(q: Quotation): RowAction[] {
    const a: RowAction[] = [{ label: 'View', icon: 'view', onSelect: () => navigate(`/sales/quotations/${q.id}`) }];
    if (canManage && q.status === 'open') a.push({ label: 'Edit', icon: 'edit', onSelect: () => navigate(`/sales/quotations/${q.id}/edit`) });
    return a;
  }

  const columns: Column<Quotation>[] = [
    { header: 'Number', cell: (q) => (
      <div className="flex flex-col"><span className="num font-medium">{q.number}</span><span className="text-xs text-muted-foreground">{q.date}</span></div>
    ) },
    { header: 'Customer', cell: (q) => q.customerSnapshot?.name || <span className="text-muted-foreground">—</span> },
    { header: 'Total', align: 'right', cell: (q) => <span className="num">{formatINR(q.grandTotalPaise)}</span> },
    { header: 'Status', cell: (q) => <Badge variant={STATUS_VARIANT[q.status]} className="capitalize">{q.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quotations"
        description="Priced offers you can later convert into a bill."
        actions={canManage && <Button onClick={() => navigate('/sales/quotations/new')}><Plus /> New Quotation</Button>}
        filters={
          <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search number, customer…"
            filters={
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-36" aria-label="Status filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        }
      />
      <DataList
        items={filtered}
        getRowId={(q) => q.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search && status === 'all'}
        onLoadMore={loadMore}
        onRowClick={(q) => navigate(`/sales/quotations/${q.id}`)}
        rowActions={(q) => <RowActions actions={actionsFor(q)} />}
        empty={{
          icon: FileSpreadsheet,
          title: search ? 'No matching quotations' : 'No quotations yet',
          description: search ? 'Try a different search.' : 'Prepare a quotation to share a priced offer.',
          action: canManage && !search ? <Button onClick={() => navigate('/sales/quotations/new')}><Plus /> New Quotation</Button> : undefined,
        }}
        renderCard={(q) => (
          <Card className="p-4" onClick={() => navigate(`/sales/quotations/${q.id}`)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="num truncate font-semibold">{q.number}</p>
                <p className="text-xs text-muted-foreground">{q.customerSnapshot?.name || '—'} · {q.date}</p>
              </div>
              <div onClick={(e) => e.stopPropagation()}><RowActions actions={actionsFor(q)} /></div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="num text-muted-foreground">{formatINR(q.grandTotalPaise)}</span>
              <Badge variant={STATUS_VARIANT[q.status]} className="ml-auto capitalize">{q.status}</Badge>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
