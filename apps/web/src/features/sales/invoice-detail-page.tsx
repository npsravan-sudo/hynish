import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Printer, IndianRupee } from 'lucide-react';
import {
  formatINR, newRequestId, outstandingOf, type Invoice, type Payment, type PaymentStatus,
} from '@hynish/domain';
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
import { useRepositories, useSalesService } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { mapCallableError } from '@/lib/errors';
import { DetailRow } from '@/features/_shared/detail-row';
import { RecordPaymentDialog } from './record-payment-dialog';

const STATUS_VARIANT: Record<PaymentStatus, 'success' | 'info' | 'secondary'> = { paid: 'success', partial: 'info', unpaid: 'secondary' };

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]} className="capitalize">{status}</Badge>;
}

export function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useSalesService();
  const can = useAuthStore((s) => s.hasPermission);
  const { data: inv, loading, error, notFound, reload } = useEntity(repos.invoices, id);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void repos.payments
      .list({ filters: [{ field: 'targetType', op: '==', value: 'invoice' }, { field: 'targetId', op: '==', value: id }], orderByField: 'date', direction: 'desc', limit: 50 })
      .then((p) => !cancelled && setPayments(p.items))
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [id, repos, inv]);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !inv) return <ErrorState title="Invoice not found" message={error ?? 'It may have been removed.'} />;

  const outstanding = outstandingOf(inv.grandTotalPaise, inv.paidPaise);

  async function onDelete() {
    if (!inv) return;
    const ok = await confirm({
      title: `Delete ${inv.number}?`,
      description: 'This reverses its stock and accounting entries. The number stays reserved. This cannot be undone.',
      confirmLabel: 'Delete invoice',
      danger: true,
    });
    if (!ok) return;
    try {
      await service.invoices.remove(inv.id, newRequestId());
      toast.success('Invoice deleted');
      navigate('/sales/invoices');
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={inv.number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={inv.gstApplicable ? 'info' : 'secondary'}>{inv.gstApplicable ? 'GST' : 'Without GST'}</Badge>
            <PaymentStatusBadge status={inv.paymentStatus} />
            <span className="text-muted-foreground">{inv.date}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/sales/invoices')}><ArrowLeft /> Back</Button>
            <Button variant="outline" onClick={() => navigate(`/sales/invoices/${inv.id}/print`)}><Printer /> Print</Button>
            {outstanding > 0 && can('payments.record') && <Button variant="outline" onClick={() => setPayOpen(true)}><IndianRupee /> Record payment</Button>}
            {can('sales.edit') && <Button variant="outline" onClick={() => navigate(`/sales/invoices/${inv.id}/edit`)}><Pencil /> Edit</Button>}
            {can('sales.delete') && <Button variant="outline" onClick={() => void onDelete()}><Trash2 /> Delete</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Customer">
          {inv.customerSnapshot ? (
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <DetailRow label="Name" value={inv.customerSnapshot.name} />
              <DetailRow label="Phone" value={inv.customerSnapshot.phone} />
              <DetailRow label="GSTIN" value={inv.customerSnapshot.gstin || 'B2C'} />
              <DetailRow label="Address" value={inv.customerSnapshot.address} className="sm:col-span-2" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Walk-in / cash sale.</p>
          )}
        </SectionCard>
        <SectionCard title="Details">
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <DetailRow label="Tax type" value={inv.gstApplicable ? (inv.taxType === 'intra' ? 'Intra-state' : 'Inter-state') : 'No tax'} />
            <DetailRow label="Due date" value={inv.dueDate} />
            <DetailRow label="Created by" value={inv.createdByName} />
            <DetailRow label="Revision" value={String(inv.revision)} />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Items">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Disc</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inv.lines.map((l) => (
                <TableRow key={l.lineId}>
                  <TableCell>
                    <div className="font-medium">{l.nameSnapshot}</div>
                    {l.codeSnapshot && <div className="num text-xs text-muted-foreground">{l.codeSnapshot}</div>}
                  </TableCell>
                  <TableCell className="num text-right">{l.qty} {l.unit}</TableCell>
                  <TableCell className="num text-right">{formatINR(l.ratePaise)}</TableCell>
                  <TableCell className="num text-right">{l.discountBp ? `${l.discountBp / 100}%` : '—'}</TableCell>
                  <TableCell className="num text-right">{l.gstRateBp / 100}%</TableCell>
                  <TableCell className="num text-right">{formatINR(l.taxablePaise)}</TableCell>
                  <TableCell className="num text-right">{formatINR(l.totalPaise)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Payments">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Grand total</span><span className="num">{formatINR(inv.grandTotalPaise)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Received</span><span className="num">{formatINR(inv.paidPaise)}</span></div>
            <div className="flex justify-between font-semibold"><span>Outstanding</span><span className="num">{formatINR(outstanding)}</span></div>
            {payments.length > 0 && <div className="mt-2 border-t border-border pt-2" />}
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between text-xs text-muted-foreground">
                <span>{p.date} · {p.mode}{p.reference ? ` · ${p.reference}` : ''}</span>
                <span className="num">{formatINR(p.amountPaise)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Totals">
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="num">{formatINR(inv.subtotalPaise)}</span></div>
            {inv.gstApplicable && inv.taxType === 'intra' && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span className="num">{formatINR(inv.cgstPaise)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span className="num">{formatINR(inv.sgstPaise)}</span></div>
              </>
            )}
            {inv.gstApplicable && inv.taxType === 'inter' && (
              <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span className="num">{formatINR(inv.igstPaise)}</span></div>
            )}
            {inv.roundOffPaise !== 0 && <div className="flex justify-between"><span className="text-muted-foreground">Round off</span><span className="num">{formatINR(inv.roundOffPaise)}</span></div>}
            <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Grand total</span><span className="num">{formatINR(inv.grandTotalPaise)}</span></div>
          </div>
        </SectionCard>
      </div>

      {payOpen && <RecordPaymentDialog invoice={inv as Invoice} open={payOpen} onOpenChange={setPayOpen} onDone={reload} />}
    </div>
  );
}
