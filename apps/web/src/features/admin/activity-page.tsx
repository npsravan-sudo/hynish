/**
 * Activity Log page (Phase 10, BR-ADM-04, LC-39.1, TD §3.3). Paginated, filterable view of the
 * immutable server-written activityLog collection. Read-only — no mutations from this page.
 * Requires activity.view permission (gated in the router).
 */
import { useMemo, useState } from 'react';
import { History, Filter } from 'lucide-react';
import { format } from 'date-fns';
import type { ActivityLog } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DataList, type Column } from '@/components/data/data-list';
import { useRepositories } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';

const BASE_PARAMS: ListParams = {
  orderByField: 'at',
  direction: 'desc',
  limit: 50,
  filters: [],
};

function formatAt(ts: number): string {
  try { return format(new Date(ts), 'dd MMM yyyy, HH:mm'); } catch { return '—'; }
}

function actionBadge(action: string) {
  const [type, verb] = action.split('.');
  const color =
    verb === 'delete' ? 'destructive' :
    verb === 'create' || verb === 'login' ? 'default' :
    'secondary';
  return <Badge variant={color as 'destructive' | 'default' | 'secondary' | 'outline'} className="font-mono text-xs">{action}</Badge>;
}

export function ActivityPage() {
  const repos = useRepositories();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ActivityLog | null>(null);

  const params = useMemo<ListParams>(() => BASE_PARAMS, []);
  const { items, loading, error, refresh, hasMore, loadMore, loadingMore } = usePagedList(repos.activityLog as never, params);

  const filtered = useMemo(() => {
    if (!search.trim()) return items as ActivityLog[];
    const q = search.toLowerCase();
    return (items as ActivityLog[]).filter(
      (e) =>
        e.actorName.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        (e.target?.label ?? '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const columns: Column<ActivityLog>[] = [
    { header: 'When', cell: (e) => <span className="whitespace-nowrap text-sm">{formatAt(e.at)}</span>, className: 'w-44' },
    { header: 'Actor', cell: (e) => <span className="text-sm">{e.actorName}</span> },
    { header: 'Action', cell: (e) => actionBadge(e.action) },
    { header: 'Target', cell: (e) => e.target ? <span className="text-sm">{e.target.label}</span> : <span className="text-muted-foreground text-sm">—</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Activity Log"
        description="Immutable, server-written audit trail. All timestamps are in your business timezone."
        filters={
          <div className="flex w-full gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Filter className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search actor, action or target…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={refresh} title="Refresh"><History className="size-4" /></Button>
          </div>
        }
      />

      <SectionCard>
        <DataList
          items={filtered}
          getRowId={(e) => e.id}
          columns={columns}
          renderCard={(e) => (
            <div className="flex flex-col gap-1 p-4 cursor-pointer" onClick={() => setSelected(e)}>
              <div className="flex items-center gap-2 flex-wrap">{actionBadge(e.action)}<span className="text-xs text-muted-foreground">{formatAt(e.at)}</span></div>
              <div className="text-sm font-medium">{e.actorName}</div>
              {e.target && <div className="text-xs text-muted-foreground">{e.target.label}</div>}
            </div>
          )}
          onRowClick={(e) => setSelected(e)}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          onRetry={refresh}
          hasMore={hasMore}
          onLoadMore={loadMore}
          empty={{ title: 'No activity yet', description: 'Events appear here as your team uses the app.', icon: History }}
        />
      </SectionCard>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Activity Detail</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="flex flex-col gap-4 py-4">
              <Row label="When" value={formatAt(selected.at)} />
              <Row label="Actor" value={selected.actorName} />
              <Row label="Actor UID" value={selected.actorUid} mono />
              <Row label="Action" value={selected.action} mono />
              {selected.target && <>
                <Row label="Target Type" value={selected.target.type} />
                <Row label="Target ID" value={selected.target.id} mono />
                <Row label="Target Label" value={selected.target.label} />
              </>}
              {selected.locationId && <Row label="Location ID" value={selected.locationId} mono />}
              {Object.keys(selected.details).length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</span>
                  <pre className="rounded bg-muted p-3 text-xs overflow-auto max-h-48">{JSON.stringify(selected.details, null, 2)}</pre>
                </div>
              )}
              <Row label="Log ID" value={selected.id} mono />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={mono ? 'font-mono text-sm break-all' : 'text-sm'}>{value}</span>
    </div>
  );
}
