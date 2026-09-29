# Phase 8 — Completion Report

Business Operations: the workflows that sit between Sales, Purchases, Inventory and Accounting.
Expenses, Delivery Notes, Credit Notes (sales-return equivalent) and Debit Notes (purchase-return
equivalent) — every one server-authoritative, atomic, idempotent. Browser/PWA only — no
Electron/.exe/installer.

## Architecture

```
Expense        ──▶ saveExpense/deleteExpense (txn) ──▶ postJournalTx (journalLinesForExpense)
Delivery Note  ──▶ saveDeliveryNote (txn)           ──▶ applyMovementTx (delivery_out/return), NO journal
Credit Note    ──▶ saveCreditNote (txn)             ──▶ postJournalTx + applyMovementTx if restock
Debit Note     ──▶ saveDebitNote (txn)              ──▶ postJournalTx + applyMovementTx if restock

                              ▲ all four reuse, never duplicate:
                    postJournalTx / applyMovementTx / clampEligibleQty
```

Every operation is a single Firestore transaction: document + (accounting where applicable) +
(inventory where applicable) + audit, or nothing commits. Nothing here adds a second posting
gateway or a second stock-movement path — Phase 5/6/7's `postJournalTx`/`applyMovementTx` are
reused exactly as they are by Sales and Purchases.

## Where it lives

| Layer | Location | Contents |
|---|---|---|
| Domain | `packages/domain/src/posting.ts` | `journalLinesForExpense`, `journalLinesForCreditNote(Cogs)`, `journalLinesForDebitNote`, `clampEligibleQty` |
| Domain schemas | `packages/domain/src/schemas/finance.ts`, `schemas/sales.ts` | `createExpenseSchema`; `createDeliveryNoteSchema`, `createCreditNoteSchema`, `createDebitNoteSchema` (the Phase 3 entity schemas themselves were already in place) |
| Functions | `functions/src/accounting/{seed-expense-categories,expenses}.ts` | `seedExpenseCategories`, `saveExpense`, `deleteExpense` |
| Functions | `functions/src/sales/delivery-notes.ts`, `credit-notes.ts` | `saveDeliveryNote`, `markDeliveryNoteReturned`, `saveCreditNote` |
| Functions | `functions/src/purchases/debit-notes.ts` | `saveDebitNote` |
| Functions (shared, reused not duplicated) | `functions/src/sales/build-lines.ts` | `buildDeliveryNoteLines` (no-GST line builder) added alongside the existing invoice/quotation `buildLines` |
| Web services | `apps/web/src/services/{accounting,sales,purchases}.service.ts` | `expenses.*`, `deliveryNotes.*`, `creditNotes.*`, `debitNotes.*` — extended, not duplicated |
| Web UI | `apps/web/src/features/accounting/expense-{list,form,detail}-page.tsx`, `features/sales/delivery-note-*`, `credit-note-*`, `features/purchases/debit-note-*` | list/new/detail for each |
| Rules/indexes | `firestore.rules` (already correct from Phase 3), `firestore.indexes.json` | new composite indexes for the 4 new collections |

## Expense Management (BR-EXP-01..04, TD §6.1.2/§6.4)

Model, unchanged from the Phase 3 schema: date, locationId, categoryId, `categoryNameSnapshot`,
amountPaise (>0), mode, notes, `journalEntryId`. `seedExpenseCategories` seeds the 12 default
categories (Rent, Electricity, Water, Staff Salary/Wages, Transport/Delivery, Packing Material,
Stationery/Printing, Maintenance & Repairs, Marketing/Advertising, Tea/Refreshments, Bank Charges,
Other) with their deterministic slug ids and auto-generates each category's own expense account
(code starting 5100, stepping by 10, BR-ACC-19) — idempotent, mirroring `seedChartOfAccounts`
exactly. `saveExpense` posts Dr the category's account / Cr Cash-or-Bank (`journalLinesForExpense`)
and, per TD §6.4's own words, **always reverses any prior journal entry for that expense before
re-posting** — a no-op on create, and how an edit is reflected in the books; never an in-place
adjustment. `deleteExpense` reverses the journal then soft-deletes. Both are idempotent by
requestId and gated by the single `expenses.manage` permission (the source has no separate
create/edit/delete split for expenses).

