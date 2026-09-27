import { describe, it, expect } from 'vitest';
import {
  validateJournal, normalSide, cashOrBankAccountId, DEFAULT_CHART_OF_ACCOUNTS, isValidLine,
} from './accounting.js';

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
