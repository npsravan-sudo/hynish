import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Factory } from 'lucide-react';
import type { Supplier } from '@hynish/domain';
import { stateName } from '@hynish/domain';
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

export function SupplierListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useMasterDataService();
  const can = useAuthStore((s) => s.hasPermission);
  const [status, setStatus] = useState<StatusFilter>('active');
  const [search, setSearch] = useState('');

  const params = useMemo(() => listParamsFor(status), [status]);
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.suppliers, params);
  const filtered = clientSearch(items, search, (s) => [s.name, s.phone, s.gstin, s.city]);

  async function toggleActive(s: Supplier) {
    const activate = isArchived(s);
    if (!activate) {
      const ok = await confirm({ title: `Archive ${s.name}?`, description: 'Purchases keep their details. You can restore later.', confirmLabel: 'Archive', danger: true });
      if (!ok) return;
    }
    try {
      await service.suppliers.setActive(s.id, activate);
      toast.success(activate ? 'Supplier restored' : 'Supplier archived');
      refresh();
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  function actionsFor(s: Supplier): RowAction[] {
    const a: RowAction[] = [{ label: 'View', icon: 'view', onSelect: () => navigate(`/inventory/suppliers/${s.id}`) }];
    if (can('suppliers.manage')) a.push({ label: 'Edit', icon: 'edit', onSelect: () => navigate(`/inventory/suppliers/${s.id}/edit`) });
    if (isArchived(s) && can('suppliers.manage')) a.push({ label: 'Restore', icon: 'restore', onSelect: () => void toggleActive(s), separatorBefore: true });
    if (!isArchived(s) && can('suppliers.delete')) a.push({ label: 'Archive', icon: 'archive', danger: true, onSelect: () => void toggleActive(s), separatorBefore: true });
    return a;
  }

  const columns: Column<Supplier>[] = [
    { header: 'Name', cell: (s) => (
      <div className="flex flex-col">
        <span className="font-medium">{s.name}</span>
        {s.contactPerson && <span className="text-xs text-muted-foreground">{s.contactPerson}</span>}
      </div>
    ) },
    { header: 'Phone', cell: (s) => s.phone || '—' },
    { header: 'GSTIN', cell: (s) => (s.gstin ? <span className="num">{s.gstin}</span> : '—') },
    { header: 'State', cell: (s) => stateName(s.stateCode) || '—' },
    { header: 'Status', cell: (s) => <ActiveBadge deletedAt={s.deletedAt} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suppliers"
        description="Your supplier directory. Used by purchases and payables."
        actions={
          can('suppliers.manage') && (
            <Button onClick={() => navigate('/inventory/suppliers/new')}>
              <Plus /> New Supplier
            </Button>
          )
        }
        filters={
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, phone, GSTIN…"
            filters={
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger className="w-36" aria-label="Status filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        }
      />

      <DataList
        items={filtered}
        getRowId={(s) => s.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search}
        onLoadMore={loadMore}
        onRowClick={(s) => navigate(`/inventory/suppliers/${s.id}`)}
        rowActions={(s) => <RowActions actions={actionsFor(s)} />}
        empty={{
          icon: Factory,
          title: search ? 'No matching suppliers' : 'No suppliers yet',
          description: search ? 'Try a different search.' : 'Add your first supplier to record purchases.',
          action: can('suppliers.manage') && !search ? (
            <Button onClick={() => navigate('/inventory/suppliers/new')}>
              <Plus /> New Supplier
            </Button>
          ) : undefined,
        }}
        renderCard={(s) => (
          <Card className="p-4" onClick={() => navigate(`/inventory/suppliers/${s.id}`)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.phone || 'No phone'}</p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <RowActions actions={actionsFor(s)} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {s.gstin ? <span className="num text-muted-foreground">{s.gstin}</span> : <Badge variant="secondary">No GSTIN</Badge>}
              {stateName(s.stateCode) && <span className="text-muted-foreground">· {stateName(s.stateCode)}</span>}
              <span className="ml-auto"><ActiveBadge deletedAt={s.deletedAt} /></span>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
