import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatINR, todayISO } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { useRepositories } from '@/hooks/use-master-data';
import { useLedgerAggregate } from './use-ledger-aggregate';
import { useAllAccounts } from './use-accounts';
import { sumByAccount } from './statement-helpers';

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Profit & Loss (BR-ACC-14, TD §6.2): Income − COGS = Gross Profit; Gross Profit − every other
 * expense account = Net Profit. Defaults to month-to-date, all locations (BR-ACC-21). */
export function ProfitLossPage() {
  const repos = useRepositories();
  const { accounts, loading: accountsLoading } = useAllAccounts();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());

  const params = useMemo(() => ({
    filters: [
      { field: 'status', op: '==' as const, value: 'posted' },
      { field: 'date', op: '>=' as const, value: from },
      { field: 'date', op: '<=' as const, value: to },
    ],
    orderByField: 'date' as const,
    limit: 500,
  }), [from, to]);
  const { items: entries, loading, error, truncated, refresh } = useLedgerAggregate(repos.journalEntries, params);

  const { incomeRows, cogs, expenseRows, totalIncome, grossProfit, totalOtherExpense, netProfit } = useMemo(() => {
    const sums = sumByAccount(entries, accounts);
    const income = sums.filter((s) => s.account.type === 'income');
    const cogsSum = sums.find((s) => s.account.id === 'acc-cogs')?.balancePaise ?? 0;
    const expenses = sums.filter((s) => s.account.type === 'expense' && s.account.id !== 'acc-cogs');
    const totIncome = income.reduce((a, s) => a + s.balancePaise, 0);
    const gross = totIncome - cogsSum;
    const totExpense = expenses.reduce((a, s) => a + s.balancePaise, 0);
    return { incomeRows: income, cogs: cogsSum, expenseRows: expenses, totalIncome: totIncome, grossProfit: gross, totalOtherExpense: totExpense, netProfit: gross - totExpense };
  }, [entries, accounts]);

  if (loading || accountsLoading) return <TableSkeleton rows={8} cols={2} />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const Row = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
    <div className={`flex items-center justify-between ${strong ? 'text-base font-semibold' : 'text-sm text-muted-foreground'}`}>
      <span>{label}</span><span className="num text-foreground">{formatINR(value)}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profit & Loss" description="Defaults to month-to-date; all locations combined (BR-ACC-21)." />
      <SectionCard title="Period">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="From" htmlFor="pl-from"><Input id="pl-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" htmlFor="pl-to"><Input id="pl-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="Income" {...(truncated ? { description: 'Results may be incomplete — the ledger is large.' } : {})}>
        <div className="flex flex-col gap-2">
          {incomeRows.length === 0 ? <p className="text-sm text-muted-foreground">No income posted in this period.</p> : incomeRows.map((s) => <Row key={s.account.id} label={s.account.name} value={s.balancePaise} />)}
          <Row label="Total Income" value={totalIncome} strong />
          <Row label="Cost of Goods Sold" value={-cogs} />
          <div className="border-t border-border pt-2"><Row label="Gross Profit" value={grossProfit} strong /></div>
        </div>
      </SectionCard>

      <SectionCard title="Expenses">
        <div className="flex flex-col gap-2">
          {expenseRows.length === 0 ? <p className="text-sm text-muted-foreground">No other expenses posted in this period.</p> : expenseRows.map((s) => <Row key={s.account.id} label={s.account.name} value={-s.balancePaise} />)}
          <div className="border-t border-border pt-2"><Row label="Total expenses" value={-totalOtherExpense} strong /></div>
        </div>
      </SectionCard>

      <SectionCard title="Net Profit">
        <div className={`flex items-center gap-3 text-2xl font-bold ${netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
          {netProfit >= 0 ? <TrendingUp /> : <TrendingDown />}
          <span className="num">{formatINR(Math.abs(netProfit))}</span>
          <span className="text-base font-medium text-muted-foreground">{netProfit >= 0 ? 'Profit' : 'Loss'}</span>
        </div>
      </SectionCard>
    </div>
  );
}
