import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, SlidersHorizontal, ArrowLeftRight, ClipboardCheck } from 'lucide-react';
import { stockStatus, type Product, type StockLevel, type StockStatus } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DataList, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { useAuthStore } from '@/stores/auth-store';
import { clientSearch } from '@/features/_shared/master-data';
import { useProductsById, useStockLevels } from './use-inventory-refs';
import { AdjustDialog, type AdjustTarget } from './adjust-dialog';

const STATUS_VARIANT: Record<StockStatus, 'danger' | 'warning' | 'success'> = { out: 'danger', low: 'warning', healthy: 'success' };
interface Row { level: StockLevel; product: Product | undefined; status: StockStatus }

export function StockListPage() {
  const navigate = useNavigate();
  const locations = useAuthStore((s) => s.locations);
  const currentLocationId = useAuthStore((s) => s.currentLocationId);
  const canAdjust = useAuthStore((s) => s.hasPermission('stock.adjust'));
  const [locationId, setLocationId] = useState(currentLocationId ?? locations[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | StockStatus | 'lowout'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [adjust, setAdjust] = useState<AdjustTarget | null>(null);

  const { byId } = useProductsById();
  const { levels, loading, error } = useStockLevels(locationId, refreshKey);

  const rows = useMemo<Row[]>(() => levels.map((level) => {
    const product = byId.get(level.productId);
    return { level, product, status: stockStatus(level.qty, product?.lowStockThreshold ?? null) };
  }), [levels, byId]);

  const filtered = useMemo(() => {
    let list = rows;
    if (status === 'lowout') list = list.filter((r) => r.status !== 'healthy');
    else if (status !== 'all') list = list.filter((r) => r.status === status);
    return clientSearch(list, search, (r) => [r.product?.name ?? '', r.product?.barcode ?? '']);
  }, [rows, status, search]);

  const columns: Column<Row>[] = [
    { header: 'Product', cell: (r) => (
      <div className="flex flex-col">
        <span className="font-medium">{r.product?.name ?? r.level.productId}</span>
        {r.product?.hasVariants && r.level.variantId !== 'default' && <span className="text-xs text-muted-foreground">{r.level.variantId}</span>}
      </div>
    ) },
    { header: 'Unit', cell: (r) => r.product?.unit ?? '—' },
    { header: 'In stock', align: 'right', cell: (r) => <span className="num font-medium">{r.level.qty}</span> },
    { header: 'Status', cell: (r) => <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">{r.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stock"
        description="On-hand quantity per product at the selected location. Balances come from the movement ledger."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/inventory/transfers')}><ArrowLeftRight /> Transfer</Button>
            <Button variant="outline" onClick={() => navigate('/inventory/stock-count')}><ClipboardCheck /> Count</Button>
          </div>
        }
        filters={
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search product, code…"
            filters={
              <>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="w-44" aria-label="Location"><SelectValue placeholder="Location" /></SelectTrigger>
                  <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="w-36" aria-label="Stock status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="lowout">Low or out</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="out">Out of stock</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />
        }
      />
      <DataList
        items={filtered}
        getRowId={(r) => `${r.level.productId}_${r.level.variantId}`}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={() => setRefreshKey((k) => k + 1)}
        onRowClick={(r) => navigate(`/inventory/stock/${r.level.productId}`)}
        rowActions={(r) => (canAdjust && r.product ? (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setAdjust({ product: r.product!, variantId: r.level.variantId, locationId, currentQty: r.level.qty }); }}>
            <SlidersHorizontal className="size-4" /> Adjust
          </Button>
        ) : null)}
        empty={{ icon: Warehouse, title: search ? 'No matching stock' : 'No stock yet', description: search ? 'Try a different search.' : 'Record a purchase or opening stock to populate this location.' }}
        renderCard={(r) => (
          <Card className="p-4" onClick={() => navigate(`/inventory/stock/${r.level.productId}`)}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-semibold">{r.product?.name ?? r.level.productId}</p><p className="text-xs text-muted-foreground">{r.product?.unit ?? ''}</p></div>
              <div className="text-right"><p className="num font-semibold">{r.level.qty}</p><Badge variant={STATUS_VARIANT[r.status]} className="capitalize">{r.status}</Badge></div>
            </div>
          </Card>
        )}
      />
      {adjust && <AdjustDialog target={adjust} open={!!adjust} onOpenChange={(o) => !o && setAdjust(null)} onDone={() => setRefreshKey((k) => k + 1)} />}
    </div>
  );
}
