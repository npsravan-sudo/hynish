import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart } from 'lucide-react';
import { formatINR, outstandingOf, type Purchase, type PaymentStatus } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataList, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';
import { clientSearch } from '@/features/_shared/master-data';

const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 25, filters: [{ field: 'deletedAt', op: '==', value: null }] };
const STATUS_VARIANT: Record<PaymentStatus, 'success' | 'info' | 'secondary'> = { paid: 'success', partial: 'info', unpaid: 'secondary' };

export function PurchaseListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const can = useAuthStore((s) => s.hasPermission);
  const [search, setSearch] = useState('');
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.purchases, useMemo(() => PARAMS, []));
  const filtered = clientSearch(items, search, (p) => [p.supplierBillNo, p.supplierSnapshot?.name ?? '']);

  const columns: Column<Purchase>[] = [
    { header: 'Bill / Supplier', cell: (p) => (
      <div className="flex flex-col">
        <span className="font-medium">{p.supplierSnapshot?.name || '—'}</span>
        <span className="num text-xs text-muted-foreground">{p.supplierBillNo || p.date}</span>
      </div>
    ) },
    { header: 'Date', cell: (p) => p.date },
    { header: 'Total', align: 'right', cell: (p) => <span className="num">{formatINR(p.totalPaise)}</span> },
    { header: 'Outstanding', align: 'right', cell: (p) => <span className="num">{formatINR(outstandingOf(p.totalPaise, p.paidPaise))}</span> },
    { header: 'Status', cell: (p) => <Badge variant={STATUS_VARIANT[p.paymentStatus]} className="capitalize">{p.paymentStatus}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Purchases"
        description="Supplier purchases. Each posts stock-in and the purchase journal."
        actions={can('purchases.manage') && <Button onClick={() => navigate('/inventory/purchases/new')}><Plus /> New Purchase</Button>}
        filters={<ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search supplier, bill no…" />}
      />
      <DataList
        items={filtered}
        getRowId={(p) => p.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search}
        onLoadMore={loadMore}
        onRowClick={(p) => navigate(`/inventory/purchases/${p.id}`)}
        empty={{
          icon: ShoppingCart,
          title: search ? 'No matching purchases' : 'No purchases yet',
          description: search ? 'Try a different search.' : 'Record your first purchase to add stock.',
          action: can('purchases.manage') && !search ? <Button onClick={() => navigate('/inventory/purchases/new')}><Plus /> New Purchase</Button> : undefined,
        }}
        renderCard={(p) => (
          <Card className="p-4" onClick={() => navigate(`/inventory/purchases/${p.id}`)}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-semibold">{p.supplierSnapshot?.name || '—'}</p><p className="text-xs text-muted-foreground">{p.supplierBillNo || p.date}</p></div>
              <div className="text-right"><p className="num font-semibold">{formatINR(p.totalPaise)}</p><Badge variant={STATUS_VARIANT[p.paymentStatus]} className="capitalize">{p.paymentStatus}</Badge></div>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
