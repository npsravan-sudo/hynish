import { describe, it, expect } from 'vitest';
import {
  validateJournal, normalSide, accountBalance, cashOrBankAccountId, DEFAULT_CHART_OF_ACCOUNTS, isValidLine,
  findUnbalancedEntries, findDuplicatePostedRefs, findOrphanAccountRefs,
} from './accounting.js';
import { createAccountSchema } from './schemas/finance.js';

describe('accounting — validateJournal (BR-ACC-01/02/03, §28)', () => {
  it('accepts a balanced entry', () => {
    const r = validateJournal([
      { accountId: 'acc-cash', debitPaise: 94500, creditPaise: 0 },
      { accountId: 'acc-sales', debitPaise: 0, creditPaise: 90000 },
      { accountId: 'acc-gst-output', debitPaise: 0, creditPaise: 4500 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.totalDebitPaise).toBe(94500);
    expect(r.totalCreditPaise).toBe(94500);
  });
  it('rejects an unbalanced entry', () => {
    const r = validateJournal([
      { accountId: 'acc-cash', debitPaise: 100, creditPaise: 0 },
      { accountId: 'acc-sales', debitPaise: 0, creditPaise: 90 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('unbalanced');
  });
  it('rejects an entry that is empty after pruning zero lines', () => {
    const r = validateJournal([{ accountId: 'acc-cash', debitPaise: 0, creditPaise: 0 }]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('empty');
  });
  it('rejects a line with both debit and credit, or negatives', () => {
    expect(isValidLine({ accountId: 'a', debitPaise: 10, creditPaise: 10 })).toBe(false);
    expect(isValidLine({ accountId: 'a', debitPaise: -10, creditPaise: 0 })).toBe(false);
    expect(validateJournal([{ accountId: 'a', debitPaise: 5, creditPaise: 5 }]).reason).toBe('invalid_line');
  });
});

describe('accounting — chart of accounts (BR-ACC-06, TD §6.1.1)', () => {
  it('has the 14 system accounts with preserved ids', () => {
    const ids = DEFAULT_CHART_OF_ACCOUNTS.map((a) => a.id);
    expect(ids).toContain('acc-cash');
    expect(ids).toContain('acc-ar');
    expect(ids).toContain('acc-inventory');
    expect(ids).toContain('acc-gst-input');
    expect(ids).toContain('acc-gst-output');
    expect(ids).toContain('acc-cogs');
    expect(DEFAULT_CHART_OF_ACCOUNTS).toHaveLength(14);
    expect(DEFAULT_CHART_OF_ACCOUNTS.every((a) => a.isSystem)).toBe(true);
  });
  it('derives the normal side by type', () => {
    expect(normalSide('asset')).toBe('debit');
    expect(normalSide('expense')).toBe('debit');
    expect(normalSide('liability')).toBe('credit');
    expect(normalSide('income')).toBe('credit');
    expect(normalSide('equity')).toBe('credit');
  });
  it('routes non-Cash payment modes to the Bank account (BR-PAY-04)', () => {
    expect(cashOrBankAccountId('Cash')).toBe('acc-cash');
    expect(cashOrBankAccountId('UPI')).toBe('acc-bank');
    expect(cashOrBankAccountId('Cheque')).toBe('acc-bank');
  });
});

describe('accounting — accountBalance (BR-ACC-06/07)', () => {
  it('computes debit-normal balances (asset/expense) as Σdr − Σcr', () => {
    expect(accountBalance('asset', 10000, 4000)).toBe(6000);
    expect(accountBalance('expense', 500, 0)).toBe(500);
  });
  it('computes credit-normal balances (liability/equity/income) as Σcr − Σdr', () => {
    expect(accountBalance('liability', 1000, 9000)).toBe(8000);
    expect(accountBalance('income', 0, 90000)).toBe(90000);
    expect(accountBalance('equity', 200, 500)).toBe(300);
  });
  it('can go negative (abnormal balance)', () => {
    expect(accountBalance('asset', 0, 500)).toBe(-500);
    expect(accountBalance('income', 500, 0)).toBe(-500);
  });
});

describe('accounting — createAccountSchema (BR-ACC-18, TD §6.1.8)', () => {
  it('accepts a valid custom account with no code (server auto-assigns)', () => {
    const r = createAccountSchema.safeParse({ name: 'Petty Cash', type: 'asset' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBeNull();
  });
  it('accepts an explicit positive integer code', () => {
    const r = createAccountSchema.safeParse({ name: 'Petty Cash', type: 'asset', code: 5200 });
    expect(r.success).toBe(true);
  });
  it('rejects an empty name, an unknown type, and a non-positive code', () => {
    expect(createAccountSchema.safeParse({ name: '', type: 'asset' }).success).toBe(false);
    expect(createAccountSchema.safeParse({ name: 'X', type: 'bogus' }).success).toBe(false);
    expect(createAccountSchema.safeParse({ name: 'X', type: 'asset', code: 0 }).success).toBe(false);
    expect(createAccountSchema.safeParse({ name: 'X', type: 'asset', code: -5 }).success).toBe(false);
  });
});

describe('accounting — reconciliation checks (§49, detection only)', () => {
  it('findUnbalancedEntries flags a posted entry whose lines do not balance', () => {
    const entries = [
      { id: 'j1', status: 'posted' as const, refType: 'invoice', refId: 'inv-1', lines: [
        { accountId: 'acc-cash', debitPaise: 100, creditPaise: 0 },
        { accountId: 'acc-sales', debitPaise: 0, creditPaise: 100 },
      ] },
      { id: 'j2', status: 'posted' as const, refType: 'invoice', refId: 'inv-2', lines: [
        { accountId: 'acc-cash', debitPaise: 100, creditPaise: 0 },
        { accountId: 'acc-sales', debitPaise: 0, creditPaise: 90 },
      ] },
      { id: 'j3', status: 'voided' as const, refType: 'invoice', refId: 'inv-3', lines: [
        { accountId: 'acc-cash', debitPaise: 100, creditPaise: 0 },
      ] },
    ];
    expect(findUnbalancedEntries(entries)).toEqual(['j2']);
  });

  it('findDuplicatePostedRefs flags two POSTED entries for the same (refType, refId)', () => {
    const entries = [
      { id: 'j1', status: 'posted' as const, refType: 'invoice', refId: 'inv-1', lines: [] },
      { id: 'j2', status: 'posted' as const, refType: 'invoice', refId: 'inv-1', lines: [] },
      { id: 'j3', status: 'voided' as const, refType: 'invoice', refId: 'inv-1', lines: [] },
      { id: 'j4', status: 'posted' as const, refType: 'purchase', refId: 'pur-1', lines: [] },
    ];
    expect(findDuplicatePostedRefs(entries)).toEqual(['invoice:inv-1']);
  });

  it('findOrphanAccountRefs flags a line referencing an unknown accountId', () => {
    const entries = [
      { id: 'j1', status: 'posted' as const, refType: 'invoice', refId: 'inv-1', lines: [
        { accountId: 'acc-cash', debitPaise: 100, creditPaise: 0 },
        { accountId: 'acc-ghost', debitPaise: 0, creditPaise: 100 },
      ] },
    ];
    const known = new Set(DEFAULT_CHART_OF_ACCOUNTS.map((a) => a.id));
    expect(findOrphanAccountRefs(entries, known)).toEqual([{ entryId: 'j1', accountId: 'acc-ghost' }]);
  });
});
