import { describe, it, expect } from 'vitest';
import {
  generatePeriods, bucketByPeriod, duesSummary, salesSummary, topProductsFromInvoices,
  topCustomersFromInvoices, performanceByCreator, gstFilingSummary, gstFilingReadiness,
  expenseKpis, expensesByCategory, cashKpis, cashByCategory,
} from './reports.js';
import { invoiceFixture, creditNoteFixture } from './fixtures/index.js';
import type { Invoice } from './schemas/sales.js';

describe('generatePeriods — day (BR-RPT-04)', () => {
  it('returns exactly `count` consecutive days ending at endDateISO', () => {
    const periods = generatePeriods('day', 5, '2026-04-10');
    expect(periods).toHaveLength(5);
    expect(periods[0]!.key).toBe('2026-04-06');
    expect(periods[4]!.key).toBe('2026-04-10');
    expect(periods[4]!.startISO).toBe('2026-04-10');
    expect(periods[4]!.endISO).toBe('2026-04-10');
  });
  it('handles a month boundary correctly', () => {
    const periods = generatePeriods('day', 3, '2026-05-01');
    expect(periods.map((p) => p.key)).toEqual(['2026-04-29', '2026-04-30', '2026-05-01']);
  });
});

describe('generatePeriods — week (Monday-start)', () => {
  it('returns consecutive Monday-start weeks ending with the week containing endDateISO', () => {
    // 2026-04-10 is a Friday; that week starts Monday 2026-04-06.
    const periods = generatePeriods('week', 2, '2026-04-10');
    expect(periods).toHaveLength(2);
    expect(periods[1]!.startISO).toBe('2026-04-06');
    expect(periods[1]!.endISO).toBe('2026-04-12');
    expect(periods[0]!.startISO).toBe('2026-03-30');
  });
});

describe('generatePeriods — month', () => {
  it('returns consecutive calendar months ending with the month containing endDateISO', () => {
    const periods = generatePeriods('month', 3, '2026-04-15');
    expect(periods.map((p) => p.key)).toEqual(['2026-02', '2026-03', '2026-04']);
    expect(periods[2]!.startISO).toBe('2026-04-01');
    expect(periods[2]!.endISO).toBe('2026-04-30');
  });
  it('handles a year boundary correctly', () => {
    const periods = generatePeriods('month', 2, '2026-01-15');
    expect(periods.map((p) => p.key)).toEqual(['2025-12', '2026-01']);
  });
});

describe('bucketByPeriod', () => {
  interface Row { date: string; amount: number }
  const rows: Row[] = [
    { date: '2026-04-08', amount: 100 },
    { date: '2026-04-08', amount: 50 },
    { date: '2026-04-10', amount: 20 },
    { date: '2026-03-01', amount: 999 }, // outside the window — must be dropped, not double-counted
  ];

  it('groups items into the correct period, leaving empty periods present with zero items', () => {
    const buckets = bucketByPeriod(rows, (r) => r.date, 'day', 5, '2026-04-10');
    expect(buckets).toHaveLength(5);
    const apr8 = buckets.find((b) => b.period.key === '2026-04-08')!;
    expect(apr8.items).toHaveLength(2);
    const apr9 = buckets.find((b) => b.period.key === '2026-04-09')!;
    expect(apr9.items).toHaveLength(0);
    const apr10 = buckets.find((b) => b.period.key === '2026-04-10')!;
    expect(apr10.items).toHaveLength(1);
  });

  it('never double-counts an item across two periods', () => {
    const buckets = bucketByPeriod(rows, (r) => r.date, 'day', 5, '2026-04-10');
    const total = buckets.reduce((s, b) => s + b.items.length, 0);
    expect(total).toBe(3); // the out-of-window row is excluded entirely
  });
});

