import { ModulePlaceholder } from '@/features/_shared/module-placeholder';
import { FileCheck2 } from 'lucide-react';

// Chart of Accounts / Journal / General Ledger / Trial Balance / P&L / Balance Sheet / Payables /
// Cash Book (Phase 7) and Daily Expenses (Phase 8) are implemented in their own modules — see
// chart-of-accounts-page.tsx, journal-list-page.tsx, journal-detail-page.tsx,
// general-ledger-page.tsx, trial-balance-page.tsx, profit-loss-page.tsx, balance-sheet-page.tsx,
// payables-page.tsx, cash-book-page.tsx, expense-list/form/detail-page.tsx. GST Filing remains a
// placeholder — a later reporting phase (§9 GST Filing, TD §6.5).

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
