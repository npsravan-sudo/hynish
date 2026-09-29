/**
 * Report period bucketing (BR-RPT-04, TD §3.7/§6.3/§6.4). The legacy app buckets three different
 * trends — Sales Reports, Cash Analysis, and Daily Expenses — with the exact same shape: group by
 * day/week/month, over the last N periods ending today. This is the ONE place that grouping is
 * implemented, so no report/chart component reimplements it (§40/§41).
 *
 * Week boundary is NOT VERIFIED against the legacy source (no OQ blocks this — a display grouping
 * convention, not a financial calculation); ISO week (Monday–Sunday) is used as a deterministic,
 * unambiguous default.
 */
import { isValidBusinessDate } from './fy.js';
import { addDaysISO, monthKey } from './dates.js';
import { outstandingOf, isOutstanding } from './posting.js';
import { Money } from './money.js';
import { isValidGstin } from './gst-states.js';
import type { Invoice, CreditNote } from './schemas/sales.js';

export type ReportGranularity = 'day' | 'week' | 'month';

export interface ReportPeriod {
  /** Stable sort/group key, e.g. '2026-04-05' (day), '2026-04-06' (week start, Monday), '2026-04' (month). */
  key: string;
  /** Short display label, e.g. '5 Apr', '6–12 Apr', 'Apr 2026'. */
  label: string;
  /** Inclusive period bounds as business dates. */
  startISO: string;
  endISO: string;
}