describe('salesSummary (BR-RPT item 16)', () => {
  it('sums subtotal/tax/grandTotal/paid/outstanding and derives discount from stored line snapshots', () => {
    const invoices: Invoice[] = [
      invoiceFixture(),
      invoiceFixture({ id: 'inv-2', grandTotalPaise: 10000, paidPaise: 4000, subtotalPaise: 9000, taxPaise: 1000,
        lines: [{ lineId: 'l2', productId: 'p2', variantId: 'v2', nameSnapshot: 'X', codeSnapshot: '', hsnSnapshot: '',
          unit: 'Pcs', qty: 1, baseQty: 1, ratePaise: 10000, discountBp: 1000, gstRateBp: 0,
          taxablePaise: 9000, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalPaise: 9000, unitCostPaise: 0, skipStockDeduction: false }] }),
    ];
    const s = salesSummary(invoices);
    expect(s.invoiceCount).toBe(2);
    expect(s.grandTotalPaise).toBe(94500 + 10000);
    expect(s.paidPaise).toBe(94500 + 4000);
    expect(s.outstandingPaise).toBe(0 + 6000);
    // inv-1 line: rate 45000 * qty 2 = 90000 gross, taxable 90000 -> discount 0.
    // inv-2 line: rate 10000 * qty 1 = 10000 gross, taxable 9000 -> discount 1000.
    expect(s.discountPaise).toBe(1000);
  });
});

describe('topProductsFromInvoices (BR-RPT item 17)', () => {
  it('aggregates qty and revenue per product+variant from line snapshots, sorted descending', () => {
    const invoices: Invoice[] = [
      invoiceFixture(),
      invoiceFixture({ id: 'inv-2', lines: [{ ...invoiceFixture().lines[0]!, qty: 3, totalPaise: 141750 }] }),
    ];
    const rows = topProductsFromInvoices(invoices);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.qty).toBe(2 + 3);
    expect(rows[0]!.totalPaise).toBe(94500 + 141750);
  });
});

describe('topCustomersFromInvoices (BR-RPT item 18)', () => {
  it('groups by customer, falling back to a Walk-in bucket for cash sales', () => {
    const invoices: Invoice[] = [
      invoiceFixture(),
      invoiceFixture({ id: 'inv-2', customerId: null, customerSnapshot: null, grandTotalPaise: 500, paidPaise: 500 }),
    ];
    const rows = topCustomersFromInvoices(invoices);
    expect(rows).toHaveLength(2);
    const walkIn = rows.find((r) => r.customerId === null)!;
    expect(walkIn.name).toBe('Walk-in / cash sale');
    expect(walkIn.invoiceCount).toBe(1);
  });
});

describe('performanceByCreator (TD §3.7 — account, not employee, performance)', () => {
  it('groups by createdByName', () => {
    const invoices: Invoice[] = [invoiceFixture(), invoiceFixture({ id: 'inv-2', createdByName: 'Shop 1' })];
    const rows = performanceByCreator(invoices);
    expect(rows.map((r) => r.createdByName).sort()).toEqual(['Owner', 'Shop 1']);
  });
});

