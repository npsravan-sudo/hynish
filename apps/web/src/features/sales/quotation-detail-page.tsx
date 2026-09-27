import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, FileUp } from 'lucide-react';
import { formatINR } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { DetailRow } from '@/features/_shared/detail-row';

export function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const can = useAuthStore((s) => s.hasPermission);
  const { data: q, loading, error, notFound } = useEntity(repos.quotations, id);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !q) return <ErrorState title="Quotation not found" message={error ?? 'It may have been removed.'} />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={q.number}
        description={<span className="flex items-center gap-2"><Badge variant={q.status === 'converted' ? 'success' : 'info'} className="capitalize">{q.status}</Badge><span className="text-muted-foreground">{q.date}</span></span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/sales/quotations')}><ArrowLeft /> Back</Button>
            {q.status === 'open' && can('quotations.manage') && <Button variant="outline" onClick={() => navigate(`/sales/quotations/${q.id}/edit`)}><Pencil /> Edit</Button>}
            {q.status === 'open' && can('sales.create') && <Button onClick={() => navigate(`/sales/new?fromQuotation=${q.id}`)}><FileUp /> Convert to bill</Button>}
            {q.status === 'converted' && q.convertedInvoiceId && <Button variant="outline" onClick={() => navigate(`/sales/invoices/${q.convertedInvoiceId}`)}>View invoice</Button>}
          </div>
        }
      />
      <SectionCard title="Customer">
        {q.customerSnapshot ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <DetailRow label="Name" value={q.customerSnapshot.name} />
            <DetailRow label="GSTIN" value={q.customerSnapshot.gstin || 'B2C'} />
          </div>
        ) : <p className="text-sm text-muted-foreground">No customer selected.</p>}
      </SectionCard>
      <SectionCard title="Items">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {q.lines.map((l) => (
                <TableRow key={l.lineId}>
                  <TableCell className="font-medium">{l.nameSnapshot}</TableCell>
                  <TableCell className="num text-right">{l.qty} {l.unit}</TableCell>
                  <TableCell className="num text-right">{formatINR(l.ratePaise)}</TableCell>
                  <TableCell className="num text-right">{l.gstRateBp / 100}%</TableCell>
                  <TableCell className="num text-right">{formatINR(l.totalPaise)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
      <div className="flex justify-end">
        <div className="w-full max-w-xs">
          <SectionCard title="Totals">
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="num">{formatINR(q.subtotalPaise)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="num">{formatINR(q.taxPaise)}</span></div>
              {q.roundOffPaise !== 0 && <div className="flex justify-between"><span className="text-muted-foreground">Round off</span><span className="num">{formatINR(q.roundOffPaise)}</span></div>}
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Grand total</span><span className="num">{formatINR(q.grandTotalPaise)}</span></div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
