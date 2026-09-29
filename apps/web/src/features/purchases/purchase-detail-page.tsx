import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, FilePlus } from 'lucide-react';
import { formatINR, newRequestId, outstandingOf, type PaymentStatus, type DebitNote } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, usePurchasesService } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { mapCallableError, callableErrorCode } from '@/lib/errors';
import { DetailRow } from '@/features/_shared/detail-row';

const STATUS_VARIANT: Record<PaymentStatus, 'success' | 'info' | 'secondary'> = { paid: 'success', partial: 'info', unpaid: 'secondary' };

export function PurchaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = usePurchasesService();
  const canOverride = useAuthStore((s) => s.hasPermission('stock.overrideNegative'));
  const canDelete = useAuthStore((s) => s.hasPermission('purchases.delete'));
  const canDebitNote = useAuthStore((s) => s.hasPermission('debitNotes.manage'));
  const locations = useAuthStore((s) => s.locations);
  const { data: p, loading, error, notFound } = useEntity(repos.purchases, id);
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void repos.debitNotes
      .list({ filters: [{ field: 'deletedAt', op: '==', value: null }, { field: 'purchaseId', op: '==', value: id }], orderByField: 'date', direction: 'desc', limit: 50 })
      .then((r) => !cancelled && setDebitNotes(r.items))
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [id, repos]);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !p) return <ErrorState title="Purchase not found" message={error ?? 'It may have been removed.'} />;

  const locName = locations.find((l) => l.id === p.locationId)?.name ?? p.locationId;

  async function onDelete(confirmNegative = false) {
    if (!p) return;
    if (!confirmNegative) {
      const ok = await confirm({ title: 'Delete this purchase?', description: 'This reverses the stock it added and voids its journal entries. This cannot be undone.', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
    }
    try {
      await service.remove(p.id, newRequestId(), confirmNegative ? ['NEGATIVE_STOCK'] : []);
      toast.success('Purchase deleted');
      navigate('/inventory/purchases');
    } catch (e) {
      if (callableErrorCode(e) === 'NEGATIVE_STOCK') {
        if (!canOverride) { toast.error('Reversing this purchase would take stock negative, which you cannot override.'); return; }
        const ok = await confirm({ title: 'Allow negative stock?', description: 'Some of these goods were already sold, so reversing takes stock below zero. Continue?', confirmLabel: 'Delete anyway', danger: true });
        if (ok) return void onDelete(true);
      } else {
        toast.error(mapCallableError(e));
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={p.supplierSnapshot?.name || 'Purchase'}
        description={<span className="flex items-center gap-2"><Badge variant={STATUS_VARIANT[p.paymentStatus]} className="capitalize">{p.paymentStatus}</Badge><span className="text-muted-foreground">{p.date}</span></span>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/inventory/purchases')}><ArrowLeft /> Back</Button>
            {canDebitNote && <Button variant="outline" onClick={() => navigate(`/inventory/debit-notes/new?purchaseId=${p.id}`)}><FilePlus /> Issue debit note</Button>}
            {canDelete && <Button variant="outline" onClick={() => void onDelete(false)}><Trash2 /> Delete</Button>}
          </div>
        }
      />
      <SectionCard title="Details">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <DetailRow label="Supplier" value={p.supplierSnapshot?.name} />
          <DetailRow label="GSTIN" value={p.supplierSnapshot?.gstin} />
          <DetailRow label="Supplier bill no." value={p.supplierBillNo} />
          <DetailRow label="Location" value={locName} />
          <DetailRow label="Due date" value={p.dueDate} />
        </div>
      </SectionCard>
      <SectionCard title="Items">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Amount</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {p.lines.map((l) => (
                <TableRow key={l.lineId}>
                  <TableCell className="font-medium">{l.nameSnapshot}</TableCell>
                  <TableCell className="num text-right">{l.enteredQty} {l.enteredUnit}</TableCell>
                  <TableCell className="num text-right">{formatINR(l.ratePaise)}</TableCell>
                  <TableCell className="num text-right">{formatINR(l.amountPaise)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
      <div className="flex justify-end">
        <div className="w-full max-w-xs">
          <SectionCard title="Payment">
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="num">{formatINR(p.totalPaise)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="num">{formatINR(p.paidPaise)}</span></div>
              <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold"><span>Outstanding</span><span className="num">{formatINR(outstandingOf(p.totalPaise, p.paidPaise))}</span></div>
            </div>
          </SectionCard>
        </div>
      </div>

      {debitNotes.length > 0 && (
        <SectionCard title="Debit Notes">
          <div className="flex flex-col gap-2">
            {debitNotes.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => navigate(`/inventory/debit-notes/${d.id}`)}
                className="flex items-center justify-between rounded-md border border-border p-3 text-left text-sm transition hover:bg-accent"
              >
                <span><span className="num font-medium">{d.number}</span> · {d.date}{d.restock ? ' · restocked' : ''}</span>
                <span className="num">{formatINR(d.totalPaise)}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
