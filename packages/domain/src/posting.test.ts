import { describe, it, expect } from 'vitest';
import {
  journalLinesForInvoice, journalLinesForInvoiceCogs,
  journalLinesForPaymentIn, journalLinesForPaymentOut, journalLinesForPurchase,
  journalLinesForExpense, journalLinesForCreditNote, journalLinesForCreditNoteCogs, journalLinesForDebitNote,
  clampEligibleQty,
  derivePaymentStatus, outstandingOf, isOutstanding,
} from './posting.js';
import { validateJournal } from './accounting.js';

const dr = (lines: { debitPaise: number }[]) => lines.reduce((s, l) => s + l.debitPaise, 0);
const cr = (lines: { creditPaise: number }[]) => lines.reduce((s, l) => s + l.creditPaise, 0);

describe('journalLinesForInvoice (BR-ACC-08)', () => {
  it('splits cash / AR / revenue / tax and balances (intra, part-paid)', () => {
    const lines = journalLinesForInvoice({ subtotalPaise: 10000, taxPaise: 1800, roundOffPaise: 0, grandTotalPaise: 11800, atBillingPaidPaise: 5000 });
    expect(lines).toContainEqual({ accountId: 'acc-cash', debitPaise: 5000, creditPaise: 0 });
    expect(lines).toContainEqual({ accountId: 'acc-ar', debitPaise: 6800, creditPaise: 0 });
    expect(lines).toContainEqual({ accountId: 'acc-sales', debitPaise: 0, creditPaise: 10000 });
    expect(lines).toContainEqual({ accountId: 'acc-gst-output', debitPaise: 0, creditPaise: 1800 });
    expect(dr(lines)).toBe(cr(lines));
    expect(validateJournal(lines).ok).toBe(true);
  });

  it('caps cash at the grand total and omits AR when fully paid', () => {
    const lines = journalLinesForInvoice({ subtotalPaise: 10000, taxPaise: 0, roundOffPaise: 0, grandTotalPaise: 10000, atBillingPaidPaise: 20000 });
    expect(lines.find((l) => l.accountId === 'acc-cash')?.debitPaise).toBe(10000);
    expect(lines.find((l) => l.accountId === 'acc-ar')).toBeUndefined();
    expect(dr(lines)).toBe(cr(lines));
  });

  it('books all to AR when nothing is paid at billing', () => {
    const lines = journalLinesForInvoice({ subtotalPaise: 10000, taxPaise: 0, roundOffPaise: 0, grandTotalPaise: 10000, atBillingPaidPaise: 0 });
    expect(lines.find((l) => l.accountId === 'acc-cash')).toBeUndefined();
    expect(lines.find((l) => l.accountId === 'acc-ar')?.debitPaise).toBe(10000);
  });

  it('folds round-off into Sales Revenue and still balances', () => {
    const lines = journalLinesForInvoice({ subtotalPaise: 9990, taxPaise: 0, roundOffPaise: 10, grandTotalPaise: 10000, atBillingPaidPaise: 0 });
    expect(lines.find((l) => l.accountId === 'acc-sales')?.creditPaise).toBe(10000);
    expect(dr(lines)).toBe(cr(lines));
  });
});

describe('journalLinesForInvoiceCogs (BR-COGS-01)', () => {
  it('is empty when there is no cost', () => {
    expect(journalLinesForInvoiceCogs(0)).toEqual([]);
    expect(journalLinesForInvoiceCogs(-5)).toEqual([]);
  });
  it('debits COGS and credits Inventory, balanced', () => {
    const lines = journalLinesForInvoiceCogs(2500);
    expect(lines).toContainEqual({ accountId: 'acc-cogs', debitPaise: 2500, creditPaise: 0 });
    expect(lines).toContainEqual({ accountId: 'acc-inventory', debitPaise: 0, creditPaise: 2500 });
    expect(validateJournal(lines).ok).toBe(true);
  });
});

