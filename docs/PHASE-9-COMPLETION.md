# Phase 9 — Completion Report

Reports, Analytics & Business Dashboard: read-only views over data already built and posted in
Phases 0–8. No new Cloud Functions, no new Firestore collections, no new Firestore rules. Browser/
PWA only — no Electron/.exe/installer.

## Architecture

```
UI page ──▶ report hook (bounded useLedgerAggregate fetch, Phase 7) ──▶ pure calculation
                                                                          (packages/domain/src/reports.ts)
                                                                          ──▶ render (Recharts / Table)

                      ▲ never: UI ──▶ Firestore directly
                      ▲ never: a report recomputes a number a Cloud Function already stored
```

Every report page does 1–3 bounded fetches (never a fetch per KPI) and, where two pages need the
same figure, they share the same hook or the same already-fetched array rather than duplicating the
query (`useOutstandingInvoiceSource()` backs both the Dashboard's Outstanding Dues card and the Dues
page; Cash Book's new KPIs reuse the page's existing `entries` fetch with no new query at all).

## Where it lives

| Layer | Location | Contents |
|---|---|---|
| Domain | `packages/domain/src/reports.ts` | `generatePeriods`, `bucketByPeriod`, `duesSummary`, `salesSummary`, `topProductsFromInvoices`, `topCustomersFromInvoices`, `performanceByCreator`, `gstFilingSummary`, `gstFilingReadiness`, `expenseKpis`, `expensesByCategory`, `cashKpis`, `cashByCategory` |
| Domain | `packages/domain/src/dates.ts` | `addDaysISO` (date math shared by `reports.ts`) |
| Domain tests | `packages/domain/src/reports.test.ts` | 26 tests covering every function above |
| Web hooks | `apps/web/src/features/dashboard/use-dashboard-data.ts`, `features/sales/use-receivables.ts`, `features/purchases/use-payables.ts` | bounded, capped, shareable data sources |
| Web components | `apps/web/src/components/charts/trend-chart.tsx`, `apps/web/src/lib/csv.ts` | shared trend chart (Chart/Table toggle), CSV export |
| Web UI | `apps/web/src/features/dashboard/dashboard-page.tsx`, `features/reports/{reports,shop-comparison}-page.tsx`, `features/accounting/gst-filing-page.tsx` | Dashboard, Sales Reports, Shop Comparison, GST Filing |
| Web UI (extended, not duplicated) | `features/sales/dues-page.tsx`, `features/accounting/payables-page.tsx`, `features/accounting/expense-list-page.tsx`, `features/accounting/cash-book-page.tsx`, `features/inventory/movement-history-page.tsx` | Dues/Payables KPI completeness, Expense/Cash trend + category tables, Wastage KPI |
| Router/nav | `apps/web/src/app/router.tsx`, `config/nav.ts` | `/reports` (nested: index + `shop-comparison`), Shop Comparison nav entry |

## Report catalog