function toUTCDate(dateISO: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function mondayOfWeek(dateISO: string): string {
  const d = toUTCDate(dateISO);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const offset = dow === 0 ? -6 : 1 - dow; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + offset);
  return toISO(d);
}
function firstOfMonth(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}
function addMonthsISO(dateISO: string, months: number): string {
  const [y, m] = dateISO.split('-').map(Number);
  const total = (y! * 12 + (m! - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-01`;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayLabel(dateISO: string): string {
  const [, m, d] = dateISO.split('-').map(Number);
  return `${d} ${MONTH_ABBR[m! - 1]}`;
}
function monthLabel(monthKeyStr: string): string {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return `${MONTH_ABBR[m! - 1]} ${y}`;
}

/**
 * The last `count` periods of `granularity`, ending with the period containing `endDateISO`
 * (default today, in business-date form — caller supplies it so this stays pure/testable).
 */
export function generatePeriods(granularity: ReportGranularity, count: number, endDateISO: string): ReportPeriod[] {
  if (!isValidBusinessDate(endDateISO)) throw new Error(`Invalid date for generatePeriods: ${endDateISO}`);
  if (count <= 0) return [];

  const periods: ReportPeriod[] = [];
  if (granularity === 'day') {
    for (let i = count - 1; i >= 0; i--) {
      const day = addDaysISO(endDateISO, -i);
      periods.push({ key: day, label: dayLabel(day), startISO: day, endISO: day });
    }
  } else if (granularity === 'week') {
    const thisWeekStart = mondayOfWeek(endDateISO);
    for (let i = count - 1; i >= 0; i--) {
      const start = addDaysISO(thisWeekStart, -7 * i);
      const end = addDaysISO(start, 6);
      periods.push({ key: start, label: `${dayLabel(start)}–${dayLabel(end)}`, startISO: start, endISO: end });
    }
  } else {
    const thisMonthStart = firstOfMonth(endDateISO);
    for (let i = count - 1; i >= 0; i--) {
      const start = addMonthsISO(thisMonthStart, -i);
      const end = addDaysISO(addMonthsISO(start, 1), -1);
      const key = start.slice(0, 7);
      periods.push({ key, label: monthLabel(key), startISO: start, endISO: end });
    }
  }
  return periods;
}

export interface PeriodBucket<T> {
  period: ReportPeriod;
  items: T[];
}

/**
 * Bucket `items` into the last `count` periods ending `endDateISO`, via `dateOf(item)`. Every
 * period is present even when empty (a trend chart must show a true gap, not skip a bar) —
 * items outside the window are simply not included in any bucket.
 */
export function bucketByPeriod<T>(
  items: readonly T[],
  dateOf: (item: T) => string,
  granularity: ReportGranularity,
  count: number,
  endDateISO: string,
): PeriodBucket<T>[] {
  const periods = generatePeriods(granularity, count, endDateISO);
  const buckets = periods.map((period) => ({ period, items: [] as T[] }));
  for (const item of items) {
    const d = dateOf(item);
    const idx = buckets.findIndex((b) => d >= b.period.startISO && d <= b.period.endISO);
    if (idx >= 0) buckets[idx]!.items.push(item);
  }
  return buckets;
}

/**
 * Receivables/Payables KPI summary (BR-DUE-01..04/08, TD §6.7) — the ONE place this is computed,
 * reused by the Dashboard's Outstanding Dues card and the full Dues/Payables reports, so the same
 * number is never calculated two different ways (§60/§61). `partyOf` names the customer/supplier
 * for the "with dues" count; a doc without a party (a cash sale) still counts toward the totals but
 * not toward the distinct-party count, matching `duesStatusBadge()`'s scope.
 */
export interface DuesLike {
  dueDate: string | null;
}
export interface DuesSummary {
  totalOutstandingPaise: number;
  overdueCount: number;
  overdueTotalPaise: number;
  dueSoonCount: number; // due within 7 days, not yet overdue (BR-DUE-04)
  dueSoonTotalPaise: number;
  outstandingCount: number;
  partiesWithDuesCount: number;
}

/**
 * `totalOf`/`paidOf` are accessors rather than a fixed field name because invoices use
 * `grandTotalPaise` and purchases use `totalPaise` (BR-DUE-07: payables mirror receivables exactly
 * over a differently-named field) — one function, not two near-duplicates.
 */
export function duesSummary<T extends DuesLike>(
  docs: readonly T[],
  totalOf: (doc: T) => number,
  paidOf: (doc: T) => number,
  partyOf: (doc: T) => string | null,
  todayISO: string,
): DuesSummary {
  const outstanding = docs.filter((d) => isOutstanding(totalOf(d), paidOf(d)));
  const soonCutoff = new Date(todayISO);
  soonCutoff.setUTCDate(soonCutoff.getUTCDate() + 7);
  const soonCutoffISO = soonCutoff.toISOString().slice(0, 10);

  let overdueCount = 0, overdueTotalPaise = 0, dueSoonCount = 0, dueSoonTotalPaise = 0, totalOutstandingPaise = 0;
  const parties = new Set<string>();
  for (const d of outstanding) {
    const gap = outstandingOf(totalOf(d), paidOf(d));
    totalOutstandingPaise += gap;
    const party = partyOf(d);
    if (party) parties.add(party);
    if (d.dueDate && d.dueDate < todayISO) {
      overdueCount++;
      overdueTotalPaise += gap;
    } else if (d.dueDate && d.dueDate <= soonCutoffISO) {
      dueSoonCount++;
      dueSoonTotalPaise += gap;
    }
  }
  return {
    totalOutstandingPaise, overdueCount, overdueTotalPaise, dueSoonCount, dueSoonTotalPaise,
    outstandingCount: outstanding.length, partiesWithDuesCount: parties.size,
  };
}

/**
 * Sales Reports (BR-RPT-04, TD §3.7). ONE place these aggregations are computed — from finalized
 * (non-deleted) invoices only, never drafts — so Sales Reports, the Dashboard, and any future
 * export always agree (§16/§60/§61). All money fields are the server-posted, stored invoice
 * totals; `discountPaise` is derived arithmetically from stored `ratePaise`/`qty`/`taxablePaise`
 * (gross − taxable), never recomputed via the tax engine.
 */
export interface SalesSummary {
  invoiceCount: number;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  grandTotalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
}

export function salesSummary(invoices: readonly Invoice[]): SalesSummary {
  let subtotalPaise = 0, discountPaise = 0, taxPaise = 0, grandTotalPaise = 0, paidPaise = 0, outstandingPaise = 0;
  for (const inv of invoices) {
    subtotalPaise += inv.subtotalPaise;
    taxPaise += inv.taxPaise;
    grandTotalPaise += inv.grandTotalPaise;
    paidPaise += inv.paidPaise;
    outstandingPaise += outstandingOf(inv.grandTotalPaise, inv.paidPaise);
    for (const line of inv.lines) {
      const gross = Money.multiply(line.ratePaise, line.qty);
      discountPaise += Math.max(0, gross - line.taxablePaise);
    }
  }
  return { invoiceCount: invoices.length, subtotalPaise, discountPaise, taxPaise, grandTotalPaise, paidPaise, outstandingPaise };
}

export interface ProductSalesRow {
  productId: string;
  variantId: string;
  name: string;
  qty: number;
  totalPaise: number;
}

/** Top-selling products by revenue, from invoice LINE SNAPSHOTS (never the live Product master —
 * BR-RPT item 17: a historical sale must not be reconstructed from today's product data). */
export function topProductsFromInvoices(invoices: readonly Invoice[], limit = 10): ProductSalesRow[] {
  const byKey = new Map<string, ProductSalesRow>();
  for (const inv of invoices) {
    for (const line of inv.lines) {
      const key = `${line.productId}_${line.variantId}`;
      const row = byKey.get(key) ?? { productId: line.productId, variantId: line.variantId, name: line.nameSnapshot, qty: 0, totalPaise: 0 };
      row.qty += line.qty;
      row.totalPaise += line.totalPaise;
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].sort((a, b) => b.totalPaise - a.totalPaise).slice(0, limit);
}

export interface CustomerSalesRow {
  customerId: string | null;
  name: string;
  invoiceCount: number;
  grandTotalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
}

/** Top customers by sales amount, using the authoritative invoice/payment fields (BR item 18). */
export function topCustomersFromInvoices(invoices: readonly Invoice[], limit = 10): CustomerSalesRow[] {
  const byId = new Map<string, CustomerSalesRow>();
  for (const inv of invoices) {
    const key = inv.customerId ?? '__walkin__';
    const row = byId.get(key) ?? {
      customerId: inv.customerId, name: inv.customerSnapshot?.name ?? 'Walk-in / cash sale',
      invoiceCount: 0, grandTotalPaise: 0, paidPaise: 0, outstandingPaise: 0,
    };
    row.invoiceCount += 1;
    row.grandTotalPaise += inv.grandTotalPaise;
    row.paidPaise += inv.paidPaise;
    row.outstandingPaise += outstandingOf(inv.grandTotalPaise, inv.paidPaise);
    byId.set(key, row);
  }
  return [...byId.values()].sort((a, b) => b.grandTotalPaise - a.grandTotalPaise).slice(0, limit);
}

/**
 * GST Filing (BR-RPT-05/06/07, TD §6.5). A monthly summary computed ENTIRELY from stored,
 * already-posted per-invoice tax fields — nothing here recalculates GST (§37). Without-GST
 * invoices are listed separately and excluded from every taxable/tax total and every table
 * (BR-RPT-05). B2B = customer has a GSTIN; B2C = taxable but no GSTIN. `netTaxable`/`netTax`
 * subtract the SAME month's credit notes.
 */
export interface GstFilingRow {
  invoiceId: string;
  number: string;
  date: string;
  customerName: string;
  customerGstin: string;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  grandTotalPaise: number;
}
export interface HsnRow {
  hsn: string;
  gstRateBp: number;
  qty: number;
  taxablePaise: number;
  taxPaise: number;
}
export interface GstFilingSummary {
  monthKey: string;
  b2b: GstFilingRow[];
  b2c: GstFilingRow[];
  withoutGst: GstFilingRow[];
  hsn: HsnRow[];
  totalTaxablePaise: number;
  totalTaxPaise: number;
  creditNotesTaxablePaise: number;
  creditNotesTaxPaise: number;
  netTaxablePaise: number;
  netTaxPaise: number;
}

function toGstFilingRow(inv: Invoice): GstFilingRow {
  return {
    invoiceId: inv.id, number: inv.number, date: inv.date,
    customerName: inv.customerSnapshot?.name ?? 'Walk-in / cash sale', customerGstin: inv.customerSnapshot?.gstin ?? '',
    taxablePaise: inv.subtotalPaise, cgstPaise: inv.cgstPaise, sgstPaise: inv.sgstPaise, igstPaise: inv.igstPaise,
    taxPaise: inv.taxPaise, grandTotalPaise: inv.grandTotalPaise,
  };
}

export function gstFilingSummary(
  invoices: readonly Invoice[],
  creditNotes: readonly CreditNote[],
  monthKeyStr: string,
): GstFilingSummary {
  const monthInvoices = invoices.filter((i) => monthKey(i.date) === monthKeyStr);
  const withoutGst = monthInvoices.filter((i) => !i.gstApplicable).map(toGstFilingRow);
  const taxable = monthInvoices.filter((i) => i.gstApplicable);
  const b2b = taxable.filter((i) => (i.customerSnapshot?.gstin ?? '').trim() !== '').map(toGstFilingRow);
  const b2c = taxable.filter((i) => (i.customerSnapshot?.gstin ?? '').trim() === '').map(toGstFilingRow);

  const totalTaxablePaise = taxable.reduce((s, i) => s + i.subtotalPaise, 0);
  const totalTaxPaise = taxable.reduce((s, i) => s + i.taxPaise, 0);

  const hsnMap = new Map<string, HsnRow>();
  for (const inv of taxable) {
    for (const line of inv.lines) {
      const key = `${line.hsnSnapshot}|${line.gstRateBp}`;
      const row = hsnMap.get(key) ?? { hsn: line.hsnSnapshot, gstRateBp: line.gstRateBp, qty: 0, taxablePaise: 0, taxPaise: 0 };
      row.qty += line.qty;
      row.taxablePaise += line.taxablePaise;
      row.taxPaise += line.cgstPaise + line.sgstPaise + line.igstPaise;
      hsnMap.set(key, row);
    }
  }

  const monthCreditNotes = creditNotes.filter((c) => monthKey(c.date) === monthKeyStr);
  const creditNotesTaxablePaise = monthCreditNotes.reduce((s, c) => s + c.subtotalPaise, 0);
  const creditNotesTaxPaise = monthCreditNotes.reduce((s, c) => s + c.taxPaise, 0);

  return {
    monthKey: monthKeyStr, b2b, b2c, withoutGst, hsn: [...hsnMap.values()].sort((a, b) => b.taxablePaise - a.taxablePaise),
    totalTaxablePaise, totalTaxPaise, creditNotesTaxablePaise, creditNotesTaxPaise,
    netTaxablePaise: totalTaxablePaise - creditNotesTaxablePaise, netTaxPaise: totalTaxPaise - creditNotesTaxPaise,
  };
}

/** Filing readiness checks (BR-RPT-07) — data-quality checks only, explicitly not a substitute for
 * CA review. Scoped to the same month's taxable invoices as `gstFilingSummary`. */
export interface GstReadiness {
  businessGstinSet: boolean;
  invalidB2BGstins: { invoiceId: string; number: string; gstin: string }[];
  missingHsnInvoices: { invoiceId: string; number: string }[];
}
export function gstFilingReadiness(invoices: readonly Invoice[], businessGstin: string, monthKeyStr: string): GstReadiness {
  const monthTaxable = invoices.filter((i) => monthKey(i.date) === monthKeyStr && i.gstApplicable);
  const invalidB2BGstins: GstReadiness['invalidB2BGstins'] = [];
  const missingHsnInvoices: GstReadiness['missingHsnInvoices'] = [];
  for (const inv of monthTaxable) {
    const gstin = (inv.customerSnapshot?.gstin ?? '').trim();
    if (gstin && !isValidGstin(gstin)) invalidB2BGstins.push({ invoiceId: inv.id, number: inv.number, gstin });
    if (inv.lines.some((l) => !l.hsnSnapshot.trim())) missingHsnInvoices.push({ invoiceId: inv.id, number: inv.number });
  }
  return { businessGstinSet: businessGstin.trim() !== '', invalidB2BGstins, missingHsnInvoices };
}

/**
 * Daily Expenses analysis (BR-EXP-03, TD §6.4): "Today / Last 7 Days / This Month" KPIs and an
 * all-time (never period-filtered) By-Category breakdown. Scoped to ONE location by the caller
 * (BR-EXP-03 — pass only that location's expenses in).
 */
export interface ExpenseLike {
  date: string;
  amountPaise: number;
  categoryId: string;
  categoryNameSnapshot: string;
}
export interface ExpenseKpis {
  todayPaise: number;
  last7DaysPaise: number;
  thisMonthPaise: number;
}
export function expenseKpis(expenses: readonly ExpenseLike[], todayISO: string): ExpenseKpis {
  const sevenDaysAgo = addDaysISO(todayISO, -6); // "last 7 days" includes today (BR-EXP-03)
  const thisMonth = monthKey(todayISO);
  let todayPaise = 0, last7DaysPaise = 0, thisMonthPaise = 0;
  for (const e of expenses) {
    if (e.date === todayISO) todayPaise += e.amountPaise;
    if (e.date >= sevenDaysAgo && e.date <= todayISO) last7DaysPaise += e.amountPaise;
    if (monthKey(e.date) === thisMonth) thisMonthPaise += e.amountPaise;
  }
  return { todayPaise, last7DaysPaise, thisMonthPaise };
}

export interface CategoryBreakdownRow {
  categoryId: string;
  categoryName: string;
  totalPaise: number;
}
/** All-time, never period-filtered (TD §6.4's own words), sorted by spend descending. */
export function expensesByCategory(expenses: readonly ExpenseLike[]): CategoryBreakdownRow[] {
  const byId = new Map<string, CategoryBreakdownRow>();
  for (const e of expenses) {
    const row = byId.get(e.categoryId) ?? { categoryId: e.categoryId, categoryName: e.categoryNameSnapshot, totalPaise: 0 };
    row.totalPaise += e.amountPaise;
    byId.set(e.categoryId, row);
  }
  return [...byId.values()].sort((a, b) => b.totalPaise - a.totalPaise);
}

/**
 * Cash Book analysis (TD §6.3 `renderCashAnalysis()`): Today/Month net movement and a category
 * breakdown, scoped to ONE location by the caller (BR-CASH-03 — no combined all-locations figure).
 */
export interface CashEntryLike {
  date: string;
  type: 'in' | 'out';
  category: string;
  amountPaise: number;
}
export interface CashKpis {
  todayNetPaise: number;
  monthNetPaise: number;
}
export function cashKpis(entries: readonly CashEntryLike[], todayISO: string): CashKpis {
  const thisMonth = monthKey(todayISO);
  let todayNetPaise = 0, monthNetPaise = 0;
  for (const e of entries) {
    const signed = e.type === 'in' ? e.amountPaise : -e.amountPaise;
    if (e.date === todayISO) todayNetPaise += signed;
    if (monthKey(e.date) === thisMonth) monthNetPaise += signed;
  }
  return { todayNetPaise, monthNetPaise };
}

export interface CashCategoryRow {
  category: string;
  type: 'in' | 'out';
  totalPaise: number;
}
/** All-time category breakdown, split by in/out (a category name is unique within its own type). */
export function cashByCategory(entries: readonly CashEntryLike[]): CashCategoryRow[] {
  const byKey = new Map<string, CashCategoryRow>();
  for (const e of entries) {
    const key = `${e.type}:${e.category}`;
    const row = byKey.get(key) ?? { category: e.category, type: e.type, totalPaise: 0 };
    row.totalPaise += e.amountPaise;
    byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => b.totalPaise - a.totalPaise);
}

export interface CreatorPerformanceRow {
  createdByName: string;
  invoiceCount: number;
  grandTotalPaise: number;
}

/** "Shop / Account Performance" — explicitly ACCOUNT performance, not named-employee performance
 * (TD §3.7: grouped by `createdByUsername`, distinct from Staff/Payroll commission tracking). */
export function performanceByCreator(invoices: readonly Invoice[], limit = 10): CreatorPerformanceRow[] {
  const byName = new Map<string, CreatorPerformanceRow>();
  for (const inv of invoices) {
    const key = inv.createdByName || 'Unknown';
    const row = byName.get(key) ?? { createdByName: key, invoiceCount: 0, grandTotalPaise: 0 };
    row.invoiceCount += 1;
    row.grandTotalPaise += inv.grandTotalPaise;
    byName.set(key, row);
  }
  return [...byName.values()].sort((a, b) => b.grandTotalPaise - a.grandTotalPaise).slice(0, limit);
}