describe('payment journal lines (BR-PAY-03/04)', () => {
  it('payment_in: Cash mode → acc-cash / AR', () => {
    const lines = journalLinesForPaymentIn(5000, 'Cash');
    expect(lines).toContainEqual({ accountId: 'acc-cash', debitPaise: 5000, creditPaise: 0 });
    expect(lines).toContainEqual({ accountId: 'acc-ar', debitPaise: 0, creditPaise: 5000 });
  });
  it('payment_in: non-Cash mode → acc-bank / AR', () => {
    expect(journalLinesForPaymentIn(5000, 'UPI')[0]!.accountId).toBe('acc-bank');
    expect(journalLinesForPaymentIn(5000, 'Cheque')[0]!.accountId).toBe('acc-bank');
  });
  it('payment_out: AP / Cash-or-Bank, balanced', () => {
    const lines = journalLinesForPaymentOut(5000, 'Bank Transfer');
    expect(lines).toContainEqual({ accountId: 'acc-ap', debitPaise: 5000, creditPaise: 0 });
    expect(lines).toContainEqual({ accountId: 'acc-bank', debitPaise: 0, creditPaise: 5000 });
    expect(validateJournal(lines).ok).toBe(true);
  });
});

describe('journalLinesForPurchase (BR-PUR-04/08) — no GST', () => {
  it('debits Inventory for the total, credits Cash paid-now and AP remainder', () => {
    const lines = journalLinesForPurchase(10000, 4000);
    expect(lines).toContainEqual({ accountId: 'acc-inventory', debitPaise: 10000, creditPaise: 0 });
    expect(lines).toContainEqual({ accountId: 'acc-cash', debitPaise: 0, creditPaise: 4000 });
    expect(lines).toContainEqual({ accountId: 'acc-ap', debitPaise: 0, creditPaise: 6000 });
    expect(dr(lines)).toBe(cr(lines));
    expect(validateJournal(lines).ok).toBe(true);
    // Never posts GST input (BR-PUR-08 / OQ-06).
    expect(lines.some((l) => l.accountId === 'acc-gst-input')).toBe(false);
  });
  it('fully paid → no AP line; unpaid → no cash line', () => {
    expect(journalLinesForPurchase(10000, 10000).some((l) => l.accountId === 'acc-ap')).toBe(false);
    expect(journalLinesForPurchase(10000, 0).some((l) => l.accountId === 'acc-cash')).toBe(false);
  });
  it('caps paid-now at the total', () => {
    const lines = journalLinesForPurchase(10000, 15000);
    expect(lines.find((l) => l.accountId === 'acc-cash')?.creditPaise).toBe(10000);
    expect(dr(lines)).toBe(cr(lines));
  });
});

describe('payment status & outstanding (BR-PAY-02, BR-DUE-01/02)', () => {
  it('derives paid / partial / unpaid with the 50-paise threshold', () => {
    expect(derivePaymentStatus(10000, 10000)).toBe('paid');
    expect(derivePaymentStatus(10000, 9960)).toBe('paid'); // due 40 ≤ 50
    expect(derivePaymentStatus(10000, 9949)).toBe('partial'); // due 51 > 50
    expect(derivePaymentStatus(10000, 5000)).toBe('partial');
    expect(derivePaymentStatus(10000, 0)).toBe('unpaid');
    expect(derivePaymentStatus(0, 0)).toBe('paid');
  });
  it('outstanding never goes negative', () => {
    expect(outstandingOf(10000, 4000)).toBe(6000);
    expect(outstandingOf(10000, 12000)).toBe(0);
  });
  it('isOutstanding only when the gap exceeds 50 paise', () => {
    expect(isOutstanding(10000, 9949)).toBe(true);
    expect(isOutstanding(10000, 9960)).toBe(false);
  });
});

