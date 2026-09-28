/**
 * Accounting domain (BR-ACC-01..21, LEGACY-COMPATIBILITY §30/§31, TD §6.1). Pure, deterministic.
 * Double-entry with the exact legacy chart of accounts (system account ids preserved). The
 * journal-balance invariant (debits === credits, exact in paise) is validated here; the actual
 * posting is a server-authoritative gateway (contract below), mirroring the legacy postJournal().
 */

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Journal ref types (TD §6.1.3). Ties an entry to its source document for find/reverse. */
export const JOURNAL_REF_TYPES = [
  'invoice', 'invoice_cogs', 'purchase', 'expense', 'payroll', 'staffpayroll',
  'credit_note', 'credit_note_cogs', 'debit_note', 'payment_in', 'payment_out',
  'migration_opening',
] as const;
export type JournalRefType = (typeof JOURNAL_REF_TYPES)[number];

export interface SystemAccount {
  id: string;
  code: number;
  name: string;
  type: AccountType;
  isSystem: true;
}

/**
 * Default chart of accounts (BR-ACC seed, TD §6.1.1). IDs are preserved from the legacy app so
 * migrated journal entries keep referencing the same accounts. Numeric codes are NOT VERIFIED
 * from the source (OQ-11); the values below are a conventional layout and are the ONE place they
 * are defined — adjust here once confirmed.
 */
export const DEFAULT_CHART_OF_ACCOUNTS: readonly SystemAccount[] = [
  // Assets
  { id: 'acc-cash', code: 1000, name: 'Cash in Hand', type: 'asset', isSystem: true },
  { id: 'acc-bank', code: 1010, name: 'Bank Account', type: 'asset', isSystem: true },
  { id: 'acc-ar', code: 1100, name: 'Accounts Receivable', type: 'asset', isSystem: true },
  { id: 'acc-inventory', code: 1200, name: 'Inventory', type: 'asset', isSystem: true },
  { id: 'acc-gst-input', code: 1300, name: 'GST Input Credit (ITC)', type: 'asset', isSystem: true },
  // Liabilities
  { id: 'acc-ap', code: 2000, name: 'Accounts Payable', type: 'liability', isSystem: true },
  { id: 'acc-gst-output', code: 2100, name: 'GST Output Payable', type: 'liability', isSystem: true },
  { id: 'acc-loans', code: 2200, name: 'Loans Payable', type: 'liability', isSystem: true },
  // Equity
  { id: 'acc-capital', code: 3000, name: "Owner's Capital", type: 'equity', isSystem: true },
  { id: 'acc-drawings', code: 3100, name: "Owner's Drawings", type: 'equity', isSystem: true },
  // Income
  { id: 'acc-sales', code: 4000, name: 'Sales Revenue', type: 'income', isSystem: true },
  { id: 'acc-other-income', code: 4100, name: 'Other Income', type: 'income', isSystem: true },
  // Expense
  { id: 'acc-cogs', code: 5000, name: 'Cost of Goods Sold', type: 'expense', isSystem: true },
  { id: 'acc-other-expense', code: 5090, name: 'Other Expenses', type: 'expense', isSystem: true },
] as const;

/** Auto-generated expense-category accounts start at this code, stepping by 10 (BR-ACC-19). */
export const EXPENSE_ACCOUNT_CODE_START = 5100;
export const EXPENSE_ACCOUNT_CODE_STEP = 10;

/** Default expense categories (BR-EXP-04, TD §6.1.2). */
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent', 'Electricity', 'Water', 'Staff Salary/Wages', 'Transport/Delivery',
  'Packing Material', 'Stationery/Printing', 'Maintenance & Repairs', 'Marketing/Advertising',
  'Tea/Refreshments', 'Bank Charges', 'Other',
] as const;

/** Debit-normal accounts are asset/expense; credit-normal are liability/equity/income (BR-ACC-06). */
export function normalSide(type: AccountType): 'debit' | 'credit' {
  return type === 'asset' || type === 'expense' ? 'debit' : 'credit';
}

/**
 * Account balance from summed debit/credit (BR-ACC-06/07): debit-normal (asset, expense) =
 * Σdr − Σcr; credit-normal (liability, equity, income) = Σcr − Σdr. Pure — the caller sums the
 * (non-voided) journal lines for the account; nothing is cached (TD §6.1.7, recomputed live).
 */
export function accountBalance(type: AccountType, sumDebitPaise: number, sumCreditPaise: number): number {
  return normalSide(type) === 'debit' ? sumDebitPaise - sumCreditPaise : sumCreditPaise - sumDebitPaise;
}

export interface JournalLineInput {
  accountId: string;
  debitPaise: number;
  creditPaise: number;
}

