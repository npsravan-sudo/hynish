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

export function DebitNoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const { data: d, loading, error, notFound } = useEntity(repos.debitNotes, id);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !d) return <ErrorState title="Debit note not found" message={error ?? 'It may have been removed.'} />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={d.number}
        description={<span className="flex items-center gap-2"><Badge variant={d.restock ? 'success' : 'secondary'}>{d.restock ? 'Restocked' : 'No restock'}</Badge><span className="text-muted-foreground">{d.date}</span></span>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/inventory/debit-notes')}><ArrowLeft /> Back</Button>
            <Button variant="outline" onClick={() => navigate(`/inventory/purchases/${d.purchaseId}`)}>View purchase</Button>
          </div>
        }
      />
      <SectionCard title="Details">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <DetailRow label="Supplier" value={d.supplierSnapshot?.name} />
          <DetailRow label="Reason" value={d.reason || '—'} />
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
              {d.lines.map((l) => (
                <TableRow key={l.purchaseLineId}>
                  <TableCell className="font-medium">{l.nameSnapshot}</TableCell>
                  <TableCell className="num text-right">{l.qty}</TableCell>
                  <TableCell className="num text-right">{formatINR(l.ratePaise)}</TableCell>
                  <TableCell className="num text-right">{formatINR(l.amountPaise)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex justify-end border-t border-border pt-3 text-sm font-semibold">
          <span>Total <span className="num">{formatINR(d.totalPaise)}</span></span>
        </div>
      </SectionCard>
    </div>
  );
}