describe('journalLinesForExpense (BR-EXP-01, TD §6.1.5)', () => {
  it('Dr the category account / Cr Cash for a Cash-mode expense, balanced', () => {
    const lines = journalLinesForExpense(50000, 'acc-rent', 'Cash');
    expect(lines).toEqual([
      { accountId: 'acc-rent', debitPaise: 50000, creditPaise: 0 },
      { accountId: 'acc-cash', debitPaise: 0, creditPaise: 50000 },
    ]);
    expect(dr(lines)).toBe(cr(lines));
    expect(validateJournal(lines).ok).toBe(true);
  });
  it('routes any non-Cash mode to acc-bank (BR-PAY-04)', () => {
    const lines = journalLinesForExpense(20000, 'acc-rent', 'UPI');
    expect(lines.find((l) => l.accountId === 'acc-bank')?.creditPaise).toBe(20000);
  });
  it('produces no lines for a non-positive amount', () => {
    expect(journalLinesForExpense(0, 'acc-rent', 'Cash')).toEqual([]);
  });
});

describe('journalLinesForCreditNote (BR-CN-03)', () => {
  it('Dr Sales Revenue + Dr GST Output / Cr Accounts Receivable, balanced', () => {
    const lines = journalLinesForCreditNote(10000, 1800, 11800);
    expect(lines).toContainEqual({ accountId: 'acc-sales', debitPaise: 10000, creditPaise: 0 });
    expect(lines).toContainEqual({ accountId: 'acc-gst-output', debitPaise: 1800, creditPaise: 0 });
    expect(lines).toContainEqual({ accountId: 'acc-ar', debitPaise: 0, creditPaise: 11800 });
    expect(dr(lines)).toBe(cr(lines));
    expect(validateJournal(lines).ok).toBe(true);
  });
  it('omits the tax line for a Without-GST original invoice (BR-CN-02)', () => {
    const lines = journalLinesForCreditNote(10000, 0, 10000);
    expect(lines.find((l) => l.accountId === 'acc-gst-output')).toBeUndefined();
    expect(dr(lines)).toBe(cr(lines));
  });
});

describe('journalLinesForCreditNoteCogs (BR-CN-04, restock only)', () => {
  it('Dr Inventory / Cr COGS — the reverse of invoice COGS', () => {
    const lines = journalLinesForCreditNoteCogs(4000);
    expect(lines).toEqual([
      { accountId: 'acc-inventory', debitPaise: 4000, creditPaise: 0 },
      { accountId: 'acc-cogs', debitPaise: 0, creditPaise: 4000 },
    ]);
    expect(dr(lines)).toBe(cr(lines));
  });
  it('produces no lines when nothing is restocked', () => {
    expect(journalLinesForCreditNoteCogs(0)).toEqual([]);
  });
});

describe('journalLinesForDebitNote (BR-DBN-02/03)', () => {
  it('Dr Accounts Payable / Cr Inventory, no GST', () => {
    const lines = journalLinesForDebitNote(5000);
    expect(lines).toEqual([
      { accountId: 'acc-ap', debitPaise: 5000, creditPaise: 0 },
      { accountId: 'acc-inventory', debitPaise: 0, creditPaise: 5000 },
    ]);
    expect(dr(lines)).toBe(cr(lines));
  });
});

describe('clampEligibleQty (BR-CN-01 / BR-DBN-01)', () => {
  it('clamps to the remaining eligible quantity', () => {
    expect(clampEligibleQty(10, 3, 8)).toBe(7); // only 7 left of 10 after 3 already returned
    expect(clampEligibleQty(10, 0, 5)).toBe(5);
  });
  it('never goes negative and never exceeds what remains', () => {
    expect(clampEligibleQty(10, 10, 5)).toBe(0); // nothing left
    expect(clampEligibleQty(10, 0, -3)).toBe(0);
    expect(clampEligibleQty(10, 12, 5)).toBe(0); // already over-returned (shouldn't happen, but never negative)
  });
});
