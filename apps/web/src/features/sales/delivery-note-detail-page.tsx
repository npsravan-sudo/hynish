import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, FileUp, PackageCheck } from 'lucide-react';
import { formatINR, newRequestId, type DeliveryNoteStatus } from '@hynish/domain';
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

const STATUS_VARIANT: Record<DeliveryNoteStatus, 'info' | 'success' | 'secondary'> = { pending: 'info', invoiced: 'success', returned: 'secondary' };

/** BR-DN-03: only a pending DN can be edited, converted, or marked returned. */
export function DeliveryNoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useSalesService();
  const can = useAuthStore((s) => s.hasPermission);
  const locations = useAuthStore((s) => s.locations);
  const { data: d, loading, error, notFound, reload } = useEntity(repos.deliveryNotes, id);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !d) return <ErrorState title="Delivery note not found" message={error ?? 'It may have been removed.'} />;

  const locName = locations.find((l) => l.id === d.locationId)?.name ?? d.locationId;

  async function markReturned() {
    if (!d) return;
    const ok = await confirm({ title: 'Mark returned?', description: 'This restores the stock this delivery note took out.', confirmLabel: 'Mark returned' });
    if (!ok) return;
    try {
      await service.deliveryNotes.markReturned(d.id, newRequestId());
      toast.success('Delivery note marked returned');
      reload();
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={d.number}
        description={<span className="flex items-center gap-2"><Badge variant={STATUS_VARIANT[d.status]} className="capitalize">{d.status}</Badge><span className="text-muted-foreground">{d.date}</span></span>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/sales/delivery-notes')}><ArrowLeft /> Back</Button>
            {d.status === 'pending' && can('deliveryNotes.manage') && (
              <Button variant="outline" onClick={() => navigate(`/sales/delivery-notes/${d.id}/edit`)}><Pencil /> Edit</Button>
            )}
            {d.status === 'pending' && can('sales.create') && (
              <Button variant="outline" onClick={() => navigate(`/sales/new?fromDeliveryNote=${d.id}`)}><FileUp /> Convert to bill</Button>
            )}
            {d.status === 'pending' && can('deliveryNotes.manage') && (
              <Button variant="outline" onClick={() => void markReturned()}><PackageCheck /> Mark returned</Button>
            )}
            {d.status === 'invoiced' && d.invoiceId && (
              <Button variant="outline" onClick={() => navigate(`/sales/invoices/${d.invoiceId}`)}>View invoice</Button>
            )}
          </div>
        }
      />
      <SectionCard title="Details">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <DetailRow label="Customer" value={d.customerSnapshot?.name} />
          <DetailRow label="Location" value={locName} />
          <DetailRow label="Notes" value={d.notes || '—'} />
        </div>
      </SectionCard>
      <SectionCard title="Items" description="Rates shown are reference values only — a Delivery Note carries no GST (BR-DN-02).">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Reference rate</TableHead><TableHead className="text-right">Value</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {d.lines.map((l) => (
                <TableRow key={l.lineId}>
                  <TableCell className="font-medium">{l.nameSnapshot}</TableCell>
                  <TableCell className="num text-right">{l.qty} {l.unit}</TableCell>
                  <TableCell className="num text-right">{formatINR(l.referenceRatePaise)}</TableCell>
                  <TableCell className="num text-right">{formatINR(Math.round(l.referenceRatePaise * l.qty))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex justify-end border-t border-border pt-3 text-sm font-semibold">
          <span>Reference total <span className="num">{formatINR(d.referenceValuePaise)}</span></span>
        </div>
      </SectionCard>
    </div>
  );
}
