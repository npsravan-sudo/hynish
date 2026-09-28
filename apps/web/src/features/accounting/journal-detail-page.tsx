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
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { DetailRow } from '@/features/_shared/detail-row';
import { useAllAccounts } from './use-accounts';

export function JournalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const locations = useAuthStore((s) => s.locations);
  const { data: e, loading, error, notFound } = useEntity(repos.journalEntries, id);
  const { accounts } = useAllAccounts();

  if (loading) return <PageSkeleton />;
  if (error || notFound || !e) return <ErrorState title="Journal entry not found" message={error ?? 'It may have been removed.'} />;

  const accName = (accId: string) => accounts.find((a) => a.id === accId)?.name ?? accId;
  const totalDebit = e.lines.reduce((s, l) => s + l.debitPaise, 0);
  const totalCredit = e.lines.reduce((s, l) => s + l.creditPaise, 0);
  const balanced = totalDebit === totalCredit;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={e.refLabel || e.refId}
        description={<span className="flex items-center gap-2 capitalize"><Badge variant={e.status === 'posted' ? 'success' : 'secondary'} className="capitalize">{e.status}</Badge><span className="text-muted-foreground">{e.refType.replace(/_/g, ' ')} · {e.date}</span></span>}
        actions={<Button variant="ghost" onClick={() => navigate('/accounting/journal')}><ArrowLeft /> Back</Button>}
      />

      <SectionCard title="Details">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <DetailRow label="Location" value={locations.find((l) => l.id === e.locationId)?.name ?? e.locationId} />
          <DetailRow label="Reference type" value={<span className="capitalize">{e.refType.replace(/_/g, ' ')}</span>} />
          <DetailRow label="Reference id" value={<span className="num">{e.refId}</span>} />
          {e.status === 'voided' && (
            <>
              <DetailRow label="Voided" value={e.voidedAt ? new Date(e.voidedAt).toLocaleString('en-IN') : null} />
              <DetailRow label="Void reason" value={<span className="capitalize">{e.voidReason}</span>} />
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Lines"
        action={
          <Badge variant={balanced ? 'success' : 'danger'}>
            {balanced ? 'Balanced' : 'Unbalanced — integrity issue'}
          </Badge>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {e.lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>{accName(l.accountId)}</TableCell>
                  <TableCell className="num text-right">{l.debitPaise > 0 ? formatINR(l.debitPaise) : '—'}</TableCell>
                  <TableCell className="num text-right">{l.creditPaise > 0 ? formatINR(l.creditPaise) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex justify-end gap-8 border-t border-border pt-3 text-sm font-semibold">
          <span>Total debit <span className="num">{formatINR(totalDebit)}</span></span>
          <span>Total credit <span className="num">{formatINR(totalCredit)}</span></span>
        </div>
      </SectionCard>
    </div>
  );
}
