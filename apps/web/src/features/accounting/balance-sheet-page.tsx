import { useMemo, useState } from 'react';
import { formatINR, todayISO } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { useRepositories } from '@/hooks/use-master-data';
import { useLedgerAggregate } from './use-ledger-aggregate';
import { useAllAccounts } from './use-accounts';
import { sumByAccount, type AccountSum } from './statement-helpers';

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'text-base font-semibold' : 'text-sm text-muted-foreground'}`}>
      <span>{label}</span><span className="num text-foreground">{formatINR(value)}</span>
    </div>
  );
}

/** Balance Sheet (BR-ACC-15, TD §6.2): a point-in-time "as of" snapshot. Assets/Liabilities/Equity
 * balances, plus Retained Earnings = cumulative lifetime income − expense as of that date, folded
 * into Equity. Same balanced check as Trial Balance (Assets = Liabilities + Equity). */
export function BalanceSheetPage() {
  const repos = useRepositories();
  const { accounts, loading: accountsLoading } = useAllAccounts();
  const [asOf, setAsOf] = useState(todayISO());

  const params = useMemo(() => ({
    filters: [
      { field: 'status', op: '==' as const, value: 'posted' },
      { field: 'date', op: '<=' as const, value: asOf },
    ],
    orderByField: 'date' as const,
    limit: 500,
  }), [asOf]);
  const { items: entries, loading, error, truncated, refresh } = useLedgerAggregate(repos.journalEntries, params);

  const { assets, liabilities, equity, retainedEarnings, totalAssets, totalLiabEquity, balanced } = useMemo(() => {
    const sums = sumByAccount(entries, accounts);
    const byType = (t: string): AccountSum[] => sums.filter((s) => s.account.type === t);
    const assetsList = byType('asset');
    const liabList = byType('liability');
    const equityList = byType('equity');
    const income = byType('income').reduce((a, s) => a + s.balancePaise, 0);
    const expense = byType('expense').reduce((a, s) => a + s.balancePaise, 0);
    const retained = income - expense;
    const totAssets = assetsList.reduce((a, s) => a + s.balancePaise, 0);
    const totLiab = liabList.reduce((a, s) => a + s.balancePaise, 0);
    const totEquity = equityList.reduce((a, s) => a + s.balancePaise, 0) + retained;
    return {
      assets: assetsList, liabilities: liabList, equity: equityList, retainedEarnings: retained,
      totalAssets: totAssets, totalLiabEquity: totLiab + totEquity, balanced: totAssets === totLiab + totEquity,
    };
  }, [entries, accounts]);

  if (loading || accountsLoading) return <TableSkeleton rows={8} cols={2} />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Balance Sheet"
        description={`As of ${asOf}. All locations combined (BR-ACC-21).`}
        actions={<Badge variant={balanced ? 'success' : 'danger'}>{balanced ? 'Balanced ✓' : 'Unbalanced — critical integrity alert'}</Badge>}
      />
      <SectionCard title="As of date">
        <Field label="Date" htmlFor="bs-date"><Input id="bs-date" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
      </SectionCard>

      <SectionCard title="Assets" {...(truncated ? { description: 'Results may be incomplete — the ledger is large.' } : {})}>
        <div className="flex flex-col gap-2">
          {assets.length === 0 ? <p className="text-sm text-muted-foreground">No asset balances.</p> : assets.map((s) => <Row key={s.account.id} label={s.account.name} value={s.balancePaise} />)}
          <div className="border-t border-border pt-2"><Row label="Total Assets" value={totalAssets} strong /></div>
        </div>
      </SectionCard>

      <SectionCard title="Liabilities">
        <div className="flex flex-col gap-2">
          {liabilities.length === 0 ? <p className="text-sm text-muted-foreground">No liability balances.</p> : liabilities.map((s) => <Row key={s.account.id} label={s.account.name} value={s.balancePaise} />)}
        </div>
      </SectionCard>

      <SectionCard title="Equity">
        <div className="flex flex-col gap-2">
          {equity.map((s) => <Row key={s.account.id} label={s.account.name} value={s.balancePaise} />)}
          <Row label="Retained Earnings" value={retainedEarnings} />
          <div className="border-t border-border pt-2"><Row label="Total Liabilities + Equity" value={totalLiabEquity} strong /></div>
        </div>
      </SectionCard>
    </div>
  );
}
