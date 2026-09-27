# Phase 5 — Completion Report

Sales Management. Quotations → GST / Without-GST invoices → payments → receivables → accounting, end
to end, server-authoritative, reusing the Phase 3/4 architecture. No Purchase/Inventory/Reports
modules were built; Sales exposes the integration boundaries the Inventory phase (Phase 6) needs.

Browser/PWA only — no Electron, `.exe`, or desktop packaging introduced.

## Where it lives

| Layer | Location | Contents |
|---|---|---|
| Pure domain | `packages/domain/src` | `gst.ts` `computeCart` (one deterministic lines+totals pass), `posting.ts` (journal-line builders + payment-status/outstanding math), `schemas/sales.ts` `createQuotationSchema` |
| Accounting gateway (server) | `functions/src/accounting/post-core.ts` | `postJournalTx` (balance-or-refuse), `readPostedJournalsForRef` + `voidEntries` (undo-then-reapply) |
| Numbering (server) | `functions/src/numbering/reserve-core.ts` | `reserveNumberInTx` — numbering atomic with the finalize transaction |
| Idempotency (server) | `functions/src/utils/idempotency.ts` | transaction-scoped dedupe by requestId |
| Sales callables (server) | `functions/src/sales/*` | `finalizeInvoice`, `deleteInvoice`, `recordPayment`, `saveQuotation`, shared `build-lines.ts` |
| Web service/hooks | `apps/web/src/services/sales.service.ts`, `hooks/use-master-data.ts` | the only write path; `useSalesService`; quotations repo added to the registry |
| Web UI | `apps/web/src/features/sales/*` | invoice list/detail/new/edit/print, quotation list/detail/new/edit, payments, dues, record-payment dialog, shared line editor + totals |
| Rules/indexes | `firestore.rules`, `firestore.indexes.json` | client writes denied for all sales collections; composite indexes for list queries |

## Implemented (mapped to the spec)

- **Quotations (§6/§7/§43):** list/create/edit/view; QUO numbering via the server; generic tax engine
  (always GST — no Without-GST toggle, §18); convert-to-bill pre-fills a New Bill and links the
  source; the source flips to `converted` only on a successful invoice save (BR-INV-15). Statuses use
  only the source enum (`open`/`converted`).
- **Invoices (§8–§10):** New Bill opens **Without GST** (DEF-016/BR-INV-01); GST → INV series,
  Without-GST → NGST series (BR-NUM-04); numbers are reserved atomically inside the finalize
  transaction, so concurrent users/devices/locations never collide and a failed save consumes no
  number (BR-NUM-05/11). Idempotent by requestId (§27) — a retry/timeout/double-tap never duplicates.
- **Line snapshots (§13):** each line stores name/code/HSN/unit/qty/baseQty/rate/discount/gstRate/
  tax/total + `unitCostPaise` (COGS snapshot, BR-COGS-02) + `skipStockDeduction`; the document never
  depends on the live product.
- **GST (§16/§17/§19/§20):** the Phase 3 engine is the single calculator; intra → CGST+SGST, inter →
  IGST, blank/unknown state → intra; Without-GST zeroes tax; the >₹2500→18% rule stays a suggestion.
- **Financial integrity (§22/§23/§56):** the client preview uses the same `computeCart`, but the
  server recomputes every taxable/tax/roundoff/grand/receivable from master data before posting;
  no client money is trusted.
- **Finalization (§26/§28/§29/§59):** one transaction reserves the number, writes the invoice, posts
  the invoice journal (Dr Cash at-billing / Dr AR / Cr Sales `subtotal+roundOff` / Cr GST Output,
  BR-ACC-08) and the COGS journal (Dr COGS / Cr Inventory, BR-COGS-01), sets the receivable state,
  flips the source, and audits.
- **Editing (§36/§37/§38):** location-locked (server-enforced, BR-INV-10); past-month edits require a
  confirmation (non-blocking warning); edit is undo-then-reapply — old invoice+COGS journals are
  voided and re-posted, the number and the amount received are preserved, status re-derived
  (BR-INV-11/12, BR-ACC-09). Delete voids invoice+COGS+payment journals, reverts the source, and
  soft-deletes (number stays reserved, BR-INV-13).
- **Payments (§31–§35):** amount>0; over-outstanding needs a confirmation (BR-PAY-01); updates the
  parent's paid/outstanding/status (BR-PAY-02), posts `payment_in` respecting the real mode
  (BR-PAY-03/04), optional Cash Book entry, idempotent.
- **Lists/detail/print (§40/§41/§42):** cursor-paginated invoice/quotation/payment lists with
  server filtering + client search; a professional detail page with payment history; a browser-print
  tax-invoice view preserving business identity, GST info, line items, tax breakdown, totals and bank
  details.
- **UX (§46–§53):** responsive line editor (works 360–1920px), Light/Dark/System tokens, confirmation
  dialogs (never `window.confirm`), toasts, loading/empty/error states, human-readable error mapping.
