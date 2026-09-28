# Phase 6 — Completion Report

Purchases, Inventory & Stock Management. Purchase → stock-in → balance, and Sale → stock-out →
balance, with an append-only movement ledger as the source of truth and the derived stock level kept
in lock-step. Server-authoritative, atomic, idempotent. Browser/PWA only — no Electron/.exe/installer.

## Architecture

```
Purchase ─▶ finalizePurchase (txn) ─▶ purchase movement (+) ─▶ stockLevel
Sale     ─▶ finalizeInvoice  (txn) ─▶ sale movement     (−) ─▶ stockLevel
                                     ▲
                        applyMovementTx: immutable movement + level, one transaction
```

The **stock movement ledger** (`stockMovements`) is authoritative and append-only (BR-STK-02); the
per-cell **stock level** (`stockLevels`, keyed `productId_variantId_locationId`) is a derived cache
updated in the SAME transaction as the movement (BR-STK-03). Nothing writes a balance without a
movement that records why it changed.

## Where it lives

| Layer | Location | Contents |
|---|---|---|
| Domain | `packages/domain/src/posting.ts`, `schemas/finance.ts` | `journalLinesForPurchase` (no GST); `createPurchaseSchema` |
| Stock core | `functions/src/inventory/stock-core.ts` | `applyMovementTx` / `readLevelTx` — ledger + level in one txn; negative gate |
| Purchases | `functions/src/purchases/{finalize,delete}-purchase.ts` | finalize (stock-in + journal + payable), delete (reverse + void) |
| Inventory ops | `functions/src/inventory/{adjustments,transfers,counts,opening}.ts` | adjust / transfer / count / opening |
| Sales↔stock | `functions/src/sales/{finalize,delete}-invoice.ts` | sale / sale_reversal movements + shortage check |
| Web services/hooks | `apps/web/src/services/{inventory,purchases}.service.ts` | the only write paths |
| Web UI | `apps/web/src/features/{inventory,purchases}/*` | stock, movements, transfer, count, adjust; purchases list/new/detail |
| Rules/indexes | `firestore.rules`, `firestore.indexes.json` | client writes denied; stock/movement/purchase indexes |

## Movement types (BR-STK-02, no invention)
`opening, adjustment, purchase, purchase_reversal, transfer_out, transfer_in, sale, sale_reversal,
delivery_out, delivery_return, sale_return, purchase_return, migration_opening` — the exact Phase-3
enum. Phase 6 emits: purchase / purchase_reversal (purchases), sale / sale_reversal (invoices),
transfer_out / transfer_in (transfers), adjustment (manual + count corrections), opening (opening
stock). delivery_*, sale_return, purchase_return belong to their later document workflows.

## Purchases (BR-PUR-01..08)
- Supplier + ≥1 item + every qty>0; entered qty/unit → base units via the alt-unit factor (BR-PUR-02).
- **No document number** — purchases reference the supplier's own bill number (the numbering module
  has no purchase series). **No GST** on purchases (BR-PUR-08 / OQ-06); total = Σ qty×rate.
- Stock-in `purchase` movement per line at the location (BR-PUR-03). The product's `purchasePrice` is
  updated **only** for base-unit lines (BR-PUR-05) — this is exactly the cost basis Phase-5 COGS
  snapshots read.
- Journal (BR-PUR-04): Dr Inventory (total) / Cr Cash (paid now) / Cr Accounts Payable (remainder).
- Payable state (paid/outstanding/status) on the purchase (BR-PAY-02 semantics). Delete reverses
  stock (`purchase_reversal`), voids the purchase + payment journals, and soft-deletes (BR-PUR-06).

