# Business Rules

> **Phase 0 deliverable.** Every business rule found in `docs/legacy/TECHNICAL-DOCUMENTATION.md` (TD), stated so it can be implemented and tested. Rules are **preserved behavior** unless marked **[FIX]**, which means the legacy *mechanism* is replaced for a documented safety reason while the business intent is kept.
>
> - All rules that involve money are implemented in **integer paise** (see `DATA-MODEL.md §2`). Legacy rupee tolerances are mapped in `BR-MNY-02`.
> - Every rule that computes something lives **once** in `packages/domain`. It runs **authoritatively in Cloud Functions** and optionally in the client for previews. No screen may re-implement a rule.
> - `NOT VERIFIED` means the TD doesn't state the detail. Don't implement such a detail as a rule until `OPEN-QUESTIONS.md` resolves it.
> - Each rule's ID is the key used in tests: `describe('BR-GST-04', …)`.

---

## 1. Money, rounding and tolerances (MNY)

| ID | Rule | Source |
|---|---|---|
| BR-MNY-01 | All stored monetary values are integer **paise**. Rates are paise per base unit. No floating-point money is persisted. **[FIX]**: legacy used JS floats. | Phase 0 decision |
| BR-MNY-02 | Legacy tolerances map to paise as follows: "effectively zero" (0.004) → exactly 0 paise; journal balance (0.01) → **exact equality**; TB/BS balanced (0.02) → **exact equality**; "still outstanding" (0.5) → **gap > 50 paise**. The 50-paise business threshold is preserved exactly. | TD §6.8 |
| BR-MNY-03 | The grand total of an invoice, quotation or credit note is rounded to the **nearest rupee**. `roundOff = roundedTotal − unroundedTotal` is stored, displayed, printed, and credited/debited to Sales Revenue. | TD §5.2 |
| BR-MNY-04 | Rupee rounding uses half-up at exactly 50 paise (JS `Math.round` on positive values). Paise rounding of each line amount: OQ-05. | TD §5.2 |
| BR-MNY-05 | Amounts are displayed in Indian format (`en-IN`, ₹, lakh/crore grouping). | TD §2.7 |
| BR-MNY-06 | "Amount in words" uses the Indian system: Crore / Lakh / Thousand / Hundred. | TD §2.7 |

## 2. Dates (DAT)

| ID | Rule | Source |
|---|---|---|
| BR-DAT-01 | The Indian financial year starts on **1 April**. The FY label is `YY(start)YY(end)`: April 2026 → `2627`, March 2026 → `2526`. | TD §2.7 |
| BR-DAT-02 | Accepted dates are strict `YYYY-MM-DD` with a year from 1990 to 2200. Anything else is rejected or cleared. | TD §2.7 |
| BR-DAT-03 | Business dates ("today", month boundaries, overdue) are computed in the business timezone. Default is **Asia/Kolkata**, and the server uses the same zone. Legacy used device local time, which is equivalent for the Indian devices it ran on. **[FIX]**: keeps server and clients consistent. | Phase 0 decision |

## 3. GST (GST)

| ID | Rule | Source |
|---|---|---|
| BR-GST-01 | Tax type = **intra** if the seller's state equals the customer's state, **or if either is blank**. Otherwise **inter**. | TD §2.7, §5.2 |
| BR-GST-02 | A bill with no customer selected has a blank buyer state, so it is **intra**. (Follows from BR-GST-01.) | TD §5.2 |
| BR-GST-03 | Line `gross = qty × rate`. `taxable = gross − gross × discountPct / 100`. | TD §5.2 |
| BR-GST-04 | Intra: `cgst = sgst = taxable × gstRate / 2 / 100`. | TD §5.2 |
| BR-GST-05 | Inter: `igst = taxable × gstRate / 100`. CGST and SGST are 0. | TD §5.2 |
| BR-GST-06 | **Invoice only:** when `gstApplicable === false` (Without GST), CGST, SGST and IGST are all 0 and the line total equals taxable. No other document type honors `gstApplicable`. | TD §2.7, §5.2 |
| BR-GST-07 | Pricing is tax-**exclusive**: tax is added on top of the taxable value. | TD §5.2 |
| BR-GST-08 | Allowed GST rates: 0, 0.25, 3, 5, 12, 18, 28, 40 (%). They are stored as basis points (0, 25, 300, 500, 1200, 1800, 2800, 4000). | TD §2.1 |
| BR-GST-09 | A line's GST rate is **snapshotted** from the product when the line is added to the draft. A later change to the product's rate never changes an existing draft or saved line. The server stores the rate submitted with the line (it must be in the allowed list), never the current product rate. | TD §5.2, §9 |
| BR-GST-10 | Quotations always use the full engine (BR-GST-01..05). | TD §2.7, §5.5 |
| BR-GST-11 | Delivery Notes compute **no GST**. The line rate is a reference value only. | TD §5.5 |
| BR-GST-12 | Credit Notes use the **original invoice's stored tax type** (never re-derived). If the original invoice was Without GST, all tax is 0. | TD §5.5 |
| BR-GST-13 | Debit Notes have no GST math: `amount = qty × rate`. | TD §5.5 |
| BR-GST-14 | The seller's state comes from Business Settings. **[FIX]**: the seller state, GSTIN and tax type are snapshotted on the invoice so a later settings change never alters a saved bill. | TD §2.7 |
| BR-GST-15 | The state is derived from a GSTIN's first two digits using the 38-entry GST state-code table. The customer form auto-suggests the state and the business form auto-fills it. | TD §2.7, §3.2, §5.8 |
| BR-GST-16 | GSTINs are trimmed and upper-cased on save. | TD §3.2, §5.1 |
| BR-GST-17 | A blank customer GSTIN means B2C. A non-blank one means B2B. | TD §5.1, §6.5 |
| BR-GST-18 | Suggested product GST rate: `wholesalePrice > 2500 ⇒ 18 %`, else `5 %`. It is a suggestion in the product form only and never enforced. The threshold of 2500 is in rupees. | TD §2.7 |
| BR-GST-19 | Printed item columns: intra shows CGST% / CGST and SGST% / SGST. Inter shows IGST% / IGST. | TD §5.6 |

