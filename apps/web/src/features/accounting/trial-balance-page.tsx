import { useMemo } from 'react';
import { formatINR, normalSide } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { useRepositories } from '@/hooks/use-master-data';
import { useLedgerAggregate } from './use-ledger-aggregate';
import { useAllAccounts } from './use-accounts';
import { sumByAccount } from './statement-helpers';

const PARAMS = { filters: [{ field: 'status', op: '==' as const, value: 'posted' }], orderByField: 'date' as const, limit: 500 };

/** Trial Balance (BR-ACC-13, TD §6.2): all-time, all locations combined. Each account's balance is
 * split into a Debit or Credit column by sign+normal-side — a normal (non-negative) balance lands in
 * its own normal-side column; an abnormal (negative) balance lands in the opposite column. Debits
 * must equal credits; anything else is a critical integrity alert (structurally unreachable since
 * postJournal refuses unbalanced entries). */
export function TrialBalancePage() {
  const repos = useRepositories();
  const { accounts, loading: accountsLoading } = useAllAccounts();
  const { items: entries, loading, error, truncated, refresh } = useLedgerAggregate(repos.journalEntries, PARAMS);

  const rows = useMemo(() => {
    const sums = sumByAccount(entries, accounts);
    return sums.map((s) => {
      const side = normalSide(s.account.type);
      const abnormal = s.balancePaise < 0;
      const debitCol = (side === 'debit') !== abnormal ? Math.abs(s.balancePaise) : 0;
      const creditCol = (side === 'debit') !== abnormal ? 0 : Math.abs(s.balancePaise);
      return { ...s, debitCol, creditCol };
    });
  }, [entries, accounts]);

  const totalDebit = rows.reduce((s, r) => s + r.debitCol, 0);
  const totalCredit = rows.reduce((s, r) => s + r.creditCol, 0);
  const balanced = totalDebit === totalCredit;

  if (loading || accountsLoading) return <TableSkeleton rows={8} cols={3} />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trial Balance"
        description="All-time, all locations combined."
        actions={
          <Badge variant={balanced ? 'success' : 'danger'}>
            {balanced ? 'Balanced ✓' : 'Unbalanced — critical integrity alert'}
          </Badge>
        }
      />
      <SectionCard title="Accounts" {...(truncated ? { description: 'The ledger is large — this trial balance may not reflect every historical entry.' } : {})}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.account.id}>
                  <TableCell>{r.account.name}</TableCell>
                  <TableCell className="num text-right">{r.debitCol > 0 ? formatINR(r.debitCol) : '—'}</TableCell>
                  <TableCell className="num text-right">{r.creditCol > 0 ? formatINR(r.creditCol) : '—'}</TableCell>
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
