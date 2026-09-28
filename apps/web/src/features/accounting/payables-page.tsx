import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandCoins } from 'lucide-react';
import { formatINR, outstandingOf, isOutstanding, todayISO, type Purchase } from '@hynish/domain';
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

// §25: supplier payables mirror sales receivables exactly, over purchases and suppliers (BR-DUE-07).
const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 100, filters: [{ field: 'deletedAt', op: '==', value: null }] };

export function PayablesPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const [search, setSearch] = useState('');
  const { items, loading, error, refresh } = usePagedList(repos.purchases, useMemo(() => PARAMS, []));

  const outstanding = useMemo(() => items.filter((p) => isOutstanding(p.totalPaise, p.paidPaise)), [items]);
  const filtered = clientSearch(outstanding, search, (p) => [p.supplierBillNo, p.supplierSnapshot?.name ?? '']);

  const today = todayISO();
  const totalOutstanding = outstanding.reduce((s, p) => s + outstandingOf(p.totalPaise, p.paidPaise), 0);
  const overdue = outstanding.filter((p) => p.dueDate && p.dueDate < today);
  const overdueTotal = overdue.reduce((s, p) => s + outstandingOf(p.totalPaise, p.paidPaise), 0);

  function overdueBadge(p: Purchase) {
    if (!p.dueDate) return <Badge variant="secondary">No due date</Badge>;
    if (p.dueDate < today) return <Badge variant="danger">Overdue</Badge>;
    const soon = new Date(p.dueDate).getTime() - new Date(today).getTime() <= 7 * 86400000;
    return soon ? <Badge variant="warning">Due soon</Badge> : <Badge variant="info">Current</Badge>;
  }

  const columns: Column<Purchase>[] = [
    { header: 'Purchase', cell: (p) => <div className="flex flex-col"><span className="num font-medium">{p.supplierBillNo || p.date}</span><span className="text-xs text-muted-foreground">{p.date}</span></div> },
    { header: 'Supplier', cell: (p) => p.supplierSnapshot?.name || '—' },
    { header: 'Due', cell: (p) => overdueBadge(p) },
    { header: 'Outstanding', align: 'right', cell: (p) => <span className="num font-medium">{formatINR(outstandingOf(p.totalPaise, p.paidPaise))}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payables"
        description="Outstanding amounts owed to suppliers from unpaid and partially paid purchases."
        filters={<ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search supplier, bill no…" />}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SectionCard title="Total payable"><p className="num text-2xl font-bold">{formatINR(totalOutstanding)}</p></SectionCard>
        <SectionCard title="Overdue"><p className="num text-2xl font-bold text-danger">{formatINR(overdueTotal)}</p></SectionCard>
        <SectionCard title="Purchases with dues"><p className="num text-2xl font-bold">{outstanding.length}</p></SectionCard>
      </div>
      <DataList
        items={filtered}
        getRowId={(p) => p.id}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={refresh}
        onRowClick={(p) => navigate(`/inventory/purchases/${p.id}`)}
        empty={{ icon: HandCoins, title: search ? 'No matching payables' : 'No outstanding payables', description: search ? 'Try a different search.' : 'All purchases are settled.' }}
        renderCard={(p) => (
          <Card className="p-4" onClick={() => navigate(`/inventory/purchases/${p.id}`)}>
            <div className="flex items-center justify-between gap-2">
              <div><p className="num font-semibold">{p.supplierBillNo || p.date}</p><p className="text-xs text-muted-foreground">{p.supplierSnapshot?.name || '—'}</p></div>
              <div className="text-right"><p className="num font-semibold">{formatINR(outstandingOf(p.totalPaise, p.paidPaise))}</p>{overdueBadge(p)}</div>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