## 4. Document numbering (NUM)

| ID | Rule | Source |
|---|---|---|
| BR-NUM-01 | There are six independent series: GST Invoice (`INV`), Without-GST Invoice (`NGST`), Quotation (`QUO`), Delivery Note (`DN`), Credit Note (`CN`), Debit Note (`DBN`). Each starts at sequence 1. They are **never combined**. | TD §2.3, §3.2, §5.3 |
| BR-NUM-02 | Format: `PREFIX/<FY label>/<sequence zero-padded to 4>`, e.g. `INV/2627/0001`. Sequences above 9999 print unpadded (standard padStart behavior; NOT VERIFIED). | TD §3.2 |
| BR-NUM-03 | Which date sets the FY label (document date or creation date), and whether the sequence resets each FY, are **NOT VERIFIED** (OQ-03). | — |
| BR-NUM-04 | An invoice with `gstApplicable !== false` takes its number from the INV series. A Without-GST invoice takes it from NGST, so the GST series never skips a number. | TD §5.3 |
| BR-NUM-05 | **[FIX]** A number is assigned by the server in a Firestore transaction when the document is first saved. The transaction increments the counter by exactly 1 and writes a uniqueness reservation for that number. Two devices can never receive the same number. | TD §5.7, §9 |
| BR-NUM-06 | Editing a document never consumes, changes or re-issues a number. | TD §5.3 |
| BR-NUM-07 | An issued number is never reused, including after the document is deleted. The reservation record stays. | TD §5.7 (counters only move forward) |
| BR-NUM-08 | Owner/admin can edit each series' prefix and next sequence in Settings. The server rejects a next sequence whose resulting number is already reserved. | TD §3.2 |
| BR-NUM-09 | A blank or invalid prefix falls back to the default prefix. A sequence that isn't a positive integer falls back to 1 (then subject to BR-NUM-08). | TD §3.2 |
| BR-NUM-10 | The full document number string is stored on the document, so changing a prefix affects future documents only. | TD §3.2 (implied by format) |
| BR-NUM-11 | A failed save (validation error, rejected transaction) does **not** consume a number. | Consequence of BR-NUM-05 |

## 5. New Bill / Invoice (INV)

