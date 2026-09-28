/**
 * Shared aggregation for the financial statements (TD §6.2, BR-ACC-13/14/15). All three are
 * "derived purely from accounts + journalEntries — there is no separate stored statement data" —
 * this is the one place that sums non-voided journal lines per account so Trial Balance, P&L and
 * Balance Sheet never each reimplement the same arithmetic.
 */
import { accountBalance, type Account, type JournalEntry } from '@hynish/domain';

export interface AccountSum {
  account: Account;
  debitPaise: number;
  creditPaise: number;
  balancePaise: number;
}

/** Sum debit/credit per account across POSTED (non-voided) entries only (BR-ACC-07). */
export function sumByAccount(entries: readonly JournalEntry[], accounts: readonly Account[]): AccountSum[] {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const e of entries) {
    if (e.status !== 'posted') continue;
    for (const l of e.lines) {
      const t = totals.get(l.accountId) ?? { debit: 0, credit: 0 };
      t.debit += l.debitPaise;
      t.credit += l.creditPaise;
      totals.set(l.accountId, t);
    }
  }
  return accounts
    .map((account) => {
      const t = totals.get(account.id) ?? { debit: 0, credit: 0 };
      return {
        account,
        debitPaise: t.debit,
        creditPaise: t.credit,
        balancePaise: accountBalance(account.type, t.debit, t.credit),
      };
    })
    .filter((s) => s.debitPaise > 0 || s.creditPaise > 0);
}