| Report | Scope | Source |
|---|---|---|
| Business Dashboard | All locations (Low Stock: working location) | TD §3.1 |
| Sales Reports | Working location | TD §3.7 |
| Shop Comparison | Per location + combined | TD §3.5 |
| GST Filing | All locations, one month | TD §6.5 |
| Dues (Receivables) | All locations | TD §3.1, §6.8 |
| Payables | All locations | TD §6.8 |
| Expense Report | Working location | TD §6.4 |
| Cash Analysis | Per location (Cash Book's own scope) | TD §6.3 |
| Wastage/Shrinkage KPI | Working location, this month | TD §4.3 |

## Calculation definitions

- **Sales figures** (`salesSummary`, Dashboard's today/month totals): `Σ grandTotalPaise` over
  non-deleted invoices in range. Never recomputed through the GST/pricing engine — invoices already
  store their final totals.
- **Comparison percentages** (`vsYesterday`, `vsLastMonth`): `(current − base) / base`, computed and
  shown ONLY when `base > 0` (BR-RPT-01) — otherwise the card shows the raw value with no percentage,
  never a misleading `+∞%` or `0%`.
- **Outstanding Dues / Payables** (`duesSummary`): `outstanding = total − paid` per document;
  "overdue" = outstanding > 0 as of a stored due/invoice date; "due in next 7 days" = outstanding > 0
  and due date within `[today, today+7]`. The 50-paise "still outstanding" tolerance from BR-MNY-02
  is inherited from `outstandingOf`/`isOutstanding` (Phase 5/6, unchanged) — Phase 9 does not
  reimplement this threshold.
- **Top Products / Top Customers / Performance by Creator**: `Σ` over invoice lines grouped by
  `productId`/`customerId`/`createdBy` respectively, sorted descending, sliced to the top N. Discount
  amount shown per product is derived arithmetically (`gross − taxable` per line via `Money`), never
  re-run through the tax engine.
- **GST Filing**: B2B = taxable invoice has a customer GSTIN; B2C = taxable invoice has none;
  Without-GST invoices are listed on their own tab and excluded from every taxable/tax total and
  every export (BR-RPT-05). Net B2B/B2C figures for the month subtract same-month credit notes
  issued against invoices in that split. HSN summary groups taxable lines by `hsn | gstRateBp`
  (BR-RPT-06). All tax figures are summed from the stored per-invoice/per-line fields — never
  recalculated.
- **Filing readiness** (`gstFilingReadiness`): business GSTIN present; every B2B invoice's customer
  GSTIN matches the 15-character pattern (`isValidGstin`, reused from `gst-states.ts`, Phase 2); no
  taxable line missing an HSN code. Always labelled "not a substitute for review by a CA" in the UI,
  matching TD §6.5.
- **Shop Comparison** (`shopComparisonRows`): for each location, `sales` = Sales Revenue account
  balance in range, `cogs` = COGS account balance in range (both from the SAME ledger as Trial
  Balance/P&L via Phase 7's `sumByAccount`), `gross = sales − cogs`, `expenses` = all expense
  accounts except COGS, `net = gross − expenses`; `bills` = invoice count at that location in range.
  A combined row sums every location. This is the same double-entry data as the financial
  statements — never a second parallel computation.
- **Expense/Cash KPIs and category breakdowns**: `Σ amountPaise` grouped by today/last-7-days/
  this-month (expenses) or in/out (cash), and by category, over the page's already location-scoped
  data.
- **Wastage/Shrinkage**: `Σ |qtyChange| × product.purchasePricePaise` over this month's
  `type='adjustment'`, `reasonCategory='wastage'` stock movements at the working location. Adjustment
  movements don't carry a historical unit cost (only sale/COGS movements snapshot `unitCostPaise`),
  so valuing at the product's **current** purchase price is the only value computable from stored
  data — a documented interpretation, not an invented rule.

## Date semantics

- "Today", "this month", "last 7 days" are computed against `todayISO()` (Asia/Kolkata, BR-DAT-03,
  unchanged from Phase 0).
- Trend charts group into day/week/month buckets via `generatePeriods`/`bucketByPeriod` — week
  buckets are Monday-start ISO weeks. This is a **display convention**, not a financial calculation,
  and is explicitly marked NOT VERIFIED against the legacy source (no OQ raised — it doesn't change
  any stored figure, only how it's grouped for a chart).
- Every trend shows the **last 14 periods** ending on the current bucket, matching TD §3.7/§6.3/§6.4's
  "last N periods" pattern.

## Filters

| Report | Filters offered |
|---|---|
| Dashboard | Trend granularity toggle (14/30/90-day amount trend) |
| Sales Reports | Granularity (day/week/month) |
| Shop Comparison | Date range (defaults to month-to-date) |
| GST Filing | Month picker |
| Expense Report | Category, location (existing list filter); granularity (new trend) |
| Cash Book | Location (existing); granularity (new trend) |
| Movement History | Location, movement type (existing); Wastage KPI has no separate filter — always this month, working location |

## Permissions and location security

No new permissions were introduced; every report reuses its existing gate:
`dashboard.view`, `reports.view`, `shopComparison.view`, `gst.view`, `dues.view`, `purchases.view`
(Payables), `expenses.view`, `cashbook.view`, `stock.view` (Movement History/Wastage). Location
scoping matches the source exactly (see the Report catalog table above) — no report widens or
narrows a location's visibility beyond what the equivalent legacy screen showed. Because no new
collections or rules were added, isolation is inherited unchanged from Phases 4–8's Firestore rules;
this was re-verified end-to-end by re-running the full rules-emulator suite after this phase's
changes: **77/77 tests pass** across `masterdata.test.ts`, `sales.test.ts`, `inventory.test.ts`,
`operations.test.ts`, and the three `*.emu.test.ts` transaction suites — no regression.

## Export behavior

GST Filing offers CSV export for B2B, B2C and HSN tables (`downloadCSV()`, `lib/csv.ts`) — purely
client-side, built from data the page already fetched under the page's own permission and month/
location scoping. No new callable, no server round-trip; matches the TD's own `downloadB2BCsv`-style
client export (TD §3.7). No other report offers export, since none is documented as exportable in
the TD beyond GST's own CSVs.

## Aggregation architecture, indexes, caching

- **Aggregation**: every report is `useLedgerAggregate` (Phase 7) — a bounded, capped, page-at-a-time
  fetch (`LEDGER_FETCH_CAP = 5000` by default, or a smaller page-specific limit), never an unbounded
  scan and never a realtime (`onSnapshot`) listener (§33 "avoid aggressive realtime listeners").
  Manual refresh is exposed on every hook.
- **Indexes**: no new composite indexes were required — every Phase 9 query reuses an index already
  declared in `firestore.indexes.json` for its collection during Phases 5–8 (date-ordered, optionally
  filtered by `locationId` and/or `deletedAt`/`status`).
- **Caching**: none beyond the bounded fetch itself and React's own render memoization
  (`useMemo` around every derived calculation) — no client-side result cache, no stale-while-
  revalidate layer, consistent with the rest of the app's read pattern.

## Known limitations

- Week-bucket boundaries (Monday-start ISO week) for trend charts are a display convention with no
  legacy source to verify against — NOT VERIFIED, but deliberately not raised as an OQ since it
  affects only chart grouping, never a stored or reported total.
- Shop Comparison's date range has no fixed default beyond month-to-date; the legacy screen's exact
  default range (if different) is NOT VERIFIED (no OQ raised — month-to-date is the same default
  already used by P&L in Phase 7).
- The Dashboard's legacy "Number of Bills" trend series (alongside amount) was flagged in the TD as
  dead/vestigial code and is deliberately not reproduced (§69) — only the amount series is shown.

## Deliberately not built, and why (§65/§68)

- **A standalone Purchase Reports screen.** Not documented in the TD as a distinct report screen —
  Purchases already has its own filterable, sortable list (Phase 6). Building a separate analytics
  screen for it would be inventing a report the source doesn't have.
- **A Bank Report or bank reconciliation screen.** Confirmed absent in Phase 8 — no Bank Operations
  module exists anywhere in the source. See `docs/OPEN-QUESTIONS.md` (OQ-28).
- **A separate "Sales by Location" report.** Fully covered by Shop Comparison's per-location `sales`
  column (BR-ACC-20).
- **A new Account Statement page.** Phase 7's General Ledger already is the per-account date/
  reference/debit/credit/running-balance statement the TD describes (TD §6.2).
- **Generic SaaS metrics** (LTV, CAC, MRR, ARR, churn, cohort retention, and similar). None appear in
  the TD — this is a wholesale ledger, not a subscription business.

## Fixed along the way

While building this phase's Dashboard, a pre-existing bug was found and fixed in
`apps/web/src/lib/firebase/functions.ts`: `callable()` resolved the Firebase Functions instance
**eagerly, at module load**, so merely *importing* `hooks/use-master-data.ts` (which several new
report hooks now do, for the first time in a component tree that also renders without Firebase
configured — e.g. `app-shell.test.tsx`) threw `Firebase is not configured` even when nothing was
actually being called. Fixed by deferring the `getFirebaseFunctions()` call to the first actual
invocation. This has no effect on production behavior (Firebase is always configured there) — it
only makes the module safely importable before configuration exists, which is what unblocked the
existing `app-shell.test.tsx` integration test once the new Dashboard began exercising this import
path.

---

LEGACY COMPATIBILITY CHECK

Dashboard
- [x] Existing defaults preserved: KPI set (Today's Sales, Month Sales, Outstanding Dues, Low Stock, Recent Invoices) unchanged (TD §3.1).
- [x] Existing calculations preserved: BR-RPT-01/02/03/09 — see `reports.test.ts`.
- [x] Existing user-visible behavior preserved: "vs yesterday/last month %" shown only when the comparison base > 0; no misleading percentage on a zero base.

Sales Reports
- [x] Existing calculations preserved: BR-RPT-04 — `salesSummary`, `topProductsFromInvoices`, `topCustomersFromInvoices`, `performanceByCreator`, all tested.
- [x] Existing workflows preserved: working-location scope, 14-period day/week/month grouping (TD §3.7).

Purchase Reports
- [ ] N/A — deliberately not built; see "Deliberately not built" above.

Inventory (Wastage/Shrinkage)
- [x] Existing calculations preserved: TD §4.3, valued at purchase price; documented interpretation (current price, since no historical cost is stored on adjustment movements).

Accounting (Shop Comparison, GST Filing)
- [x] Existing calculations preserved: BR-ACC-20/21, BR-RPT-05/06/07 — all tested (`reports.test.ts`) and computed from the same ledger/stored fields as the financial statements/invoices.
- [x] Existing document behavior preserved: GST Filing's B2B/B2C/Without-GST split, HSN summary, readiness checklist, CSV export.

Receivables/Payables
- [x] Existing calculations preserved: BR-DUE-08 — `duesSummary()` shared verbatim by Dashboard, Dues, and Payables, so the three screens can never disagree.

- Existing defaults preserved: [list DEF-* touched → status] — none touched; Phase 9 reads existing data, no new defaults.
- Existing settings preserved: N/A — no new settings.
- Existing validations preserved: N/A — reports are read-only, no new validation surface.
- Existing calculations preserved: BR-RPT-01..09, BR-ACC-20/21, BR-DUE-08, BR-EXP-03, TD §6.3/§4.3 — see test names above and `reports.test.ts` (26 tests).
- Existing workflows preserved: report location/date scoping matches TD section-by-section (see Report catalog above).
- Existing permissions preserved: no new permissions; every page reuses its existing `*.view` gate.
- Existing document behavior preserved: GST Filing CSV export mirrors TD's `downloadB2BCsv` pattern.
- Existing reports preserved: all nine reports listed in the Report catalog; none removed or simplified.
- Existing user-visible behavior preserved: KPI cards never show a fabricated or misleading figure; a failed widget never blocks the rest of the dashboard.
- Deviations (with reason / OQ ref): none requiring a new OQ this phase — week-bucket convention and Dashboard's "Number of Bills" series omission are documented above as deliberate, source-grounded decisions, not deviations from a documented rule.
- NOT VERIFIED items touched: week-bucket boundary convention for trend charts (display only, no stored figure affected); Shop Comparison's exact default date range (defaults to month-to-date, matching P&L's Phase 7 default).
