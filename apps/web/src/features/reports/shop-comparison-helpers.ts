/**
 * Shop Comparison aggregation (BR-ACC-20/21, TD §3.5). Per location: sales/COGS from the ledger
 * (Sales Revenue / COGS account balances within the range), gross = sales − COGS, expenses = every
 * expense-type account except COGS, net = gross − expenses. Bill count comes straight from
 * invoices, not the ledger. A combined row sums every location. Reuses `sumByAccount` (Phase 7) —
 * no second ledger-summing engine (§33).
 */
import type { Account, JournalEntry } from '@hynish/domain';
import { sumByAccount } from '@/features/accounting/statement-helpers';

export interface LocationLike {
  id: string;
  name: string;
}

export interface LocationComparisonRow {
  locationId: string;
  name: string;
  billCount: number;
  salesPaise: number;
  cogsPaise: number;
  grossProfitPaise: number;
  expenseTotalPaise: number;
  netProfitPaise: number;
}

export function shopComparisonRows(
  entries: readonly JournalEntry[],
  accounts: readonly Account[],
  invoices: readonly { locationId: string }[],
  locations: readonly LocationLike[],
): { rows: LocationComparisonRow[]; combined: LocationComparisonRow } {
  const expenseAccountIds = new Set(accounts.filter((a) => a.type === 'expense' && a.id !== 'acc-cogs').map((a) => a.id));

  const rows = locations.map((loc): LocationComparisonRow => {
    const locEntries = entries.filter((e) => e.locationId === loc.id);
    const sums = sumByAccount(locEntries, accounts);
    const salesPaise = sums.find((s) => s.account.id === 'acc-sales')?.balancePaise ?? 0;
    const cogsPaise = sums.find((s) => s.account.id === 'acc-cogs')?.balancePaise ?? 0;
    const expenseTotalPaise = sums.filter((s) => expenseAccountIds.has(s.account.id)).reduce((sum, s) => sum + s.balancePaise, 0);
    const grossProfitPaise = salesPaise - cogsPaise;
    const netProfitPaise = grossProfitPaise - expenseTotalPaise;
    const billCount = invoices.filter((i) => i.locationId === loc.id).length;
    return { locationId: loc.id, name: loc.name, billCount, salesPaise, cogsPaise, grossProfitPaise, expenseTotalPaise, netProfitPaise };
  });

  const combined = rows.reduce<LocationComparisonRow>(
    (acc, r) => ({
      locationId: '__combined__', name: 'Combined',
      billCount: acc.billCount + r.billCount,
      salesPaise: acc.salesPaise + r.salesPaise,
      cogsPaise: acc.cogsPaise + r.cogsPaise,
      grossProfitPaise: acc.grossProfitPaise + r.grossProfitPaise,
      expenseTotalPaise: acc.expenseTotalPaise + r.expenseTotalPaise,
      netProfitPaise: acc.netProfitPaise + r.netProfitPaise,
    }),
    { locationId: '__combined__', name: 'Combined', billCount: 0, salesPaise: 0, cogsPaise: 0, grossProfitPaise: 0, expenseTotalPaise: 0, netProfitPaise: 0 },
  );

  return { rows, combined };
}