## Sales → Inventory (BR-INV-05/07/11/13, §33)
- finalizeInvoice writes a `sale` movement per non-`skipStockDeduction` line at the invoice location.
- **Shortage is a warning** (BR-INV-05): the server checks availability (after adding back the old
  version's quantity on edit) and, if short, returns `STOCK_SHORTAGE`; the client re-submits with the
  confirmation. That confirmation is the source-supported override that permits going negative
  (BR-STK-06) — the legacy behaviour, never a silent hard block.
- Edit = undo-then-reapply: reverse old lines (`sale_reversal`) then deduct new ones. Delete restores
  stock for lines that deducted it. COGS accounting is unchanged (purchasePrice snapshot, BR-COGS).

## Inventory operations
- **Adjustment** (BR-STK-07): stock.adjust; in/out, reason category + note; `adjustment` movement.
- **Transfer** (BR-STK-08): stock.transfer, access to both locations; `transfer_out` + `transfer_in`
  atomically; source ≠ destination.
- **Stock count** (BR-STK-10): stock.count; the diff is **recomputed against live stock at apply
  time**; each changed line posts an `adjustment`/`correction` movement to the counted quantity; a
  zero-change count is rejected; a summary `stockCounts` record is kept.
- **Opening stock** (BR-STK-15): stock.adjust; `opening` movements — never a silent balance write.
- **Negative stock** (BR-STK-06): only with the `stock.overrideNegative` permission **and** an explicit
  NEGATIVE_STOCK confirmation (sales use the shortage confirmation as their override).

## Accounting integration (§37, §38)
Only movements the source books post a journal: purchases (Dr Inventory / Cr Cash / Cr AP) and sales
(revenue + COGS Dr COGS / Cr Inventory). Adjustments, transfers, opening and counts record stock
movements but **no** journal (none documented). GST Input (`acc-gst-input`) is never posted
(BR-PUR-08 / OQ-06). Every posting flows through the Phase-5 balance-or-refuse gateway.

## Valuation (§36, §63) — nothing invented
The source defines COGS as `Σ purchasePrice × baseQty` with `purchasePrice` snapshotted at sale time
(BR-COGS-01/02); a purchase updates `purchasePrice` for base-unit lines (BR-PUR-05). That is the whole
cost basis. **No FIFO / LIFO / weighted-average / moving-average / standard cost was introduced.**

## Security (§24, §49, §53, §61)
All stock/purchase writes are server-authoritative callables running App Check + auth + Zod →
`resolveActor` → `assertPermission` → `assertLocationAccess` (both locations for transfers). Firestore
rules deny client writes to `stockLevels`, `stockMovements`, `purchases`, `stockTransfers`,
`stockCounts` and gate reads by permission + location. No client-supplied stock qty / totals are
trusted. Every mutation is idempotent by requestId.

## Tests
- **Domain** (`posting.test.ts`): purchase journal lines balance, cash/AP split, no GST-input,
  paid-now cap.
- **Emulator** (`inventory.emu.test.ts`): purchase-in/sale-out update ledger + level; negative refused
  with nothing written; negative allowed with override; failed transaction rolls back both
  movement and level (no partial write); sequential transfer out/in stacks correctly.
- **Rules** (`inventory.test.ts`): client writes denied for stockLevels/stockMovements/purchases/
  stockTransfers/stockCounts; reads gated by permission + location.

## Verification (Definition of Done)
- `npm run build:domain` ✅ · `npm run typecheck` (domain+web+functions) ✅ · `npm run lint` ✅
  (0 errors) · `npm test` — domain 100 / web 28 / functions 19 ✅ · `npm run test:rules` — 61 passed
  (Firestore emulator) ✅ · `npm run build` ✅

## Unresolved source gaps (documented, not invented)
- OQ-06 / BR-PUR-08: purchase GST / input-tax-credit is undocumented → not posted.
- OQ-11 / BR-COGS-03: whether DN-sourced (skipStockDeduction) lines post COGS and which cost a
  credit-note restock uses — not reached (credit/debit notes are a later phase).
- Returns UI (credit/debit notes) is a later phase; the movement types (`sale_return`,
  `purchase_return`) and the accounting shapes exist for it.

---

LEGACY COMPATIBILITY CHECK

Inventory
- Existing product/location stock model preserved: stock per (product, variant, location), one variant when none (BR-STK-01).
- Low-stock default = 5 preserved (DEF-023 / BR-STK-04, centralized `lowStockThreshold`).
- Stock shortage behavior preserved: warning + confirm, never a silent hard block (BR-INV-05, BR-STK-06); negative allowed only on override.
- Existing movement concepts preserved: the Phase-3 movement-type enum; append-only, immutable ledger (BR-STK-02).
- Existing adjustment behavior preserved: qty>0, in/out, reason category + note, `adjustment` movement (BR-STK-07).
- Existing transfer behavior preserved: out+in atomic, source ≠ destination (BR-STK-08).
- Existing stock-count behavior preserved: diff recomputed at apply time, zero-diff rejected, corrections as movements (BR-STK-10).

Purchases
- Supplier relationship preserved: supplier required + frozen supplier snapshot (BR-PUR-01).
- Purchase fields preserved: supplier, date, location, supplier bill no, lines (unit/qty/rate/amount), paid/due/notes (no invented fields).
- Tax behavior preserved: purchases carry NO GST (BR-PUR-08) — deliberately different from sales (§10).
- Numbering preserved: purchases are NOT numbered; they use the supplier's bill number (no invented series).
- Payment behavior preserved: paid/outstanding/status via the shared payment-status rule (BR-PAY-02).

Accounting
- Inventory accounting preserved: Dr Inventory on purchase; Cr Inventory via COGS on sale.
- Purchase accounting preserved: Dr Inventory / Cr Cash / Cr AP (BR-PUR-04).
- COGS behavior preserved: Σ purchasePrice×baseQty, purchasePrice snapshot (BR-COGS-01/02); no valuation method invented (§63).
- GST Input behavior preserved: not posted (BR-PUR-08 / OQ-06) — matches the source.
- Payable behavior preserved: uses the Phase-3/5 accounting + payment architecture, no second engine.

Security
- Legacy unsafe behavior NOT reproduced: client-side stock writes replaced by server-authoritative,
  atomic, idempotent callables; balances never mutated without a recorded movement; location isolation
  enforced in rules + functions.

- Deviations (with reason / OQ ref): stock writes are Cloud-Function-only in one transaction (BR-STK-03 [FIX], not per-device); purchase delete is soft-delete + reversal (vs legacy hard delete); COGS/GST-input gaps tracked as OQ-06/OQ-11.
- NOT VERIFIED items touched: ADJ_CATEGORIES exact list (OQ-11), "out" boundary qty≤0 (BR-STK-05) — kept as the Phase-3 defaults; reorder velocity report (BR-STK-13/14) not built this phase (left as a placeholder route).
