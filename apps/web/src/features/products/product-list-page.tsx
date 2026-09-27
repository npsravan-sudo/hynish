import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';
import type { Product } from '@hynish/domain';
import { formatINR } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DataList, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { RowActions, type RowAction } from '@/components/data/row-actions';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, useMasterDataService } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { mapCallableError } from '@/lib/errors';
import { listParamsFor, clientSearch, ActiveBadge, isArchived, type StatusFilter } from '@/features/_shared/master-data';
import { useCategoryOptions } from './use-categories';

function gstLabel(bp: number): string {
  return `${bp / 100}%`;
}

export function ProductListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useMasterDataService();
  const can = useAuthStore((s) => s.hasPermission);
  const canManage = can('products.manage');
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<StatusFilter>('active');
  const [category, setCategory] = useState<string>(searchParams.get('category') ?? 'all');
  const [search, setSearch] = useState('');
  const categoryOptions = useCategoryOptions();

  const params = useMemo(() => listParamsFor(status), [status]);
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.products, params);

  const byCategory = category === 'all' ? items : items.filter((p) => p.category === category);
  const filtered = clientSearch(byCategory, search, (p) => [p.name, p.category, p.hsn, p.barcode]);

  async function toggleActive(p: Product) {
    const activate = isArchived(p);
    if (!activate) {
      const ok = await confirm({
        title: `Archive ${p.name}?`,
        description: 'Stock and past invoices keep their details. You can restore the product later.',
        confirmLabel: 'Archive',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await service.products.setActive(p.id, activate);
      toast.success(activate ? 'Product restored' : 'Product archived');
      refresh();
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  function actionsFor(p: Product): RowAction[] {
    const a: RowAction[] = [{ label: 'View', icon: 'view', onSelect: () => navigate(`/inventory/products/${p.id}`) }];
    if (canManage) a.push({ label: 'Edit', icon: 'edit', onSelect: () => navigate(`/inventory/products/${p.id}/edit`) });
    if (canManage) {
      a.push(
        isArchived(p)
          ? { label: 'Restore', icon: 'restore', onSelect: () => void toggleActive(p), separatorBefore: true }
          : { label: 'Archive', icon: 'archive', danger: true, onSelect: () => void toggleActive(p), separatorBefore: true },
      );
    }
    return a;
  }

  const columns: Column<Product>[] = [
    { header: 'Name', cell: (p) => (
      <div className="flex flex-col">
        <span className="font-medium">{p.name}</span>
        {p.barcode && <span className="num text-xs text-muted-foreground">{p.barcode}</span>}
      </div>
    ) },
    { header: 'Category', cell: (p) => (p.category ? <Badge variant="secondary">{p.category}</Badge> : '—') },
    { header: 'Unit', cell: (p) => p.unit },
    { header: 'Wholesale', align: 'right', cell: (p) => formatINR(p.wholesalePricePaise) },
    { header: 'GST', align: 'right', cell: (p) => <span className="num">{gstLabel(p.gstRateBp)}</span> },
    { header: 'Variants', align: 'right', cell: (p) => (p.hasVariants ? p.variants.length : '—') },
    { header: 'Status', cell: (p) => <ActiveBadge deletedAt={p.deletedAt} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        description="Your catalogue. Used by billing, purchasing and stock."
        actions={canManage && (
          <Button onClick={() => navigate('/inventory/products/new')}>
            <Plus /> New Product
          </Button>
        )}
        filters={
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, HSN, barcode…"
            filters={
              <>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-40" aria-label="Category filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categoryOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                  <SelectTrigger className="w-36" aria-label="Status filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />
        }
      />

      <DataList
        items={filtered}
        getRowId={(p) => p.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search && category === 'all'}
        onLoadMore={loadMore}
        onRowClick={(p) => navigate(`/inventory/products/${p.id}`)}
        rowActions={(p) => <RowActions actions={actionsFor(p)} />}
        empty={{
          icon: Package,
          title: search ? 'No matching products' : 'No products yet',
          description: search ? 'Try a different search.' : 'Add your first product to start billing.',
          action: canManage && !search ? (
            <Button onClick={() => navigate('/inventory/products/new')}>
              <Plus /> New Product
            </Button>
          ) : undefined,
        }}
        renderCard={(p) => (
          <Card className="p-4" onClick={() => navigate(`/inventory/products/${p.id}`)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.category || 'Uncategorised'}</p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <RowActions actions={actionsFor(p)} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="num text-muted-foreground">{formatINR(p.wholesalePricePaise)}</span>
              <span className="text-muted-foreground">· {gstLabel(p.gstRateBp)} GST</span>
              <span className="ml-auto"><ActiveBadge deletedAt={p.deletedAt} /></span>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
