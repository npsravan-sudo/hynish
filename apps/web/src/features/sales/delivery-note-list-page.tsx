import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Truck } from 'lucide-react';
import { formatINR, type DeliveryNote, type DeliveryNoteStatus } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DataList, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';
import { clientSearch } from '@/features/_shared/master-data';

const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 25, filters: [{ field: 'deletedAt', op: '==', value: null }] };
const STATUS_VARIANT: Record<DeliveryNoteStatus, 'info' | 'success' | 'secondary'> = { pending: 'info', invoiced: 'success', returned: 'secondary' };

/** Delivery Notes (BR-DN-01..09, TD §5.5): goods leaving the shop before a tax invoice — stock out
 * immediately, no GST, no journal entry (BR-DN-09). */
export function DeliveryNoteListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const can = useAuthStore((s) => s.hasPermission);
  const canManage = can('deliveryNotes.manage');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | DeliveryNoteStatus>('all');
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.deliveryNotes, useMemo(() => PARAMS, []));

  const filtered = useMemo(() => {
    let list = items;
    if (status !== 'all') list = list.filter((d) => d.status === status);
    return clientSearch(list, search, (d) => [d.number, d.customerSnapshot?.name ?? '']);
  }, [items, status, search]);

  const columns: Column<DeliveryNote>[] = [
    { header: 'Number', cell: (d) => (
      <div className="flex flex-col"><span className="num font-medium">{d.number}</span><span className="text-xs text-muted-foreground">{d.date}</span></div>
    ) },
    { header: 'Customer', cell: (d) => d.customerSnapshot?.name || <span className="text-muted-foreground">—</span> },
    { header: 'Reference value', align: 'right', cell: (d) => <span className="num">{formatINR(d.referenceValuePaise)}</span> },
    { header: 'Status', cell: (d) => <Badge variant={STATUS_VARIANT[d.status]} className="capitalize">{d.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Delivery Notes"
        description="Goods dispatched before a tax invoice is raised. No GST, no accounting entry (BR-DN-02/09)."
        actions={canManage && <Button onClick={() => navigate('/sales/delivery-notes/new')}><Plus /> New Delivery Note</Button>}
        filters={
          <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search number, customer…"
            filters={
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-36" aria-label="Status filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        }
      />
      <DataList
        items={filtered}
        getRowId={(d) => d.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search && status === 'all'}
        onLoadMore={loadMore}
        onRowClick={(d) => navigate(`/sales/delivery-notes/${d.id}`)}
        empty={{
          icon: Truck,
          title: search ? 'No matching delivery notes' : 'No delivery notes yet',
          description: search ? 'Try a different search.' : 'Create one when goods leave before a tax invoice is raised.',
          action: canManage && !search ? <Button onClick={() => navigate('/sales/delivery-notes/new')}><Plus /> New Delivery Note</Button> : undefined,
        }}
        renderCard={(d) => (
          <Card className="p-4" onClick={() => navigate(`/sales/delivery-notes/${d.id}`)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="num truncate font-semibold">{d.number}</p>
                <p className="text-xs text-muted-foreground">{d.customerSnapshot?.name || '—'} · {d.date}</p>
              </div>
              <Badge variant={STATUS_VARIANT[d.status]} className="capitalize">{d.status}</Badge>
            </div>
            <div className="mt-3 text-xs"><span className="num text-muted-foreground">{formatINR(d.referenceValuePaise)}</span></div>
          </Card>
        )}
      />
    </div>
  );
}
