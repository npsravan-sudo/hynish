/**
 * Accounting write service (Phase 7 §4). The ONLY write path for the Chart of Accounts and Cash
 * Book — thin, typed wrappers over the server-authoritative callables. There is deliberately no
 * "post journal" wrapper here: the legacy app never exposes an arbitrary debit/credit screen (TD
 * §6.1), so nothing in the UI posts journal entries directly — they are always a side effect of
 * sales/purchases/payments, already covered by those services.
 */
import type { CreateAccount, CreateExpense } from '@hynish/domain';
import { callable } from '@/lib/firebase/functions';

type Req = { requestId: string };

const seedFn = callable<{ businessId: string }, { created: number; total: number }>('seedChartOfAccounts');
const saveAccountFn = callable<CreateAccount & { businessId: string } & Req, { accountId: string }>('saveAccount');
const deleteAccountFn = callable<{ businessId: string; id: string }, { ok: boolean }>('deleteAccount');
const seedExpenseCategoriesFn = callable<{ businessId: string }, { created: number; total: number }>('seedExpenseCategories');
const saveExpenseFn = callable<CreateExpense & { businessId: string; id?: string } & Req, { expenseId: string }>('saveExpense');
const deleteExpenseFn = callable<{ businessId: string; id: string } & Req, { ok: boolean }>('deleteExpense');

export interface LogCashEntryInput {
  date: string;
  locationId: string;
  type: 'in' | 'out';
  category: string;
  amountPaise: number;
  mode: string;
  reference: string;
  notes: string;
}
const logCashEntryFn = callable<LogCashEntryInput & { businessId: string } & Req, { cashEntryId: string }>('logCashEntry');

export function createAccountingService(businessId: string) {
  return {
    accounts: {
      seedDefaults: () => seedFn({ businessId }),
      save: (input: CreateAccount & Req) => saveAccountFn({ businessId, ...input }),
      remove: (id: string) => deleteAccountFn({ businessId, id }),
    },
    cashBook: {
      log: (input: LogCashEntryInput & Req) => logCashEntryFn({ businessId, ...input }),
    },
    expenses: {
      seedCategories: () => seedExpenseCategoriesFn({ businessId }),
      save: (input: CreateExpense & { id?: string } & Req) => saveExpenseFn({ businessId, ...input }),
      remove: (id: string, requestId: string) => deleteExpenseFn({ businessId, id, requestId }),
    },
  };
}
export type AccountingService = ReturnType<typeof createAccountingService>;
