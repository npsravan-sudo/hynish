import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { formatINR, type Payment } from '@hynish/domain';
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

export function PaymentsPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const [search, setSearch] = useState('');
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.payments, useMemo(() => PARAMS, []));
  const filtered = clientSearch(items, search, (p) => [p.targetNumber, p.mode, p.reference]);

  const columns: Column<Payment>[] = [
    { header: 'Date', cell: (p) => p.date },
    { header: 'Invoice', cell: (p) => <span className="num">{p.targetNumber}</span> },
    { header: 'Mode', cell: (p) => <Badge variant="secondary">{p.mode}</Badge> },
    { header: 'Reference', cell: (p) => p.reference || '—' },
    { header: 'Amount', align: 'right', cell: (p) => <span className="num">{formatINR(p.amountPaise)}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payments"
        description="Customer receipts recorded against invoices."
        filters={<ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search invoice, mode, reference…" />}
      />
      <DataList
        items={filtered}
        getRowId={(p) => p.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search}
        onLoadMore={loadMore}
        onRowClick={(p) => p.targetType === 'invoice' && navigate(`/sales/invoices/${p.targetId}`)}
        empty={{ icon: Wallet, title: 'No payments yet', description: 'Record a payment from an invoice to see it here.' }}
        renderCard={(p) => (
          <Card className="p-4" onClick={() => p.targetType === 'invoice' && navigate(`/sales/invoices/${p.targetId}`)}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="num font-semibold">{p.targetNumber}</p>
                <p className="text-xs text-muted-foreground">{p.date} · {p.mode}</p>
              </div>
              <span className="num font-semibold">{formatINR(p.amountPaise)}</span>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