/** A line has EITHER a debit or a credit, both non-negative (BR-ACC-03). */
export function isValidLine(line: JournalLineInput): boolean {
  if (line.debitPaise < 0 || line.creditPaise < 0) return false;
  if (line.debitPaise > 0 && line.creditPaise > 0) return false;
  return Number.isInteger(line.debitPaise) && Number.isInteger(line.creditPaise);
}

/** Drop lines where both sides are zero (BR-ACC-02). */
export function pruneZeroLines(lines: readonly JournalLineInput[]): JournalLineInput[] {
  return lines.filter((l) => l.debitPaise !== 0 || l.creditPaise !== 0);
}

export interface JournalValidation {
  ok: boolean;
  totalDebitPaise: number;
  totalCreditPaise: number;
  reason?: 'unbalanced' | 'empty' | 'invalid_line';
}

/**
 * Validate a journal entry (BR-ACC-01/02/03). Balanced means Σdebit === Σcredit EXACTLY in
 * paise. An entry with no surviving lines is rejected as empty. Returns a structured result so
 * the posting gateway can refuse before persistence.
 */
export function validateJournal(lines: readonly JournalLineInput[]): JournalValidation {
  if (!lines.every(isValidLine)) {
    return { ok: false, totalDebitPaise: 0, totalCreditPaise: 0, reason: 'invalid_line' };
  }
  const pruned = pruneZeroLines(lines);
  if (pruned.length === 0) {
    return { ok: false, totalDebitPaise: 0, totalCreditPaise: 0, reason: 'empty' };
  }
  const totalDebit = pruned.reduce((s, l) => s + l.debitPaise, 0);
  const totalCredit = pruned.reduce((s, l) => s + l.creditPaise, 0);
  if (totalDebit !== totalCredit) {
    return { ok: false, totalDebitPaise: totalDebit, totalCreditPaise: totalCredit, reason: 'unbalanced' };
  }
  return { ok: true, totalDebitPaise: totalDebit, totalCreditPaise: totalCredit };
}

/** Cash-or-Bank account by payment mode (BR-PAY-04): Cash → acc-cash, everything else → acc-bank. */
export function cashOrBankAccountId(mode: string): 'acc-cash' | 'acc-bank' {
  return mode === 'Cash' ? 'acc-cash' : 'acc-bank';
}

// ---- Server-authoritative posting gateway (implemented as a Cloud Function) ---------------
export interface PostJournalRequest {
  businessId: string;
  date: string;
  locationId: string;
  refType: JournalRefType;
  refId: string;
  refLabel: string;
  lines: JournalLineInput[];
}

/**
 * Contract for the single posting gateway (BR-ACC-04, TD §6.1.4). The implementation validates
 * with validateJournal() and refuses to persist anything that doesn't balance. Edits/deletes are
 * handled by VOIDING prior entries for (refType, refId) and re-posting (BR-ACC-05) — never an
 * in-place adjustment, and never a client write.
 */
export interface AccountingService {
  postJournal(request: PostJournalRequest): Promise<{ journalEntryId: string }>;
  reverseJournalForRef(businessId: string, refType: JournalRefType, refId: string): Promise<void>;
}

// ---- Reconciliation / consistency checks (§49) — detection only, never auto-repaired ------
export interface ReconciliationEntryInput {
  id: string;
  status: 'posted' | 'voided';
  refType: string;
  refId: string;
  lines: readonly JournalLineInput[];
}

/** Entries whose (non-pruned) lines fail the balance invariant — should be structurally unreachable
 *  since postJournal refuses them, so a hit here is a real data-integrity alert (TD §6.2). */
export function findUnbalancedEntries(entries: readonly ReconciliationEntryInput[]): string[] {
  return entries
    .filter((e) => e.status === 'posted' && !validateJournal(e.lines).ok)
    .map((e) => e.id);
}

/** More than one POSTED entry for the same (refType, refId) — edit/delete must void before re-posting
 *  (BR-ACC-05), so two posted entries for one ref means a posting bypassed the void step. */
export function findDuplicatePostedRefs(entries: readonly ReconciliationEntryInput[]): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.status !== 'posted') continue;
    const key = `${e.refType}:${e.refId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([key]) => key);
}

/** Lines referencing an accountId outside the business's known Chart of Accounts (orphan reference). */
export function findOrphanAccountRefs(
  entries: readonly ReconciliationEntryInput[],
  knownAccountIds: ReadonlySet<string>,
): { entryId: string; accountId: string }[] {
  const out: { entryId: string; accountId: string }[] = [];
  for (const e of entries) {
    for (const l of e.lines) {
      if (!knownAccountIds.has(l.accountId)) out.push({ entryId: e.id, accountId: l.accountId });
    }
  }
  return out;
}