| ID | Rule | Source |
|---|---|---|
| BR-INV-01 | A New Bill draft opens with **GST mode = Without GST** (`gstApplicable:false`), status `paid` and paid amount 0. | TD §5.2 |
| BR-INV-02 | A stored invoice missing `gstApplicable` is treated as GST-applicable. On save, `gstApplicable = (draft.gstApplicable !== false)`. | TD §5.3 |
| BR-INV-03 | An invoice needs at least 1 line (NOT VERIFIED for invoices; stated for purchases and transfers). Every line must have `qty > 0`. | TD §5.8 |
| BR-INV-04 | Adding a product+variant that is already on the draft increments that line's quantity. | TD §5.2 |
| BR-INV-05 | Stock shortage check: the requested quantity (in base units) is compared with stock at the invoice's location. When editing, the old version's quantity at that location is added back first. A shortage asks for confirmation and doesn't block. | TD §5.8 |
| BR-INV-06 | Credit-limit check: `projected = customerOutstanding − (old unpaid of this bill if editing) + (this bill's grandTotal − paid)`. If `creditLimit > 0` and projected exceeds it, ask for confirmation. It doesn't block. (Whether a limit of 0 means "no limit" is NOT VERIFIED; assumed.) | TD §5.1 |
| BR-INV-07 | On save, each line without `skipStockDeduction` deducts base-unit stock at the invoice location, with a `sale` movement. | TD §4.3, §5.4, §5.5 |
| BR-INV-08 | The invoice stores a frozen `customerSnapshot`. Later customer edits or deletes never change it. | TD §5.1 |
| BR-INV-09 | The invoice is bound to the working location it was created at (`locationId`). | TD §3.4, §5.4 |
| BR-INV-10 | **Edit:** only allowed from the invoice's own location (the user must switch first). A bill from a past month shows a non-blocking warning: "may already have been filed for GST". | TD §5.4, §5.8 |
| BR-INV-11 | **Edit is undo-then-reapply:** reverse the old stock (`sale_reversal`), void the old invoice and COGS journals, then apply the new lines and post new journals. All in one server transaction. | TD §5.4 |
| BR-INV-12 | **Edit never changes the amount received:** `paidAmount` stays at what was already received, and status is re-derived against the new grand total. The amount received changes only through Record Payment. | TD §5.4 |
| BR-INV-13 | **Delete:** restore stock for lines without `skipStockDeduction`; void the invoice, COGS and every payment journal; revert a source quotation to `open` or a source DN to `pending`. Admin/owner only. **[FIX]**: the invoice is soft-deleted and its number stays reserved. | TD §5.4, §3.2.1 |
| BR-INV-14 | `createdBy` (account) is recorded for account-performance reporting. | TD §3.7 |
| BR-INV-15 | Converting from a quotation or DN pre-fills a New Bill draft and links the source (`sourceType`, `sourceId`). The source's status changes only when the invoice is saved successfully. | TD §5.5 |

## 6. Payments and dues (PAY / DUE)

| ID | Rule | Source |
|---|---|---|
| BR-PAY-01 | A recorded payment must be `amount > 0`. If it exceeds `outstanding + 50 paise`, ask for confirmation (a warning, not a block). | TD §3.7, §5.4 |
| BR-PAY-02 | Payment status: `due = grandTotal − paidAmount`. `due ≤ 50 paise` → **Paid**. Otherwise `paidAmount > 0` → **Partial**. Otherwise **Unpaid**. | TD §3.1 |
| BR-PAY-03 | Customer payment journal (`payment_in`): Dr Cash-or-Bank(mode), Cr Accounts Receivable. Supplier payment journal (`payment_out`): Dr Accounts Payable, Cr Cash-or-Bank(mode). | TD §6.1.5 |
| BR-PAY-04 | `cashOrBank(mode)`: `Cash` → `acc-cash`. Every other mode (Bank Transfer, UPI, Cheque, Card, Other) → `acc-bank`. | TD §6.1.6 |
| BR-PAY-05 | Recording a payment increases the parent's `paidAmount`, appends it to the payment history, re-derives status, posts its own journal, logs activity, and can optionally write a Cash Book entry. | TD §3.7 |
| BR-PAY-06 | Payment at billing: `paidNow = min(paidAmount, grandTotal)` is debited to **Cash in Hand** (`acc-cash`) whatever the real mode (OQ-07). | TD §6.1.5 |
| BR-DUE-01 | Customer outstanding = `Σ max(0, grandTotal − paidAmount)` over the customer's invoices. | TD §5.1 |
| BR-DUE-02 | An invoice or purchase is "outstanding" when `grandTotal − paidAmount > 50 paise`. | TD §6.7 |
| BR-DUE-03 | Overdue = outstanding **and** `dueDate` earlier than today. One helper is shared by the notification bell, Dashboard, Customers and Dues. | TD §2.7 |
| BR-DUE-04 | Dues badge: no due date → **No Due Date**; past due → **Overdue**; due within 7 days → **Due Soon**; otherwise **Current**. | TD §6.7 |
| BR-DUE-05 | Customer status priority: **Overdue** > **Over Limit** > **Has Balance** > **Healthy**. | TD §5.1 |
| BR-DUE-06 | Customer ledger: a debit per invoice, a credit for the invoice's initial (at-billing) paid amount, and a credit per later payment. Running balance. For the same date, order is invoice → initial payment → later payments. | TD §5.1 |
| BR-DUE-07 | Payables mirror receivables exactly, over purchases and suppliers. | TD §6.7 |
| BR-DUE-08 | Receivable KPIs: Total Outstanding, Overdue, Due in Next 7 Days, number of customers with dues. | TD §6.7 |

## 7. Quotations (QUO)

| ID | Rule | Source |
|---|---|---|
| BR-QUO-01 | A quotation mirrors an invoice line for line but has no `gstApplicable` and no payment fields. | TD §5.5 |
| BR-QUO-02 | A quotation never affects stock or accounting. | TD §5.5 |
| BR-QUO-03 | Status goes `open` → `converted` when an invoice created from it is saved. It goes back to `open` if that invoice is deleted. | TD §5.5 |
| BR-QUO-04 | Converting copies the lines into a fresh New Bill draft. | TD §5.5 |

