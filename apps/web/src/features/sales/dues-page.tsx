import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleDollarSign } from 'lucide-react';
import { formatINR, outstandingOf, isOutstanding, todayISO, type Invoice } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataList, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { SectionCard } from '@/components/premium';
import { useRepositories } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';
import { clientSearch } from '@/features/_shared/master-data';

// Sales-scoped receivables (§44): outstanding invoices only. The full customer statement/ageing
// report is a later phase. Ordered by date; outstanding computed via the shared domain helper.
const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 100, filters: [{ field: 'deletedAt', op: '==', value: null }] };

export function DuesPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const [search, setSearch] = useState('');
  const { items, loading, error, refresh } = usePagedList(repos.invoices, useMemo(() => PARAMS, []));

  const outstanding = useMemo(() => items.filter((i) => isOutstanding(i.grandTotalPaise, i.paidPaise)), [items]);
  const filtered = clientSearch(outstanding, search, (i) => [i.number, i.customerSnapshot?.name ?? '']);

  const today = todayISO();
  const totalOutstanding = outstanding.reduce((s, i) => s + outstandingOf(i.grandTotalPaise, i.paidPaise), 0);
  const overdue = outstanding.filter((i) => i.dueDate && i.dueDate < today);
  const overdueTotal = overdue.reduce((s, i) => s + outstandingOf(i.grandTotalPaise, i.paidPaise), 0);

  function overdueBadge(i: Invoice) {
    if (!i.dueDate) return <Badge variant="secondary">No due date</Badge>;
    if (i.dueDate < today) return <Badge variant="danger">Overdue</Badge>;
    const soon = new Date(i.dueDate).getTime() - new Date(today).getTime() <= 7 * 86400000;
    return soon ? <Badge variant="warning">Due soon</Badge> : <Badge variant="info">Current</Badge>;
  }

  const columns: Column<Invoice>[] = [
    { header: 'Invoice', cell: (i) => <div className="flex flex-col"><span className="num font-medium">{i.number}</span><span className="text-xs text-muted-foreground">{i.date}</span></div> },
    { header: 'Customer', cell: (i) => i.customerSnapshot?.name || 'Cash sale' },
    { header: 'Due', cell: (i) => overdueBadge(i) },
    { header: 'Outstanding', align: 'right', cell: (i) => <span className="num font-medium">{formatINR(outstandingOf(i.grandTotalPaise, i.paidPaise))}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Outstanding Dues"
        description="Receivables from unpaid and partially paid invoices."
        filters={<ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search invoice, customer…" />}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SectionCard title="Total outstanding"><p className="num text-2xl font-bold">{formatINR(totalOutstanding)}</p></SectionCard>
        <SectionCard title="Overdue"><p className="num text-2xl font-bold text-danger">{formatINR(overdueTotal)}</p></SectionCard>
        <SectionCard title="Invoices with dues"><p className="num text-2xl font-bold">{outstanding.length}</p></SectionCard>
      </div>
      <DataList
        items={filtered}
        getRowId={(i) => i.id}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={refresh}
        onRowClick={(i) => navigate(`/sales/invoices/${i.id}`)}
        empty={{ icon: CircleDollarSign, title: search ? 'No matching dues' : 'No outstanding dues', description: search ? 'Try a different search.' : 'All invoices are settled.' }}
        renderCard={(i) => (
          <Card className="p-4" onClick={() => navigate(`/sales/invoices/${i.id}`)}>
            <div className="flex items-center justify-between gap-2">
              <div><p className="num font-semibold">{i.number}</p><p className="text-xs text-muted-foreground">{i.customerSnapshot?.name || 'Cash sale'}</p></div>
              <div className="text-right"><p className="num font-semibold">{formatINR(outstandingOf(i.grandTotalPaise, i.paidPaise))}</p>{overdueBadge(i)}</div>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