## Cash / Bank Management — scope confirmed, nothing new built

Cash Book (`cashEntries`) was fully built in Phase 7 and is unchanged here — it remains a separate,
informal ledger that never posts to the journal (BR-CASH-02). **No Bank Operations screen and no
Cash/Bank transfer feature exist in the source** (§68, do not invent) — `cashOrBankAccount(mode)`
(Phase 5) already routes every non-Cash payment mode to a single Bank account, and that is the
entire scope of "bank" in this system. This is recorded as OQ-28 (confirmed absence, not a pending
decision) rather than silently left unaddressed.

## Delivery Notes (BR-DN-01..09, TD §5.5)

"Goods leaving the shop before a tax invoice is raised." `saveDeliveryNote` deducts stock
immediately (`delivery_out`) at the DN's location via `applyMovementTx` — the same stock-shortage
warning-not-block pattern as an invoice (BR-DN-07), and undo-then-reapply on edit. Line rates are
reference values only; **no GST is computed at all** (BR-DN-02), and **no journal entry is ever
posted** for a DN (BR-DN-09 — none documented in TD §6.1.5's list of what posts). Only a `pending`
DN may be edited or marked returned (BR-DN-03); `markDeliveryNoteReturned` restores stock
(`delivery_return`). Converting a pending DN to an invoice reuses the EXISTING
`finalizeInvoice({source:{type:'delivery_note', id}})` path built in Phase 5 — unchanged, since it
already builds invoice lines with `skipStockDeduction:true` and marks the DN `invoiced` on success.
The invoice form now also accepts `?fromDeliveryNote=<id>` to prefill from a DN, mirroring the
existing `?fromQuotation=` flow exactly.

## Credit Notes — the source's ONLY sales-return mechanism (BR-CN-01..06, TD §5.5)

There is no separate "Sales Return" document anywhere in the source. `saveCreditNote` is issued
against an existing invoice. For each requested line, the server reads every prior (posted) credit
note against the same invoice **inside the same transaction** and clamps the requested quantity to
`[0, originalQty − alreadyCreditedQty]` via `clampEligibleQty` (BR-CN-01) — a client-supplied
quantity can only ever be reduced, never trusted. Pricing (rate, discount, GST rate) and tax type
are always read from the ORIGINAL invoice line and the invoice's own `taxType`/`gstApplicable`,
never re-derived or accepted from the client (BR-CN-02) — tax is zero if the original invoice was
Without-GST. Posts `journalLinesForCreditNote` (Dr Sales Revenue, Dr GST Output Payable if taxed,
Cr Accounts Receivable, BR-CN-03) and, **only if `restock` is checked**, also
`journalLinesForCreditNoteCogs` (Dr Inventory / Cr COGS) plus a `sale_return` stock movement
(BR-CN-04). A price-correction note (restock unchecked) never touches stock or COGS. No edit or
delete exists for a Credit Note — not documented in the source, so none was built.

## Debit Notes — the source's ONLY purchase-return mechanism (BR-DBN-01..04, TD §5.5)

The exact mirror of Credit Notes, against a purchase instead of an invoice: `saveDebitNote` clamps
quantity the same way (against every prior debit note on the same purchase, read inside the same
transaction), computes `amount = qty × rate` with **no GST math at all** (BR-DBN-02), posts
`journalLinesForDebitNote` (Dr Accounts Payable / Cr Inventory, BR-DBN-03), and — only if
`restock` — removes the returned units from stock with a `purchase_return` movement (BR-DBN-04).
This restock REMOVES stock (goods returned to the supplier), the deliberate mirror of a Credit
Note's restock which ADDS stock back. No edit or delete exists here either.

## Document numbering (BR-NUM-01)

Delivery Notes, Credit Notes and Debit Notes draw from their existing Phase 3 series (`DN`, `CN`,
`DBN` — verified unchanged in `DEFAULT_PREFIXES`) via the same `reserveNumberInTx` Cloud Function
used by every other numbered document. No local counters, no client-side sequence state.

## Idempotency & atomicity (§27, §56)

Every one of `saveExpense`, `deleteExpense`, `saveDeliveryNote`, `markDeliveryNoteReturned`,
`saveCreditNote`, `saveDebitNote` runs inside one Firestore transaction and is idempotent by
`requestId` via the existing `readIdempotentResult`/`writeIdempotentResult` pattern (Phase 5). A
retry from a flaky connection can never duplicate an expense, a journal entry, or a stock movement.

## Security (§24, §49, §53, §61)

All six callables run App Check + auth + Zod → `resolveActor` → `assertPermission` →
`assertLocationAccess` (where the operation is location-scoped). Firestore rules deny all client
writes to `expenseCategories`, `expenses`, `deliveryNotes`, `creditNotes`, `debitNotes`; reads are
permission-gated (+ location for `expenses`/`deliveryNotes`). `businessId` is never taken from the
client for authorization — every referenced document (invoice, purchase, expense category) is read
inside the transaction and checked for `deletedAt`/ownership before any of its data is trusted.

## Tests

- **Domain** (`posting.test.ts`, 10 new tests): `journalLinesForExpense` (Cash vs. non-Cash
  routing, zero-amount no-op), `journalLinesForCreditNote`/`journalLinesForCreditNoteCogs`
  (balanced, Without-GST omits tax line), `journalLinesForDebitNote` (balanced, no GST),
  `clampEligibleQty` (clamps to remaining eligible, never negative, never over-returns).
- **Rules** (`tests/rules/operations.test.ts`, new): client writes denied for
  `expenses`/`deliveryNotes`/`creditNotes`/`debitNotes`; reads gated by
  `expenses.view`/`deliveryNotes.view`/`sales.view`/`purchases.view` respectively; cross-business
  isolation for all four collections (read and write).
- **Not independently emulator-tested at the callable-invocation layer**: `saveExpense`,
  `saveDeliveryNote`, `saveCreditNote`, `saveDebitNote` are each a single-purpose `defineCallable`
  with their transaction logic inline — matching the Phase 7 precedent that only logic reused by
  multiple callers gets extracted into a `-core.ts` module for direct emulator testing. Their
  correctness rests on: (a) the domain-level posting/clamping functions above, unit-tested; (b) the
  shared `postJournalTx`/`applyMovementTx` cores they call, already emulator-tested in
  `sales.emu.test.ts`/`accounting.emu.test.ts`/`inventory.emu.test.ts`; (c) code review against
  BR-EXP/BR-DN/BR-CN/BR-DBN; and (d) the rules tests above, which cover the data shape and access
  control these callables produce and depend on.

## Verification (Definition of Done)

- `npm run typecheck` (domain+web+functions) ✅ · `npm run lint` ✅ (0 errors, pre-existing
  fast-refresh warnings only) · `npm test` — domain 119 / web 28 / functions 19 ✅ ·
  `npm run test:rules` — 77 passed (Firestore emulator, includes the 6 new Phase 8 rules tests) ✅ ·
  `npm run build` ✅

## Unresolved source gaps (documented, not invented)

- OQ-28: Bank Operations / Cash-Bank fund transfer — confirmed absent in the source, not a pending
  decision. See `docs/OPEN-QUESTIONS.md`.
- No edit/delete for Credit Notes or Debit Notes — not documented in the source; a correction is
  its own new Credit/Debit Note (price-correction, restock unchecked), never an edit in place.
- BR-CN-06 (credit note rounding/round-off) remains NOT VERIFIED (OQ-11, carried over from Phase 3)
  — this phase computes `grandTotalPaise = subtotal + tax` with no additional round-off invented.

---

LEGACY COMPATIBILITY CHECK

Expenses
- [x] Fields preserved: date, location, category (+ name snapshot), amount>0, payment mode, notes (BR-EXP-01/02).
- [x] Defaults preserved: 12 default categories, deterministic slug ids, auto-coded linked accounts starting 5100 step 10 (BR-ACC-19, BR-EXP-04).
- [x] Accounting behavior preserved: Dr category account / Cr Cash-or-Bank; edit/delete always reverses then re-posts (TD §6.4).
- [x] Permissions preserved: `expenses.manage` gates all mutation, matching the source's lack of a create/edit/delete split.

Cash/Bank
- [x] Source-supported workflows preserved: Cash Book (Phase 7) unchanged; Cash-vs-Bank routing (Phase 5) unchanged.
- [x] Account behavior preserved: no new accounts, no new routing rule invented.
- [ ] Transfer behavior: N/A — confirmed absent in the source (OQ-28), not built.

Sales Returns (via Credit Notes — no separate document exists)
- [x] Return rules preserved: issued against an invoice; inherits invoice taxType/gstApplicable (BR-CN-01/02).
- [x] Quantity rules preserved: clamped server-side to `[0, original − alreadyCredited]`, read fresh each time.
- [x] Inventory effect preserved: `sale_return` movement, ONLY if restock (BR-CN-04).
- [x] Accounting effect preserved: Dr Sales/Dr GST-Output/Cr AR, plus Dr Inventory/Cr COGS only if restocked (BR-CN-03/04).

Purchase Returns (via Debit Notes — no separate document exists)
- [x] Return rules preserved: issued against a purchase, same clamping pattern (BR-DBN-01).
- [x] Inventory effect preserved: `purchase_return` movement (stock OUT — returned to supplier), ONLY if restock (BR-DBN-04).
- [x] Accounting effect preserved: Dr Accounts Payable / Cr Inventory, no GST (BR-DBN-02/03).

Credit Notes
- [x] "CN" prefix preserved (unchanged from Phase 3 `DEFAULT_PREFIXES`).
- [x] Numbering preserved: server-authoritative `reserveNumberInTx`, same series used since Phase 3.
- [x] Accounting behavior preserved: see above.

Debit Notes
- [x] "DBN" prefix preserved (unchanged from Phase 3 `DEFAULT_PREFIXES`).
- [x] Numbering preserved: server-authoritative, same series.
- [x] Source-defined behavior preserved: no GST math, amount=qty×rate (BR-DBN-02).

Delivery Notes
- [x] "DN" prefix preserved (unchanged from Phase 3 `DEFAULT_PREFIXES`).
- [x] Numbering preserved: server-authoritative, same series.
- [x] Inventory behavior preserved: stock-out on save, stock-in on mark-returned, no GST, no journal entry (BR-DN-01/02/09).

Legacy safety improvements — NOT reproduced
- Client-only authorization → App Check + auth + Zod + `assertPermission`/`assertLocationAccess` on every callable.
- Unsafe direct accounting writes → every posting goes through the single `postJournalTx` gateway (§53), never a second implementation.
- Unsafe stock writes → every movement goes through `applyMovementTx`, never a direct level write.
- Client-side numbering → `reserveNumberInTx`, the same server-authoritative counter used since Phase 3.
- Duplicate posting vulnerabilities → every mutation is idempotent by requestId, verified via the existing `readIdempotentResult`/`writeIdempotentResult` pattern.

- Deviations (with reason / OQ ref): no Bank Operations/transfer feature (OQ-28, confirmed absent, not a gap); no edit/delete for Credit/Debit Notes (not documented in source); expense location-filter UI defaults to "All locations" rather than strictly `currentLocationId` (matches the multi-location visibility already extended to Journal/Cash Book/General Ledger in Phase 7, not a business-rule change).
- NOT VERIFIED items touched: BR-CN-06 credit-note rounding (OQ-11, carried over, unchanged).