## 8. Delivery Notes (DN)

| ID | Rule | Source |
|---|---|---|
| BR-DN-01 | Stock is deducted immediately on DN save (`delivery_out`) at the DN's location. | TD §5.5 |
| BR-DN-02 | There is no GST on a DN. Line rates are reference values. | TD §5.5 |
| BR-DN-03 | Lifecycle is `pending` → `invoiced` or `returned`. Only a **pending** DN can be edited, converted or marked returned. | TD §5.5 |
| BR-DN-04 | Converting creates invoice lines with `skipStockDeduction:true` (stock already left) and marks the DN `invoiced` when the invoice is saved. | TD §5.5 |
| BR-DN-05 | Marking a DN returned restores its stock (`delivery_return`) and sets it to `returned`. | TD §5.5 |
| BR-DN-06 | Deleting the invoice that was converted from a DN sets the DN back to `pending`. The DN's stock stays out, because it was never deducted by the invoice. | TD §5.4 |
| BR-DN-07 | Stock shortage on a DN asks for confirmation, the same as invoices (BR-INV-05). | TD §5.8 |
| BR-DN-08 | The DN PDF footer reads: "Goods dispatched under this delivery note. Not a tax invoice." | TD §3.6 |
| BR-DN-09 | No journal entry is posted for a DN (none documented). | TD §5.5, §6.1.5 |

## 9. Credit Notes (CN)

| ID | Rule | Source |
|---|---|---|
| BR-CN-01 | A credit note is issued against an existing invoice. Each line's credited quantity is clamped to `[0, originalQty − alreadyCreditedQty]`. | TD §3.7, §5.5 |
| BR-CN-02 | Tax uses the original invoice's tax type. Tax is 0 if the original was Without GST (BR-GST-12). | TD §5.5 |
| BR-CN-03 | Journal (`credit_note`): Dr Sales Revenue (taxable), Dr GST Output Payable (tax, if any), Cr Accounts Receivable (total). | TD §5.5, §6.1.5 |
| BR-CN-04 | If `restock` is checked: a `sale_return` stock movement, plus journal `credit_note_cogs`: Dr Inventory / Cr COGS. If not checked (a price correction), stock and COGS are untouched. | TD §5.5 |
| BR-CN-05 | GST Filing: the period's credit notes reduce net taxable and net tax, and are exported as CDNR. | TD §6.5 |
| BR-CN-06 | Rounding and round-off on credit notes: NOT VERIFIED (OQ-11). | — |

## 10. Debit Notes (DBN)

| ID | Rule | Source |
|---|---|---|
| BR-DBN-01 | A debit note is issued against an existing purchase. Quantity is capped as in BR-CN-01. | TD §5.5 |
| BR-DBN-02 | `amount = qty × rate`. No GST. | TD §5.5 |
| BR-DBN-03 | Journal (`debit_note`): Dr Accounts Payable / Cr Inventory. | TD §6.1.5 |
| BR-DBN-04 | If `restock` is checked, the units are removed from stock with a `purchase_return` movement. | TD §5.5 |

## 11. Purchases (PUR)

