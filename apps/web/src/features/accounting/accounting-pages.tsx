import { ModulePlaceholder } from '@/features/_shared/module-placeholder';
import {
  BookOpen,
  BookText,
  Scale,
  TrendingUp,
  Landmark,
  Banknote,
  Coins,
  FileCheck2,
} from 'lucide-react';

const ACC_PHASE = 'Phase 5';

export function ChartOfAccountsPage() {
  return (
    <ModulePlaceholder
      title="Chart of Accounts"
      description="14 system accounts plus per-category expense accounts."
      icon={BookOpen}
      phase={ACC_PHASE}
      legacyRefs={['System accounts cannot be deleted; no delete once posted to (BR-ACC-17).']}
    />
  );
}

export function JournalPage() {
  return (
    <ModulePlaceholder
      title="Journal"
      description="Double-entry journal (server-posted)."
      icon={BookText}
      phase={ACC_PHASE}
      legacyRefs={['Every entry balances exactly; edits void-and-repost (BR-ACC-01/05).']}
    />
  );
}

export function GeneralLedgerPage() {
  return (
    <ModulePlaceholder
      title="General Ledger"
      description="Per-account running balances."
      icon={BookText}
      phase={ACC_PHASE}
      legacyRefs={['Sorted by date then createdAt (BR-ACC-16).']}
    />
  );
}

export function TrialBalancePage() {
  return (
    <ModulePlaceholder
      title="Trial Balance"
      description="All-time, all-locations balance check."
      icon={Scale}
      phase={ACC_PHASE}
      legacyRefs={['Balanced when total debit = total credit (BR-ACC-13).']}
    />
  );
}

export function ProfitLossPage() {
  return (
    <ModulePlaceholder
      title="Profit & Loss"
      description="Income − COGS − expenses."
      icon={TrendingUp}
      phase={ACC_PHASE}
      legacyRefs={['Defaults to month-to-date (BR-ACC-14).']}
    />
  );
}

export function BalanceSheetPage() {
  return (
    <ModulePlaceholder
      title="Balance Sheet"
      description="Assets, liabilities and equity as of a date."
      icon={Landmark}
      phase={ACC_PHASE}
      legacyRefs={['Retained earnings = lifetime income − expense (BR-ACC-15).']}
    />
  );
}

export function CashBookPage() {
  return (
    <ModulePlaceholder
      title="Cash Book"
      description="Informal cash ledger (never posts to the journal)."
      icon={Banknote}
      phase={ACC_PHASE}
      legacyRefs={['Balance = opening + all-time net, per location (BR-CASH-02/03).']}
    />
  );
}

export function ExpensesPage() {
  return (
    <ModulePlaceholder
      title="Expenses"
      description="Daily expenses by category."
      icon={Coins}
      phase={ACC_PHASE}
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
      phase="Phase 6"
      legacyRefs={[
        'Without-GST invoices shown separately, excluded from taxable totals (BR-RPT-05).',
        'Not a substitute for a CA review (BR-RPT-07).',
      ]}
    />
  );
}