describe('gstFilingSummary (BR-RPT-05/06)', () => {
  const b2b = invoiceFixture(); // has a GSTIN, gstApplicable: true, date 2026-04-05
  const b2c = invoiceFixture({ id: 'inv-b2c', customerSnapshot: { name: 'Retail Buyer', gstin: '', stateCode: '29', address: '', phone: '' } });
  const withoutGst = invoiceFixture({ id: 'inv-ngst', gstApplicable: false, taxPaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, grandTotalPaise: 90000 });
  const outOfMonth = invoiceFixture({ id: 'inv-may', date: '2026-05-01' });

  it('splits invoices into B2B / B2C / Without-GST by month, excluding Without-GST from taxable totals', () => {
    const s = gstFilingSummary([b2b, b2c, withoutGst, outOfMonth], [], '2026-04');
    expect(s.b2b.map((r) => r.invoiceId)).toEqual(['inv-1']);
    expect(s.b2c.map((r) => r.invoiceId)).toEqual(['inv-b2c']);
    expect(s.withoutGst.map((r) => r.invoiceId)).toEqual(['inv-ngst']);
    expect(s.totalTaxablePaise).toBe(b2b.subtotalPaise + b2c.subtotalPaise); // withoutGst excluded
    expect(s.totalTaxPaise).toBe(b2b.taxPaise + b2c.taxPaise);
  });

  it('groups HSN summary by hsn|gstRate across taxable invoices only', () => {
    const s = gstFilingSummary([b2b, b2c, withoutGst], [], '2026-04');
    expect(s.hsn).toHaveLength(1); // both b2b and b2c use the same fixture line (hsn 6205, rate 500)
    expect(s.hsn[0]!.qty).toBe(b2b.lines[0]!.qty + b2c.lines[0]!.qty);
  });

  it('subtracts the same month\'s credit notes from net taxable/tax', () => {
    const cn = creditNoteFixture();
    const s = gstFilingSummary([b2b], [cn], '2026-04');
    expect(s.netTaxablePaise).toBe(b2b.subtotalPaise - cn.subtotalPaise);
    expect(s.netTaxPaise).toBe(b2b.taxPaise - cn.taxPaise);
  });

  it('ignores a credit note from a different month', () => {
    const cn = creditNoteFixture({ date: '2026-05-01' });
    const s = gstFilingSummary([b2b], [cn], '2026-04');
    expect(s.netTaxablePaise).toBe(s.totalTaxablePaise);
  });
});

describe('gstFilingReadiness (BR-RPT-07)', () => {
  it('flags a missing business GSTIN', () => {
    const r = gstFilingReadiness([invoiceFixture()], '', '2026-04');
    expect(r.businessGstinSet).toBe(false);
  });
  it('flags an invalid B2B GSTIN pattern', () => {
    const bad = invoiceFixture({ customerSnapshot: { name: 'X', gstin: 'NOTAGSTIN', stateCode: '29', address: '', phone: '' } });
    const r = gstFilingReadiness([bad], '29AAAAA0000A1Z5', '2026-04');
    expect(r.invalidB2BGstins).toHaveLength(1);
  });
  it('flags a taxable invoice with a line missing HSN', () => {
    const noHsn = invoiceFixture({ lines: [{ ...invoiceFixture().lines[0]!, hsnSnapshot: '' }] });
    const r = gstFilingReadiness([noHsn], '29AAAAA0000A1Z5', '2026-04');
    expect(r.missingHsnInvoices).toHaveLength(1);
  });
  it('a valid GSTIN and complete HSN produce no findings', () => {
    const r = gstFilingReadiness([invoiceFixture()], '29AAAAA0000A1Z5', '2026-04');
    expect(r.invalidB2BGstins).toHaveLength(0);
    expect(r.missingHsnInvoices).toHaveLength(0);
  });
});

describe('expenseKpis (BR-EXP-03)', () => {
  const today = '2026-04-10';
  const expenses = [
    { date: '2026-04-10', amountPaise: 100, categoryId: 'c1', categoryNameSnapshot: 'Rent' },
    { date: '2026-04-05', amountPaise: 200, categoryId: 'c1', categoryNameSnapshot: 'Rent' },
    { date: '2026-03-01', amountPaise: 999, categoryId: 'c2', categoryNameSnapshot: 'Water' }, // outside last-7-days and this-month
  ];
  it('sums today, last-7-days (inclusive of today) and this-month separately', () => {
    const k = expenseKpis(expenses, today);
    expect(k.todayPaise).toBe(100);
    expect(k.last7DaysPaise).toBe(100 + 200);
    expect(k.thisMonthPaise).toBe(100 + 200);
  });
});