- **Security (§54–§59):** all writes via callables running App Check + auth + Zod + `resolveActor` →
  `assertPermission` → `assertLocationAccess`; Firestore rules deny client writes to
  invoices/quotations/payments/journalEntries/documentNumbers/idempotency and gate reads by
  permission + location.

## Phase-6 boundary (documented dependency)
Physical stock movement (`stockMovements`/`stockLevels`) is **not** written yet (§15/§29). Each line
already carries `baseQty`, `unitCostPaise` and `skipStockDeduction`, and finalize/delete are the exact
transactions where the Inventory phase will add the stock writes. The stock-shortage check (BR-INV-05)
is plumbed (a `confirmations` field) but not computed server-side until stock exists. The COGS
*accounting* entry is posted now because its value is well-defined (purchase-price snapshot). Whether
DN-sourced lines post COGS and which cost a CN restock uses remain OQ-11 / BR-COGS-03.

## Tests
- **Domain:** `posting.test.ts` (invoice/COGS/payment journal lines balance, cash/AR split,
  at-billing cap, round-off, payment status & outstanding thresholds), `gst-cart.test.ts` (intra
  CGST+SGST, inter IGST, Without-GST=0, discount, rounding, state edges, rate suggestion).
- **Emulator (`tests/rules/sales.emu.test.ts`):** postJournalTx balances-or-refuses (nothing written
  on imbalance) and drops all-zero entries; void-by-ref; numbering rolls back atomically when the
  transaction throws (BR-NUM-11); idempotency replay returns the stored result. Numbering concurrency
  stays covered by `numbering.emu.test.ts`.
- **Rules (`tests/rules/sales.test.ts`):** client writes denied for invoices/quotations/payments/
  journalEntries/documentNumbers/idempotency; reads gated by permission + location.

## Verification (Definition of Done)
- `npm run build:domain` ✅ · `npm run typecheck` (domain+web+functions) ✅ · `npm run lint` ✅
  (0 errors; pre-existing react-refresh warnings only) · `npm test` — domain 97 / web 28 /
  functions 19 ✅ · `npm run test:rules` — 52 passed (Firestore emulator) ✅ · `npm run build` ✅

## Out of scope (later phases)
Delivery/Credit/Debit Notes, Purchases, Inventory stock workflows, full Accounting reports, Dashboard,
Payroll — left as placeholders or later phases. Overpayment beyond confirmation, and any correction
workflow beyond delete, are not invented here (credit notes are a later phase).

---

LEGACY COMPATIBILITY CHECK
- Existing defaults preserved:        DEF-016 New Bill opens Without GST → preserved (NEW_BILL_GST_APPLICABLE_DEFAULT, invoice form default); DEF-001..012 series prefixes/start seq (INV/NGST/QUO) → preserved via server numbering.
- Existing settings preserved:        numbering prefixes read from settings (BR-NUM-08/09); seller state/GSTIN/bank from business settings used for tax type + print.
- Existing validations preserved:     qty>0 (BR-INV-03); ≥1 line; amount>0 (BR-PAY-01); journal balance-or-refuse (BR-ACC-01); barcode/no-slash unaffected.
- Existing calculations preserved:    GST intra/inter/without (BR-GST-03..06), CGST=SGST, round-to-rupee roundOff (BR-MNY-03), COGS Σ purchasePrice×baseQty (BR-COGS-01), payment status thresholds (BR-PAY-02) — tests: gst-cart.test.ts, posting.test.ts, gst.test.ts.
- Existing workflows preserved:       New Bill; edit = undo-then-reapply (BR-INV-11); edit keeps amount received (BR-INV-12); delete reverses stock/journals + reverts source (BR-INV-13); quotation → invoice conversion (BR-INV-15).
- Existing permissions preserved:     sales.view/create/edit/delete, quotations.view/manage, payments.record, dues.view (Phase 2 names) — enforced server-side + in rules.
- Existing document behavior preserved: number format PREFIX/FY/seq (BR-NUM-02); six independent series (BR-NUM-01); number never reused, never consumed on failure (BR-NUM-06/07/11); frozen customer/seller snapshots (BR-INV-08).
- Existing reports preserved:         N/A this phase (P&L/TB/GST filing are later); journal postings feed them and follow BR-ACC-08/09, BR-COGS-01.
- Existing user-visible behavior preserved: Without-GST default, stock-shortage & over-payment as non-blocking warnings, past-month edit warning, tax breakdown display, INR formatting.
- Deviations (with reason / OQ ref):  KL-01 fixed (server-authoritative atomic numbering, not per-device); invoice soft-deleted instead of hard-deleted (BR-INV-13 [FIX]); physical stock movement deferred to Phase 6 (§15/§29 boundary); at-billing paid books to Cash regardless of mode (BR-PAY-06 / OQ-07).
- NOT VERIFIED items touched:         BR-NUM-03 (FY-scope/label source — OQ-03, default single sequence kept); BR-COGS-03 (DN COGS / CN restock cost — OQ-11, not reached this phase); credit-limit warning uses stored customer stats only (BR-INV-06, full recompute deferred).
