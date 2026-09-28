import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { STOCK_MOVEMENT_TYPES, type StockMovement, type StockMovementType } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
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
import { useProductsById } from './use-inventory-refs';

export function MovementHistoryPage() {
  const locations = useAuthStore((s) => s.locations);
  const repos = useRepositories();
  const { byId } = useProductsById();
  const [locationId, setLocationId] = useState<string>(locations[0]?.id ?? '');
  const [type, setType] = useState<'all' | StockMovementType>('all');
  const [search, setSearch] = useState('');

  const params = useMemo<ListParams>(() => ({
    orderByField: 'date', direction: 'desc', limit: 25,
    filters: locationId ? [{ field: 'locationId', op: '==', value: locationId }] : [],
  }), [locationId]);
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.stockMovements, params);

  const filtered = useMemo(() => {
    let list = items;
    if (type !== 'all') list = list.filter((m) => m.type === type);
    return clientSearch(list, search, (m) => [byId.get(m.productId)?.name ?? '', m.type, m.note]);
  }, [items, type, search, byId]);

  const columns: Column<StockMovement>[] = [
    { header: 'Date', cell: (m) => m.date },
    { header: 'Product', cell: (m) => byId.get(m.productId)?.name ?? m.productId },
    { header: 'Type', cell: (m) => <Badge variant="secondary" className="whitespace-nowrap">{m.type.replace(/_/g, ' ')}</Badge> },
    { header: 'Change', align: 'right', cell: (m) => <span className={`num ${m.qtyChange < 0 ? 'text-danger' : 'text-success'}`}>{m.qtyChange > 0 ? '+' : ''}{m.qtyChange}</span> },
    { header: 'Balance', align: 'right', cell: (m) => <span className="num">{m.qtyAfter}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stock Movements"
        description="The append-only inventory ledger. Every stock change is recorded here and never edited."
        filters={
          <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search product, note…"
            filters={
              <>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="w-44" aria-label="Location"><SelectValue placeholder="Location" /></SelectTrigger>
                  <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger className="w-40" aria-label="Movement type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {STOCK_MOVEMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            }
          />
        }
      />
      <DataList
        items={filtered}
        getRowId={(m) => m.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search && type === 'all'}
        onLoadMore={loadMore}
        empty={{ icon: History, title: 'No movements', description: 'Stock movements appear here as purchases, sales, transfers and adjustments happen.' }}
        renderCard={(m) => (
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-semibold">{byId.get(m.productId)?.name ?? m.productId}</p><p className="text-xs text-muted-foreground">{m.date} · {m.type.replace(/_/g, ' ')}</p></div>
              <div className="text-right"><p className={`num font-semibold ${m.qtyChange < 0 ? 'text-danger' : 'text-success'}`}>{m.qtyChange > 0 ? '+' : ''}{m.qtyChange}</p><p className="num text-xs text-muted-foreground">bal {m.qtyAfter}</p></div>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
