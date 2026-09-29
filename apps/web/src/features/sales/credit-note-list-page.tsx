import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileMinus } from 'lucide-react';
import { formatINR, type CreditNote } from '@hynish/domain';
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

/** Credit Notes (BR-CN-01..06, TD §5.5) — the source's ONLY sales-return mechanism. Issued against
 * an invoice; `restock` decides whether stock/COGS are also reversed. */
export function CreditNoteListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const [search, setSearch] = useState('');
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.creditNotes, useMemo(() => PARAMS, []));
  const filtered = clientSearch(items, search, (c) => [c.number, c.invoiceNumber, c.customerSnapshot?.name ?? '']);

  const columns: Column<CreditNote>[] = [
    { header: 'Number', cell: (c) => (
      <div className="flex flex-col"><span className="num font-medium">{c.number}</span><span className="text-xs text-muted-foreground">{c.date}</span></div>
    ) },
    { header: 'Against invoice', cell: (c) => <span className="num">{c.invoiceNumber}</span> },
    { header: 'Customer', cell: (c) => c.customerSnapshot?.name || <span className="text-muted-foreground">—</span> },
    { header: 'Total', align: 'right', cell: (c) => <span className="num">{formatINR(c.grandTotalPaise)}</span> },
    { header: 'Restocked', cell: (c) => <Badge variant={c.restock ? 'success' : 'secondary'}>{c.restock ? 'Yes' : 'No'}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Credit Notes"
        description="Issued against an invoice — the sales-return mechanism (BR-CN-01). Reverses revenue/tax/AR, and stock/COGS only if restocked."
        filters={<ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search number, invoice, customer…" />}
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
        onRowClick={(c) => navigate(`/sales/credit-notes/${c.id}`)}
        empty={{
          icon: FileMinus,
          title: search ? 'No matching credit notes' : 'No credit notes yet',
          description: search ? 'Try a different search.' : 'Issue one from an invoice to record a sales return or correction.',
        }}
        renderCard={(c) => (
          <Card className="p-4" onClick={() => navigate(`/sales/credit-notes/${c.id}`)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="num truncate font-semibold">{c.number}</p>
                <p className="text-xs text-muted-foreground">vs {c.invoiceNumber} · {c.date}</p>
              </div>
              <div className="text-right"><p className="num font-semibold">{formatINR(c.grandTotalPaise)}</p><Badge variant={c.restock ? 'success' : 'secondary'}>{c.restock ? 'Restocked' : 'No restock'}</Badge></div>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
