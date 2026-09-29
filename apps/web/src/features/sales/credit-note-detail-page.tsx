import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatINR } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { useRepositories } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { DetailRow } from '@/features/_shared/detail-row';

export function CreditNoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const { data: c, loading, error, notFound } = useEntity(repos.creditNotes, id);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !c) return <ErrorState title="Credit note not found" message={error ?? 'It may have been removed.'} />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={c.number}
        description={<span className="flex items-center gap-2"><Badge variant={c.restock ? 'success' : 'secondary'}>{c.restock ? 'Restocked' : 'No restock'}</Badge><span className="text-muted-foreground">{c.date}</span></span>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/sales/credit-notes')}><ArrowLeft /> Back</Button>
            <Button variant="outline" onClick={() => navigate(`/sales/invoices/${c.invoiceId}`)}>View invoice</Button>
          </div>
        }
      />
      <SectionCard title="Details">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <DetailRow label="Against invoice" value={c.invoiceNumber} />
          <DetailRow label="Customer" value={c.customerSnapshot?.name} />
          <DetailRow label="Reason" value={c.reason || '—'} />
        </div>
      </SectionCard>
      <SectionCard title="Items">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {c.lines.map((l) => (
                <TableRow key={l.invoiceLineId}>
                  <TableCell className="font-medium">{l.nameSnapshot}</TableCell>
                  <TableCell className="num text-right">{l.qty} {l.unit}</TableCell>
                  <TableCell className="num text-right">{formatINR(l.ratePaise)}</TableCell>
                  <TableCell className="num text-right">{formatINR(l.taxablePaise)}</TableCell>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="num">{formatINR(c.subtotalPaise)}</span></div>
              {c.taxPaise > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="num">{formatINR(c.taxPaise)}</span></div>}
              <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span className="num">{formatINR(c.grandTotalPaise)}</span></div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
