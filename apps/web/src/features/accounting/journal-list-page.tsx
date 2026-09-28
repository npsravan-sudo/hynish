import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookText } from 'lucide-react';
import { formatINR, JOURNAL_REF_TYPES, type JournalEntry } from '@hynish/domain';
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

const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 25, filters: [] };

function refTypeLabel(t: string): string {
  return t.replace(/_/g, ' ');
}

export function JournalListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const locations = useAuthStore((s) => s.locations);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'posted' | 'voided'>('posted');
  const [refType, setRefType] = useState<'all' | string>('all');
  const [locationId, setLocationId] = useState<'all' | string>('all');

  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.journalEntries, useMemo(() => PARAMS, []));

  const filtered = useMemo(() => {
    let list = items;
    if (status !== 'all') list = list.filter((e) => e.status === status);
    if (refType !== 'all') list = list.filter((e) => e.refType === refType);
    if (locationId !== 'all') list = list.filter((e) => e.locationId === locationId);
    return clientSearch(list, search, (e) => [e.refLabel, e.refId, e.refType]);
  }, [items, status, refType, locationId, search]);

  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  const columns: Column<JournalEntry>[] = [
    { header: 'Date', cell: (e) => (
      <div className="flex flex-col">
        <span>{e.date}</span>
        <span className="text-xs text-muted-foreground capitalize">{refTypeLabel(e.refType)}</span>
      </div>
    ) },
    { header: 'Reference', cell: (e) => <span className="num">{e.refLabel || e.refId}</span> },
    { header: 'Location', cell: (e) => locName(e.locationId) },
    { header: 'Total', align: 'right', cell: (e) => <span className="num">{formatINR(e.totalPaise)}</span> },
    { header: 'Status', cell: (e) => <Badge variant={e.status === 'posted' ? 'success' : 'secondary'} className="capitalize">{e.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Journal"
        description="Every posted double-entry transaction. Debit always equals credit (BR-ACC-01)."
        filters={
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search reference…"
            filters={
              <>
                <Select value={refType} onValueChange={(v) => setRefType(v)}>
                  <SelectTrigger className="w-36" aria-label="Document type filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {JOURNAL_REF_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{refTypeLabel(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={locationId} onValueChange={(v) => setLocationId(v)}>
                  <SelectTrigger className="w-40" aria-label="Location filter"><SelectValue placeholder="All locations" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="w-32" aria-label="Status filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="voided">Voided</SelectItem>
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
        getRowId={(e) => e.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search && status === 'posted' && refType === 'all' && locationId === 'all'}
        onLoadMore={loadMore}
        onRowClick={(e) => navigate(`/accounting/journal/${e.id}`)}
        empty={{ icon: BookText, title: search ? 'No matching entries' : 'No journal entries yet', description: search ? 'Try a different search.' : 'Entries appear automatically as sales, purchases and payments are posted.' }}
        renderCard={(e) => (
          <Card className="p-4" onClick={() => navigate(`/accounting/journal/${e.id}`)}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="num truncate font-semibold">{e.refLabel || e.refId}</p>
                <p className="text-xs capitalize text-muted-foreground">{refTypeLabel(e.refType)} · {e.date}</p>
              </div>
              <div className="text-right"><p className="num font-semibold">{formatINR(e.totalPaise)}</p><Badge variant={e.status === 'posted' ? 'success' : 'secondary'} className="capitalize">{e.status}</Badge></div>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
