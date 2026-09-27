import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import type { Customer } from '@hynish/domain';
import { formatINR, stateName } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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

export function CustomerListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useMasterDataService();
  const can = useAuthStore((s) => s.hasPermission);
  const [status, setStatus] = useState<StatusFilter>('active');
  const [search, setSearch] = useState('');

  const params = useMemo(() => listParamsFor(status), [status]);
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.customers, params);

  const filtered = clientSearch(items, search, (c) => [c.name, c.phone, c.gstin, c.city]);

  async function toggleActive(c: Customer) {
    const activate = isArchived(c);
    if (!activate) {
      const ok = await confirm({
        title: `Archive ${c.name}?`,
        description: 'Existing invoices keep their details. You can restore the customer later.',
        confirmLabel: 'Archive',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await service.customers.setActive(c.id, activate);
      toast.success(activate ? 'Customer restored' : 'Customer archived');
      refresh();
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  function actionsFor(c: Customer): RowAction[] {
    const a: RowAction[] = [{ label: 'View', icon: 'view', onSelect: () => navigate(`/customers/${c.id}`) }];
    if (can('customers.manage')) a.push({ label: 'Edit', icon: 'edit', onSelect: () => navigate(`/customers/${c.id}/edit`) });
    if (isArchived(c) && can('customers.manage')) a.push({ label: 'Restore', icon: 'restore', onSelect: () => void toggleActive(c), separatorBefore: true });
    if (!isArchived(c) && can('customers.delete')) a.push({ label: 'Archive', icon: 'archive', danger: true, onSelect: () => void toggleActive(c), separatorBefore: true });
    return a;
  }

  const columns: Column<Customer>[] = [
    { header: 'Name', cell: (c) => (
      <div className="flex flex-col">
        <span className="font-medium">{c.name}</span>
        {c.contactPerson && <span className="text-xs text-muted-foreground">{c.contactPerson}</span>}
      </div>
    ) },
    { header: 'Phone', cell: (c) => c.phone || '—' },
    { header: 'GSTIN', cell: (c) => (c.gstin ? <span className="num">{c.gstin}</span> : <Badge variant="secondary">B2C</Badge>) },
    { header: 'State', cell: (c) => stateName(c.stateCode) || '—' },
    { header: 'Credit Limit', align: 'right', cell: (c) => (c.creditLimitPaise ? formatINR(c.creditLimitPaise) : '—') },
    { header: 'Status', cell: (c) => <ActiveBadge deletedAt={c.deletedAt} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description="Your customer directory. Used by billing to determine GST and dues."
        actions={
          can('customers.manage') && (
            <Button onClick={() => navigate('/customers/new')}>
              <Plus /> New Customer
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
        getRowId={(c) => c.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search}
        onLoadMore={loadMore}
        onRowClick={(c) => navigate(`/customers/${c.id}`)}
        rowActions={(c) => <RowActions actions={actionsFor(c)} />}
        empty={{
          icon: Users,
          title: search ? 'No matching customers' : 'No customers yet',
          description: search ? 'Try a different search.' : 'Add your first customer to start billing.',
          action: can('customers.manage') && !search ? (
            <Button onClick={() => navigate('/customers/new')}>
              <Plus /> New Customer
            </Button>
          ) : undefined,
        }}
        renderCard={(c) => (
          <Card className="p-4" onClick={() => navigate(`/customers/${c.id}`)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.phone || 'No phone'}</p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <RowActions actions={actionsFor(c)} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {c.gstin ? <span className="num text-muted-foreground">{c.gstin}</span> : <Badge variant="secondary">B2C</Badge>}
              {stateName(c.stateCode) && <span className="text-muted-foreground">· {stateName(c.stateCode)}</span>}
              <span className="ml-auto"><ActiveBadge deletedAt={c.deletedAt} /></span>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