describe('expensesByCategory (TD §6.4 — all-time, never period-filtered)', () => {
  it('groups by category id, summing across the entire input regardless of date', () => {
    const expenses = [
      { date: '2026-04-10', amountPaise: 100, categoryId: 'c1', categoryNameSnapshot: 'Rent' },
      { date: '2020-01-01', amountPaise: 50, categoryId: 'c1', categoryNameSnapshot: 'Rent' },
      { date: '2026-04-10', amountPaise: 30, categoryId: 'c2', categoryNameSnapshot: 'Water' },
    ];
    const rows = expensesByCategory(expenses);
    expect(rows).toEqual([
      { categoryId: 'c1', categoryName: 'Rent', totalPaise: 150 },
      { categoryId: 'c2', categoryName: 'Water', totalPaise: 30 },
    ]);
  });
});

describe('cashKpis / cashByCategory (TD §6.3 renderCashAnalysis)', () => {
  const today = '2026-04-10';
  const entries = [
    { date: '2026-04-10', type: 'in' as const, category: 'Sales Collection (Cash)', amountPaise: 500 },
    { date: '2026-04-10', type: 'out' as const, category: 'Supplier Payment', amountPaise: 200 },
    { date: '2026-04-01', type: 'in' as const, category: 'Sales Collection (Cash)', amountPaise: 300 },
    { date: '2026-03-01', type: 'out' as const, category: 'Owner Drawings', amountPaise: 999 }, // outside this month
  ];
  it('computes net (in − out) for today and the month separately', () => {
    const k = cashKpis(entries, today);
    expect(k.todayNetPaise).toBe(500 - 200);
    expect(k.monthNetPaise).toBe(500 + 300 - 200);
  });
  it('splits the category breakdown by type, since the same name can appear in both', () => {
    const rows = cashByCategory(entries);
    const inRow = rows.find((r) => r.type === 'in' && r.category === 'Sales Collection (Cash)')!;
    expect(inRow.totalPaise).toBe(800);
    const outRow = rows.find((r) => r.type === 'out' && r.category === 'Supplier Payment')!;
    expect(outRow.totalPaise).toBe(200);
  });
});

describe('duesSummary (BR-DUE-01..04/08)', () => {
  interface Doc { id: string; grandTotalPaise: number; paidPaise: number; dueDate: string | null; customerId: string | null }
  const today = '2026-04-10';
  const docs: Doc[] = [
    { id: 'paid', grandTotalPaise: 1000, paidPaise: 1000, dueDate: null, customerId: 'c1' }, // settled, excluded
    { id: 'overdue', grandTotalPaise: 5000, paidPaise: 0, dueDate: '2026-04-01', customerId: 'c1' },
    { id: 'due-soon', grandTotalPaise: 2000, paidPaise: 0, dueDate: '2026-04-14', customerId: 'c2' },
    { id: 'no-date', grandTotalPaise: 3000, paidPaise: 1000, dueDate: null, customerId: 'c3' },
    { id: 'cash-sale', grandTotalPaise: 500, paidPaise: 0, dueDate: null, customerId: null },
  ];

  it('sums total outstanding only over actually-outstanding docs', () => {
    const s = duesSummary(docs, (d) => d.grandTotalPaise, (d) => d.paidPaise, (d) => d.customerId, today);
    expect(s.totalOutstandingPaise).toBe(5000 + 2000 + 2000 + 500); // overdue + due-soon + no-date(3000-1000) + cash-sale
    expect(s.outstandingCount).toBe(4);
  });

  it('classifies overdue vs due-soon by the 7-day window', () => {
    const s = duesSummary(docs, (d) => d.grandTotalPaise, (d) => d.paidPaise, (d) => d.customerId, today);
    expect(s.overdueCount).toBe(1);
    expect(s.overdueTotalPaise).toBe(5000);
    expect(s.dueSoonCount).toBe(1);
    expect(s.dueSoonTotalPaise).toBe(2000);
  });

  it('counts distinct parties with dues, excluding docs with no party', () => {
    const s = duesSummary(docs, (d) => d.grandTotalPaise, (d) => d.paidPaise, (d) => d.customerId, today);
    expect(s.partiesWithDuesCount).toBe(3); // c1, c2, c3 — not the null-party cash sale
  });
});
