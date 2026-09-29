import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus } from 'lucide-react';
import { formatINR, type DebitNote } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataList, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { useRepositories } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';
import { clientSearch } from '@/features/_shared/master-data';

const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 25, filters: [{ field: 'deletedAt', op: '==', value: null }] };

/** Debit Notes (BR-DBN-01..04, TD §5.5) — the source's ONLY purchase-return mechanism. Issued
 * against a purchase; no GST math; `restock` decides whether stock is also removed. */
export function DebitNoteListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const [search, setSearch] = useState('');
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.debitNotes, useMemo(() => PARAMS, []));
  const filtered = clientSearch(items, search, (d) => [d.number, d.supplierSnapshot?.name ?? '']);

  const columns: Column<DebitNote>[] = [
    { header: 'Number', cell: (d) => (
      <div className="flex flex-col"><span className="num font-medium">{d.number}</span><span className="text-xs text-muted-foreground">{d.date}</span></div>
    ) },
    { header: 'Supplier', cell: (d) => d.supplierSnapshot?.name || <span className="text-muted-foreground">—</span> },
    { header: 'Total', align: 'right', cell: (d) => <span className="num">{formatINR(d.totalPaise)}</span> },
    { header: 'Restocked', cell: (d) => <Badge variant={d.restock ? 'success' : 'secondary'}>{d.restock ? 'Yes' : 'No'}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Debit Notes"
        description="Issued against a purchase — the purchase-return mechanism (BR-DBN-01). No GST math; restock also removes stock (returned to supplier)."
        filters={<ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search number, supplier…" />}
      />
      <DataList
        items={filtered}
        getRowId={(d) => d.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search}
        onLoadMore={loadMore}
        onRowClick={(d) => navigate(`/inventory/debit-notes/${d.id}`)}
        empty={{
          icon: FilePlus,
          title: search ? 'No matching debit notes' : 'No debit notes yet',
          description: search ? 'Try a different search.' : 'Issue one from a purchase to record a purchase return or correction.',
        }}
        renderCard={(d) => (
          <Card className="p-4" onClick={() => navigate(`/inventory/debit-notes/${d.id}`)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="num truncate font-semibold">{d.number}</p>
                <p className="text-xs text-muted-foreground">{d.supplierSnapshot?.name || '—'} · {d.date}</p>
              </div>
              <div className="text-right"><p className="num font-semibold">{formatINR(d.totalPaise)}</p><Badge variant={d.restock ? 'success' : 'secondary'}>{d.restock ? 'Restocked' : 'No restock'}</Badge></div>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
