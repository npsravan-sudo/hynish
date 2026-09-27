import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Warehouse, Store } from 'lucide-react';
import type { Location } from '@hynish/domain';
import { formatINR } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataList, type Column } from '@/components/data/data-list';
import { RowActions, type RowAction } from '@/components/data/row-actions';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, useMasterDataService } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { mapCallableError } from '@/lib/errors';
import { ActiveBadge, isArchived } from '@/features/_shared/master-data';

const PARAMS: ListParams = { orderByField: 'sortOrder', direction: 'asc', limit: 50, filters: [] };

export function LocationListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useMasterDataService();
  const can = useAuthStore((s) => s.hasPermission);
  const canManage = can('locations.manage');
  const { items, loading, error, refresh } = usePagedList(repos.locations, useMemo(() => PARAMS, []));
  const [busy, setBusy] = useState(false);

  async function toggleActive(l: Location) {
    const activate = isArchived(l);
    if (!activate) {
      const ok = await confirm({ title: `Archive ${l.name}?`, description: 'Stock and history stay linked. At least one active location must remain.', confirmLabel: 'Archive', danger: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await service.locations.setActive(l.id, activate);
      toast.success(activate ? 'Location restored' : 'Location archived');
      refresh();
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  function actionsFor(l: Location): RowAction[] {
    const a: RowAction[] = [{ label: 'View', icon: 'view', onSelect: () => navigate(`/inventory/locations/${l.id}`) }];
    if (canManage) {
      a.push({ label: 'Edit', icon: 'edit', onSelect: () => navigate(`/inventory/locations/${l.id}/edit`) });
      a.push(
        isArchived(l)
          ? { label: 'Restore', icon: 'restore', onSelect: () => void toggleActive(l), separatorBefore: true }
          : { label: 'Archive', icon: 'archive', danger: true, onSelect: () => void toggleActive(l), separatorBefore: true },
      );
    }
    return a;
  }

  const columns: Column<Location>[] = [
    { header: 'Name', cell: (l) => (
      <span className="flex items-center gap-2 font-medium">
        {l.type === 'warehouse' ? <Warehouse className="size-4 text-muted-foreground" /> : <Store className="size-4 text-muted-foreground" />}
        {l.name}
        {l.isDefault && <Badge variant="info" className="ml-1">Default</Badge>}
      </span>
    ) },
    { header: 'Type', cell: (l) => <span className="capitalize">{l.type}</span> },
    { header: 'Opening cash', align: 'right', cell: (l) => formatINR(l.openingCashBalancePaise) },
    { header: 'Status', cell: (l) => <ActiveBadge deletedAt={l.deletedAt} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Locations"
        description="Shops and warehouses. Stock and billing are location-aware."
        actions={canManage && <Button onClick={() => navigate('/inventory/locations/new')} disabled={busy}><Plus /> New Location</Button>}
      />
      <DataList
        items={items}
        getRowId={(l) => l.id}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={refresh}
        onRowClick={(l) => navigate(`/inventory/locations/${l.id}`)}
        rowActions={(l) => <RowActions actions={actionsFor(l)} />}
        empty={{
          icon: MapPin,
          title: 'No locations yet',
          description: 'Add a shop or warehouse to organize stock and billing.',
          action: canManage ? <Button onClick={() => navigate('/inventory/locations/new')}><Plus /> New Location</Button> : undefined,
        }}
        renderCard={(l) => (
          <Card className="p-4" onClick={() => navigate(`/inventory/locations/${l.id}`)}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {l.type === 'warehouse' ? <Warehouse className="size-4 text-muted-foreground" /> : <Store className="size-4 text-muted-foreground" />}
                <span className="font-semibold">{l.name}</span>
                {l.isDefault && <Badge variant="info">Default</Badge>}
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <RowActions actions={actionsFor(l)} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{l.type}</span>
              <span className="num ml-auto">{formatINR(l.openingCashBalancePaise)}</span>
              <ActiveBadge deletedAt={l.deletedAt} />
            </div>
          </Card>
        )}
      />
    </div>
  );
}
