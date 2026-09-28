/**
 * Sales posting helpers (BR-ACC-08/09, BR-COGS-01, BR-PAY-02/03/04). Pure and deterministic — the
 * single source of the journal lines and payment-status math reused by the server-authoritative
 * billing/payment functions and the tests. NO Firestore. Mirrors the legacy `journalLinesFor*`
 * helpers (TD §6.1.5) exactly, so migrated books reconcile.
 */
import { cashOrBankAccountId, type JournalLineInput } from './accounting.js';
import { OUTSTANDING_THRESHOLD_PAISE, type PaymentStatus } from './constants.js';

export interface InvoicePostingInput {
  subtotalPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  grandTotalPaise: number;
  /** The amount received AT BILLING only (later payments post their own payment_in entries). */
  atBillingPaidPaise: number;
}

/**
 * Invoice journal (`invoice`, BR-ACC-08): Dr Cash for `paidNow = min(atBillingPaid, grandTotal)`,
 * Dr AR for the remainder, Cr Sales Revenue for `subtotal + roundOff`, Cr GST Output for the tax.
 * At-billing cash always books to acc-cash regardless of mode (BR-PAY-06, OQ-07). Zero lines drop.
 */
export function journalLinesForInvoice(i: InvoicePostingInput): JournalLineInput[] {
  const paidNow = Math.max(0, Math.min(i.atBillingPaidPaise, i.grandTotalPaise));
  const receivable = i.grandTotalPaise - paidNow;
  const revenue = i.subtotalPaise + i.roundOffPaise;
  const lines: JournalLineInput[] = [];
  if (paidNow > 0) lines.push({ accountId: 'acc-cash', debitPaise: paidNow, creditPaise: 0 });
  if (receivable > 0) lines.push({ accountId: 'acc-ar', debitPaise: receivable, creditPaise: 0 });
  if (revenue !== 0) lines.push({ accountId: 'acc-sales', debitPaise: 0, creditPaise: revenue });
  if (i.taxPaise > 0) lines.push({ accountId: 'acc-gst-output', debitPaise: 0, creditPaise: i.taxPaise });
  return lines;
}

/** Invoice COGS journal (`invoice_cogs`, BR-COGS-01): Dr COGS / Cr Inventory for Σ unitCost×baseQty; empty when 0. */
export function journalLinesForInvoiceCogs(totalCogsPaise: number): JournalLineInput[] {
  if (totalCogsPaise <= 0) return [];
  return [
    { accountId: 'acc-cogs', debitPaise: totalCogsPaise, creditPaise: 0 },
    { accountId: 'acc-inventory', debitPaise: 0, creditPaise: totalCogsPaise },
  ];
}

/**
 * Purchase journal (`purchase`, BR-PUR-04): Dr Inventory (total), Cr Cash (paid now), Cr Accounts
 * Payable (remainder). Purchases carry NO GST in the source (BR-PUR-08 / OQ-06) — `acc-gst-input`
 * is never posted here. At-billing cash books to acc-cash (mirrors the invoice at-billing rule).
 */
export function journalLinesForPurchase(totalPaise: number, atBillingPaidPaise: number): JournalLineInput[] {
  const paidNow = Math.max(0, Math.min(atBillingPaidPaise, totalPaise));
  const payable = totalPaise - paidNow;
  const lines: JournalLineInput[] = [{ accountId: 'acc-inventory', debitPaise: totalPaise, creditPaise: 0 }];
  if (paidNow > 0) lines.push({ accountId: 'acc-cash', debitPaise: 0, creditPaise: paidNow });
  if (payable > 0) lines.push({ accountId: 'acc-ap', debitPaise: 0, creditPaise: payable });
  return lines;
}

/** Customer payment (`payment_in`, BR-PAY-03): Dr Cash-or-Bank(mode) / Cr Accounts Receivable. */
export function journalLinesForPaymentIn(amountPaise: number, mode: string): JournalLineInput[] {
  return [
    { accountId: cashOrBankAccountId(mode), debitPaise: amountPaise, creditPaise: 0 },
    { accountId: 'acc-ar', debitPaise: 0, creditPaise: amountPaise },
  ];
}

/** Supplier payment (`payment_out`, BR-PAY-03): Dr Accounts Payable / Cr Cash-or-Bank(mode). */
export function journalLinesForPaymentOut(amountPaise: number, mode: string): JournalLineInput[] {
  return [
    { accountId: 'acc-ap', debitPaise: amountPaise, creditPaise: 0 },
    { accountId: cashOrBankAccountId(mode), debitPaise: 0, creditPaise: amountPaise },
  ];
}

/** Payment status (BR-PAY-02): due ≤ 50 paise → paid; else paid>0 → partial; else unpaid. */
export function derivePaymentStatus(grandTotalPaise: number, paidPaise: number): PaymentStatus {
  const due = grandTotalPaise - paidPaise;
  if (due <= OUTSTANDING_THRESHOLD_PAISE) return 'paid';
  if (paidPaise > 0) return 'partial';
  return 'unpaid';
}

/** Outstanding = max(0, grand − paid) (BR-DUE-01/02). */
export function outstandingOf(grandTotalPaise: number, paidPaise: number): number {
  return Math.max(0, grandTotalPaise - paidPaise);
}

/** True when a document is still outstanding (gap greater than 50 paise, BR-DUE-02). */
export function isOutstanding(grandTotalPaise: number, paidPaise: number): boolean {
  return grandTotalPaise - paidPaise > OUTSTANDING_THRESHOLD_PAISE;
}
