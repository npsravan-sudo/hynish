import { ModulePlaceholder } from '@/features/_shared/module-placeholder';
import { Coins, FileCheck2 } from 'lucide-react';

// Chart of Accounts / Journal / General Ledger / Trial Balance / P&L / Balance Sheet / Payables /
// Cash Book are implemented (Phase 7) in their own modules — see chart-of-accounts-page.tsx,
// journal-list-page.tsx, journal-detail-page.tsx, general-ledger-page.tsx, trial-balance-page.tsx,
// profit-loss-page.tsx, balance-sheet-page.tsx, payables-page.tsx, cash-book-page.tsx. Daily
// Expenses and GST Filing remain placeholders — deliberately out of Phase 7 scope (§33: "do not
// prematurely build the complete Expenses module"; GST Filing is a later reporting phase). The
// accounting foundation (Chart of Accounts, postJournalTx, expense-category→account linkage
// BR-ACC-19) is ready to receive both when their phase lands.

export function ExpensesPage() {
  return (
    <ModulePlaceholder
      title="Expenses"
      description="Daily expenses by category."
      icon={Coins}
      phase="Phase 8"
      legacyRefs={['Dr category account / Cr Cash-or-Bank; category snapshot kept (BR-ACC-10 / BR-EXP-02).']}
    />
  );
}

export function GstFilingPage() {
  return (
    <ModulePlaceholder
      title="GST Filing"
      description="Monthly GSTR-1 style summary and exports."
      icon={FileCheck2}
      phase="Phase 9"
      legacyRefs={[
        'Without-GST invoices shown separately, excluded from taxable totals (BR-RPT-05).',
        'Not a substitute for a CA review (BR-RPT-07).',
      ]}
    />
  );
}
