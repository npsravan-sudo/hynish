import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { formatINR, outstandingOf, newRequestId, type Invoice, type PaymentStatus } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DataList, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { RowActions, type RowAction } from '@/components/data/row-actions';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, useSalesService } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { mapCallableError } from '@/lib/errors';
import { clientSearch } from '@/features/_shared/master-data';

const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 25, filters: [{ field: 'deletedAt', op: '==', value: null }] };
const STATUS_VARIANT: Record<PaymentStatus, 'success' | 'info' | 'secondary'> = { paid: 'success', partial: 'info', unpaid: 'secondary' };

export function InvoiceListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useSalesService();
  const can = useAuthStore((s) => s.hasPermission);
  const [search, setSearch] = useState('');
  const [payment, setPayment] = useState<'all' | PaymentStatus>('all');
  const [series, setSeries] = useState<'all' | 'gst' | 'nogst'>('all');

  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = usePagedList(repos.invoices, useMemo(() => PARAMS, []));

  const filtered = useMemo(() => {
    let list = items;
    if (payment !== 'all') list = list.filter((i) => i.paymentStatus === payment);
    if (series !== 'all') list = list.filter((i) => i.seriesKey === (series === 'gst' ? 'invoice_gst' : 'invoice_nogst'));
    return clientSearch(list, search, (i) => [i.number, i.customerSnapshot?.name ?? '', i.customerSnapshot?.gstin ?? '']);
  }, [items, payment, series, search]);

  async function onDelete(inv: Invoice) {
    const ok = await confirm({ title: `Delete ${inv.number}?`, description: 'Reverses stock and accounting; the number stays reserved.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await service.invoices.remove(inv.id, newRequestId());
      toast.success('Invoice deleted');
      refresh();
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  function actionsFor(inv: Invoice): RowAction[] {
    const a: RowAction[] = [{ label: 'View', icon: 'view', onSelect: () => navigate(`/sales/invoices/${inv.id}`) }];
    if (can('sales.edit')) a.push({ label: 'Edit', icon: 'edit', onSelect: () => navigate(`/sales/invoices/${inv.id}/edit`) });
    if (can('sales.delete')) a.push({ label: 'Delete', icon: 'archive', danger: true, onSelect: () => void onDelete(inv), separatorBefore: true });
    return a;
  }

  const columns: Column<Invoice>[] = [
    { header: 'Number', cell: (i) => (
      <div className="flex flex-col">
        <span className="num font-medium">{i.number}</span>
        <span className="text-xs text-muted-foreground">{i.date}</span>
      </div>
    ) },
    { header: 'Customer', cell: (i) => i.customerSnapshot?.name || <span className="text-muted-foreground">Cash sale</span> },
    { header: 'GST', cell: (i) => <Badge variant={i.gstApplicable ? 'info' : 'secondary'}>{i.gstApplicable ? 'GST' : 'No GST'}</Badge> },
    { header: 'Total', align: 'right', cell: (i) => <span className="num">{formatINR(i.grandTotalPaise)}</span> },
    { header: 'Outstanding', align: 'right', cell: (i) => <span className="num">{formatINR(outstandingOf(i.grandTotalPaise, i.paidPaise))}</span> },
    { header: 'Status', cell: (i) => <Badge variant={STATUS_VARIANT[i.paymentStatus]} className="capitalize">{i.paymentStatus}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices"
        description="Customer bills. GST and Without-GST series are numbered independently."
        actions={can('sales.create') && <Button onClick={() => navigate('/sales/new')}><Plus /> New Bill</Button>}
        filters={
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search number, customer, GSTIN…"
            filters={
              <>
                <Select value={series} onValueChange={(v) => setSeries(v as typeof series)}>
                  <SelectTrigger className="w-32" aria-label="GST filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All bills</SelectItem>
                    <SelectItem value="gst">GST</SelectItem>
                    <SelectItem value="nogst">Without GST</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={payment} onValueChange={(v) => setPayment(v as typeof payment)}>
                  <SelectTrigger className="w-32" aria-label="Payment filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any status</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />
        }
      />
      <DataList
        items={filtered}
        getRowId={(i) => i.id}
        columns={columns}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onRetry={refresh}
        hasMore={hasMore && !search && payment === 'all' && series === 'all'}
        onLoadMore={loadMore}
        onRowClick={(i) => navigate(`/sales/invoices/${i.id}`)}
        rowActions={(i) => <RowActions actions={actionsFor(i)} />}
        empty={{
          icon: FileText,
          title: search ? 'No matching invoices' : 'No invoices yet',
          description: search ? 'Try a different search.' : 'Create your first bill to get started.',
          action: can('sales.create') && !search ? <Button onClick={() => navigate('/sales/new')}><Plus /> New Bill</Button> : undefined,
        }}
        renderCard={(i) => (
          <Card className="p-4" onClick={() => navigate(`/sales/invoices/${i.id}`)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="num truncate font-semibold">{i.number}</p>
                <p className="text-xs text-muted-foreground">{i.customerSnapshot?.name || 'Cash sale'} · {i.date}</p>
              </div>
              <div onClick={(e) => e.stopPropagation()}><RowActions actions={actionsFor(i)} /></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="num text-muted-foreground">{formatINR(i.grandTotalPaise)}</span>
              <Badge variant={STATUS_VARIANT[i.paymentStatus]} className="ml-auto capitalize">{i.paymentStatus}</Badge>
            </div>
          </Card>
        )}
      />
    </div>
  );
}