| ID | Rule | Source |
|---|---|---|
| BR-PUR-01 | Supplier required. At least 1 item. Every `qty > 0`. | TD §4.6 |
| BR-PUR-02 | Entered qty/unit is converted to base units with the product's alternate-unit factor. | TD §4.6 |
| BR-PUR-03 | Stock is added at the **current working location** (a `purchase` movement that notes the original unit if it wasn't the base unit). | TD §4.6 |
| BR-PUR-04 | Journal (`purchase`): Dr Inventory (total), Cr Cash (paid now), Cr Accounts Payable (remainder). | TD §6.1.5 |
| BR-PUR-05 | A product's `purchasePrice` is updated from a purchase line **only** when that line is in the base unit. | TD §4.6 |
| BR-PUR-06 | Delete: confirmation names the location whose stock will reverse and warns separately if payments will reverse. Then `purchase_reversal` movements, and the purchase journal and every payment journal are voided. | TD §4.6 |
| BR-PUR-07 | A new purchase draft starts as status `unpaid`, with paid amount and due date blank. | TD §4.6 |
| BR-PUR-08 | Purchase GST / input tax credit is **not documented**. `acc-gst-input` exists but no documented posting uses it (OQ-06). | TD §6.1.1, §6.1.5 |

## 12. Stock (STK)

| ID | Rule | Source |
|---|---|---|
| BR-STK-01 | Stock is held per **(product, variant, location)**. A product without variants still has exactly one variant. | TD §4.1 |
| BR-STK-02 | Every stock change creates a stock movement. Movements are **immutable** and append-only: never updated or deleted by anyone. | TD §4.3, §3.2.1 |
| BR-STK-03 | **[FIX]** Stock levels and movements are written only by Cloud Functions, in the same transaction as the business document that caused them. | Phase 0 (spec §21) |
| BR-STK-04 | Low stock: `qty ≤ threshold`, where `threshold = product.lowStockThreshold > 0 ? product.lowStockThreshold : 5`. This one helper is used by Dashboard, notifications, the Products list and reorder. | TD §2.7, §4.1 |
| BR-STK-05 | Product stock-status bucket at the working location: **out** / **low** / **healthy**. The boundary for "out" (`qty ≤ 0`) is NOT VERIFIED. | TD §4.1 |
| BR-STK-06 | Negative stock is allowed only after an explicit override confirmation (sale, DN, transfer, adjustment). | TD §3.7, §4.2, §5.8 |
| BR-STK-07 | Manual adjustment: `qty > 0`, direction in/out, reason category (`ADJ_CATEGORIES`) and a note. Ask for confirmation before going negative. Creates an `adjustment` movement. | TD §3.7 |
| BR-STK-08 | Transfer: destination required; source ≠ destination; at least 1 item; `qty > 0`. Shortages are listed in one confirmation. Creates `transfer_out` at the source and `transfer_in` at the destination, both referencing the transfer id. It is atomic. | TD §4.2 |
| BR-STK-09 | The transfer source follows the working location **only while the draft has no items**. | TD §4.2 |
| BR-STK-10 | Physical count: diff the counted quantity against system stock. A count with zero differences is rejected. Confirmation names the number of changes. Stock is set to the counted quantity with `adjustment`/`correction` movements, and a summary record is kept. **[FIX]**: the diff is recomputed against live stock at apply time. | TD §4.7 |
| BR-STK-11 | Product form stock edits affect **the working location only**. New variant with stock > 0 → `opening`. Changed quantity → `adjustment` ("Manual correction via Products form at <location>"). Removing a variant that has stock → negative `adjustment` for its total. | TD §4.1 |
| BR-STK-12 | "Wastage/Shrinkage this month" = Σ over this month's `wastage` movements of `qty × purchasePrice`. | TD §4.3 |
| BR-STK-13 | Reorder: over the selected history window, `dailyVelocity = unitsSold / windowDays`, `daysLeft = stock / dailyVelocity`, `suggestedQty = max(0, ceil(dailyVelocity × targetDays − stock))`. Show a row if it had any sale or stock ≤ 5. Mark it urgent when `daysLeft < thresholdDays`. | TD §4.7 |
| BR-STK-14 | Reorder also checks warehouse-type locations' stock of the same variant and recommends a transfer before a purchase. | TD §4.7 |
| BR-STK-15 | A quick-added product's opening stock > 0 creates an `opening` movement. | TD §4.1 |

## 13. Products and barcodes (PRD / BAR)

| ID | Rule | Source |
|---|---|---|
| BR-PRD-01 | Save validation, in this order: name required → barcode unique (case-insensitive) → at least 1 variant → no duplicate (size, color) when `hasVariants` → alt units de-duplicated, non-empty name, `factor > 0`, name ≠ base unit. | TD §4.1 |
| BR-PRD-02 | Quick add: duplicate barcode rejected, `price > 0`, product added straight to the current sale. | TD §4.1 |
| BR-PRD-03 | Deleting a product never alters past documents. **[FIX]**: soft delete. Admin/owner only. | TD §4.1, §3.2.1 |
| BR-PRD-04 | Product search at billing matches name, barcode or variant barcode, returning at most 8 results. | TD §4.7 |
| BR-PRD-05 | Product list filters: text (name/category/HSN/barcode), category, stock-status bucket. | TD §4.1 |
| BR-BAR-01 | Barcode value: base = the product's `barcode` trimmed and upper-cased, or else the last 8 characters of the product id. If a variant is given and `hasVariants`, append the size+color with non-alphanumerics stripped and upper-cased, or else the last 4 characters of the variant id. | TD §4.4 |
| BR-BAR-02 | Migrated products and variants **keep their legacy ids**, so id-derived barcodes on labels already printed still scan. | Consequence of BR-BAR-01 |
| BR-BAR-03 | Barcode labels are CODE128, 4 × 10 per A4. If rendering throws, strip non-alphanumerics and retry, then fall back to `NA`. | TD §4.4 |
| BR-BAR-04 | Scan or typed-code lookup is an exact match. A camera scan that doesn't match keeps the scanner open. | TD §4.4 |

## 14. Customers and suppliers (CUS)

| ID | Rule | Source |
|---|---|---|
| BR-CUS-01 | A quick-added customer's state defaults to the business state. | TD §5.1 |
| BR-CUS-02 | Deleting a customer never alters invoices (the snapshot is kept). **[FIX]**: soft delete. Admin/owner only. | TD §5.1, §3.2.1 |
| BR-CUS-03 | Deleting a supplier is admin/owner only. A permission error shows "needs owner/admin role". | TD §4.5 |

## 15. Accounting (ACC)

| ID | Rule | Source |
|---|---|---|
| BR-ACC-01 | A journal entry is posted only if `Σ debit = Σ credit`. In paise this is exact equality. Otherwise it is refused and nothing is written, and neither is the business document. | TD §6.1.4 |
| BR-ACC-02 | Lines where both debit and credit are 0 are dropped. If no lines remain, no entry is posted (and that isn't an error). | TD §6.1.4 |
| BR-ACC-03 | A journal line has either a debit or a credit, never both. Both are non-negative. | TD §6.1.3 (implied) |
| BR-ACC-04 | **Only** the server posting service writes journal entries. No client writes. | TD §6.1.4; **[FIX]** server-side |
| BR-ACC-05 | Edits and deletes reverse by **voiding** every entry for `(refType, refId)` and posting fresh ones. Voided entries are excluded from all balances and statements, so reports look exactly as they would under legacy delete-and-repost. **[FIX]**: voided entries are kept for audit. | TD §6.1.4 |
| BR-ACC-06 | Account balance: debit-normal (asset, expense) = Σdr − Σcr; credit-normal (liability, equity, income) = Σcr − Σdr. | TD §6.1.7 |
| BR-ACC-07 | Statements are derived only from accounts and non-voided journal entries. No separately stored statement data is authoritative. | TD §6.2 |
| BR-ACC-08 | Invoice journal (`invoice`): Dr Cash (at-billing paid), Dr AR (remainder), Cr Sales Revenue (`subtotal + roundOff`), Cr GST Output Payable (total tax). | TD §6.1.5 |
| BR-ACC-09 | When an invoice is re-posted after an edit, its own entry books only the **at-billing** paid amount. Payments recorded later keep their own `payment_in` entries and are never counted twice. | TD §5.4 |
| BR-ACC-10 | Expense (`expense`): Dr the category's expense account, Cr Cash-or-Bank(mode). An edit voids the old entry and re-posts. | TD §6.1.5 |
| BR-ACC-11 | Payroll (`payroll`) and staff payments (`staffpayroll`): Dr Staff Commission or Staff Salary/Wages (by type), Cr Cash-or-Bank(mode). | TD §6.1.5 |
| BR-ACC-12 | A journal entry carries the `date` and `locationId` of its source document. | TD §6.1.3 |
| BR-ACC-13 | Trial Balance: all-time, all locations. Shows "Balanced ✓" when total debits equal total credits. Anything else is a critical integrity alert. | TD §6.2 |
| BR-ACC-14 | P&L: Income − COGS = Gross Profit. Gross Profit − all other expense accounts = Net Profit, coloured green or red by sign. Defaults to month-to-date. | TD §6.2 |
| BR-ACC-15 | Balance Sheet as of a date: Assets, Liabilities, and Equity + Retained Earnings, where Retained Earnings = cumulative income − expense up to that date. | TD §6.2 |
| BR-ACC-16 | General Ledger: per-account running balance, sorted by date then createdAt. | TD §6.2 |
| BR-ACC-17 | System accounts can't be deleted. No account can be deleted once any (non-voided or voided) entry references it. | TD §6.1.1, §6.1.8 |
| BR-ACC-18 | Custom account: duplicate name (case-insensitive) rejected. A blank code becomes (max code of the same type + 10). | TD §6.1.1, §6.1.8 |
| BR-ACC-19 | Each expense category automatically gets an expense account: id `acc-<slug>`, code starting at 5100 in steps of 10, linked by `expenseCategoryId`. | TD §6.1.1, §6.1.2 |
| BR-ACC-20 | Shop Comparison per location, from the ledger: sales = Sales Revenue balance in range; COGS likewise; gross = sales − COGS; expenses = all expense accounts except COGS; net = gross − expenses. Bill count comes from invoices. | TD §3.5 |
| BR-ACC-21 | Financial statements and GST Filing aggregate **all locations** (legacy parity). | TD §6.8 |
| BR-COGS-01 | Every invoice save also posts `invoice_cogs`: Dr COGS / Cr Inventory for `Σ unitCost × baseQty`. Skipped when the total is 0. It is voided and re-posted with the invoice. | TD §5.8, §6.1.5 |
| BR-COGS-02 | `unitCost` is the product's `purchasePrice` when the invoice is saved. **[FIX]**: it is snapshotted on the line, so voids and re-posts are reproducible. | TD §5.8 |
| BR-COGS-03 | Whether lines with `skipStockDeduction` (from a DN) post COGS, and which unit cost a CN restock uses, are NOT VERIFIED (OQ-11). | — |

## 16. Expenses (EXP)

| ID | Rule | Source |
|---|---|---|
| BR-EXP-01 | `amount > 0` and a category are required. | TD §6.4 |
| BR-EXP-02 | The expense stores its category name as a snapshot. Deleting a category never rewrites past expenses. | TD §6.1.8 |
| BR-EXP-03 | Expense views are scoped to the working location. KPIs: Today, Last 7 Days, This Month, and Net This Month (the location's month sales − month expenses). There is a 14-bucket trend and an all-time By Category breakdown. | TD §6.4 |
| BR-EXP-04 | Default categories are listed in DEF-033. Category ids are `exp-cat-<slug>`. | TD §6.1.2 |

## 17. Cash Book (CASH)

| ID | Rule | Source |
|---|---|---|
| BR-CASH-01 | A Cash Book entry is `type in/out`, `amount > 0`, with a category from the in or out list (DEF-038/039), a payment mode, a reference and notes. | TD §6.3 |
| BR-CASH-02 | Cash Book entries **never** post to the journal. | TD §6.3 |
| BR-CASH-03 | Cash balance at a location = that location's `openingCashBalance` + all-time Σin − Σout. There is no combined all-locations cash balance. | TD §6.3 |
| BR-CASH-04 | Payment recording and payroll can optionally write a matching Cash Book entry. It is a separate record that doesn't affect the books. | TD §3.7, §6.6 |

## 18. Payroll (PRL)

| ID | Rule | Source |
|---|---|---|
| BR-PRL-01 | Shop payroll is keyed by **location** (the legacy field `userId` holds a location id). Its type selects the expense account. | TD §6.6 |
| BR-PRL-02 | There is no automatic commission. The screen shows the location's sales in the range (`Σ grandTotal` of invoices whose `locationId` matches), and the user types the amount. | TD §3.4, §6.6 |
| BR-PRL-03 | Named staff payments post exactly like shop payroll, under their own refType, so the two never double-count. | TD §6.6 |
| BR-PRL-04 | Deleting a staff member who has payment history warns that history is kept, and recommends **Inactive** instead. | TD §6.6 |

## 19. Reports and dashboard (RPT)

| ID | Rule | Source |
|---|---|---|
| BR-RPT-01 | Dashboard Today's Sales and Month Sales are totalled across **all locations**. "vs yesterday %" is shown only when yesterday's sales > 0. | TD §3.1 |
| BR-RPT-02 | Dashboard Outstanding Dues are totalled across all locations, with the number of customers whose gap > 50 paise. | TD §3.1 |
| BR-RPT-03 | Dashboard Low Stock counts the variants at the **working location** with `qty ≤ threshold`. | TD §3.1 |
| BR-RPT-04 | Sales Reports cover the working location only. They group by day, week or month over the last 14 periods, with Top Products and Top Customers from invoice lines and account performance by `createdBy`. | TD §3.7 |
| BR-RPT-05 | GST Filing is monthly. Without-GST invoices are listed separately and excluded from taxable totals and every GST export. Taxable invoices split into B2B and B2C. Tax amounts are **summed from the stored per-invoice fields**, never recalculated. | TD §6.5, §3.7 |
| BR-RPT-06 | HSN summary: group lines by `hsn | gstRate`. | TD §6.5 |
| BR-RPT-07 | Filing readiness: business GSTIN set; each B2B GSTIN matches the 15-character pattern; no taxable line without an HSN. Always labelled "not a substitute for review by a CA". | TD §6.5 |
| BR-RPT-08 | Global search: case-insensitive substring over products, customers, invoices, quotations and purchases. At most 5 results per category. | TD §2.7 |
| BR-RPT-09 | Recent invoices on the Dashboard: top 4 by date, newest first. **[FIX]**: a true date + createdAt sort. | TD §3.1 |

## 20. Locations (LOC)

| ID | Rule | Source |
|---|---|---|
| BR-LOC-01 | At least one active location always exists. Deleting or archiving the last one is refused. | TD §4.2, §4.5 |
| BR-LOC-02 | Deleting a location that has stock is warned about but allowed. **[FIX]**: it is archived, not hard-deleted. | TD §4.2 |
| BR-LOC-03 | A location-restricted member can work only at their allowed location(s). **[FIX]**: enforced by rules and functions, and fails closed. | TD §2.4, §4.7 |
| BR-LOC-04 | Documents are edited only from their own location (BR-INV-10). The same applies to DNs and other location-bound documents. | TD §5.8 |
| BR-LOC-05 | Sales, DNs, purchases, adjustments and counts act on the **working location**. | TD §4.6, §4.7, §5.8 |
| BR-LOC-06 | Legacy seed locations keep their fixed ids during migration. | TD §4.2 |

## 21. Permissions (PRM)

| ID | Rule | Source |
|---|---|---|
| BR-PRM-01 | Only members with `active: true` get access. | TD §2.4 |
| BR-PRM-02 | Owner and admin have full access. | TD §2.4 |
| BR-PRM-03 | Non-admins can **never** access Settings, Users/Members or Locations management. | TD §2.4 |
| BR-PRM-04 | A shop account gets the default shop permission set unless its membership lists explicit grants. Accounting, Cash Book, Expenses, Dues and GST Filing are never in the default set. | TD §2.4 |
| BR-PRM-05 | Deleting customers, suppliers, products or invoices needs owner or admin. | TD §3.2.1 |
| BR-PRM-06 | Nobody (including the owner) can update or delete stock movements. | TD §3.2.1 |
| BR-PRM-07 | A member can't change their own membership. An admin can change other members'. | TD §3.2.1 |
| BR-PRM-08 | A restored session older than 30 days since the last interactive sign-in must sign in again. **[FIX]**: also enforced server-side. | TD §2.4 |
| BR-PRM-09 | **[FIX]** Every permission is enforced server-side (rules and functions). The UI only hides what the server would reject anyway. | TD §9 |

## 22. Backup, restore and administration (BAK / ADM)

| ID | Rule | Source |
|---|---|---|
| BR-BAK-01 | A full backup contains every persisted business collection, plus `schemaVersion`, `appVersion` (the real version), `businessId`, `createdAt`, `createdBy`, record counts and a SHA-256 checksum. **[FIX]**: the legacy file had a stale version stamp. | TD §3.2 |
| BR-BAK-02 | Backup is owner/admin only. The file name follows `wholesale-ledger-backup-<date>.json`. | TD §3.2 |
| BR-BAK-03 | Restore requires the `restore.execute` permission (owner and admin by default, which is legacy parity since both could open Settings; narrowing to owner-only is OQ-02), needs a recent re-authentication, validates against the schema, transforms by version, shows a dry-run summary, takes an automatic pre-restore backup, runs server-side, and is audited. | Spec §27; TD §3.2 |
| BR-BAK-04 | A single collection registry drives backup, restore and reset, so no collection can be silently missed. **[FIX]**: legacy kept three separate lists. | TD §3.7 |
| BR-BAK-05 | Restore never silently merges into or overwrites live data. The target semantics are OQ-20. | Spec §27 |
| BR-ADM-01 | Saving settings logs `settings_updated`. | TD §3.2 |
| BR-ADM-02 | If the business name is empty, every screen except Settings shows a non-blocking warning. If the name or state is missing, the Dashboard shows a setup banner. | TD §2.7, §3.1 |
| BR-ADM-03 | Reset All Data requires the `data.reset` permission (owner and admin by default, legacy parity; OQ-02), needs double or typed confirmation, and lists exactly what will be wiped. It never deletes auth accounts or memberships. Categories, locations and chart of accounts are re-seeded. Stock movements are archived under the reset id, never hard-deleted. A backup is taken first automatically. | TD §3.2 |
| BR-ADM-04 | **[FIX]** Activity log entries are written by the server and are immutable. Login and logout are logged. | TD §2.4, §3.4 |

---

## Rule count

| Domain | Count |
|---|---|
| MNY | 6 |
| DAT | 3 |
| GST | 19 |
| NUM | 11 |
| INV | 15 |
| PAY / DUE | 6 / 8 |
| QUO | 4 |
| DN | 9 |
| CN | 6 |
| DBN | 4 |
| PUR | 8 |
| STK | 15 |
| PRD / BAR | 5 / 4 |
| CUS | 3 |
| ACC / COGS | 21 / 3 |
| EXP | 4 |
| CASH | 4 |
| PRL | 4 |
| RPT | 9 |
| LOC | 6 |
| PRM | 9 |
| BAK / ADM | 5 / 4 |
| **Total** | **195** |

---

## Phase 3 — implemented, tested rule engines

The following rules are now implemented as pure, tested functions in `@hynish/domain` (the single
source reused by the client and Cloud Functions):

| Rules | Implementation | Tests |
|---|---|---|
| BR-MNY-* (money, paise, round-off) | `money.ts` (`Money.*`, `roundHalfUp`) | `money.test.ts` |
| BR-DAT-* (FY label, business dates, timezone) | `fy.ts`, `dates.ts` | `fy.test.ts` |
| BR-GST-01..06, 18 (tax type, line math, totals, suggestion) | `gst.ts` | `gst.test.ts` |
| BR-NUM-01/02/09 (format, series, fallback) + KL-01 fix | `numbering.ts`, `functions/numbering` | `numbering.test.ts`, `numbering.emu.test.ts` |
| BR-ACC-01/02/03/06 (journal invariant, chart, normal side, cash/bank) | `accounting.ts` | `accounting.test.ts` |
| BR-STK-04/05/06 (low stock 5, status, shortage-as-warning), units | `inventory.ts` | `inventory.test.ts` |
| Legacy defaults (§54/§55) + theme migration | `legacy-defaults.ts` | `legacy-defaults.test.ts` |

Server-authoritative posting rules (BR-ACC-04/05 postJournal, BR-STK-03 stock writes,
BR-INV/PAY workflows) have their contracts defined (`AccountingService`, `InventoryService`,
`DocumentNumberService`) and are implemented per module in later phases.
