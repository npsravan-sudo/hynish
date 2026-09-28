# Data Model

> **Phase 0 deliverable.** The proposed production Firestore data model for the rebuild. It replaces the legacy single `businesses/{code}/data/main` document and the ad-hoc realtime collections (TD §7) with typed per-record collections. Every write that changes stock, accounting, numbering or money goes through Cloud Functions.
>
> Types below are TypeScript. They become Zod schemas in `packages/domain/src/schemas/*`, and the TS types are inferred from those schemas (`z.infer`). That package is the one source for client, functions and migration.

---

## 1. Principles

1. **Business isolation:** every business record lives under `businesses/{businessId}/…`. No business data is stored at the top level except the `users/{uid}` profile.
2. **One record per document.** A document's lines (invoice lines, purchase lines, …) are embedded arrays, because they are always read and written atomically with their header and are bounded (≤ 500 lines, §15).
3. **References, not uncontrolled copies.** Documents reference `customerId`, `productId`, `locationId`, and so on. The only copies are **deliberate historical snapshots** that legacy behavior requires: `customerSnapshot` (TD §5.1), line `gstRateBp` (TD §5.2), line name/HSN/unit/code, `unitCostPaise` for COGS, and the seller snapshot. Snapshots are named `*Snapshot` or documented per field.
4. **Server-owned fields:** numbers, totals, tax, stock levels, balances, statuses, `createdAt/By` and `updatedAt/By` are written only by Cloud Functions or enforced by rules. The client submits *intent* (lines, customer, confirmations). The server computes the results.
5. **Soft delete:** records that can be deleted get `deletedAt`/`deletedBy` (a tombstone). This fixes the legacy resurrection bug class (TD §7.3). Queries filter `deletedAt == null`. Hard deletes happen only in controlled admin jobs.
6. **Immutability:** `stockMovements`, `activityLog`, `documentNumbers` and journal entry lines never change after creation. Journal entries may only move from `posted` to `voided`.
7. **Schema versioning:** every document carries `schemaVersion: number` so readers and migrations can transform old shapes.

---

## 2. Money representation (decision)

| Aspect | Decision |
|---|---|
| Stored money | **Integer paise** (`number`, always `Number.isSafeInteger`). Field names end in `Paise`: `ratePaise`, `grandTotalPaise`. |
| Why | Legacy used JS floats with tolerances of 0.004/0.01/0.02/0.5 (TD §6.8) to hide floating-point drift. Integers make debit = credit **exact** and make totals reproducible between client preview, server and reports. |
| Max value | `Number.MAX_SAFE_INTEGER` paise ≈ ₹90 trillion, far above any realistic value. |
| Rates | Paise per **base unit** (`ratePaise`). |
| Percentages | Integer **basis points**: `gstRateBp` (5 % = 500, 0.25 % = 25) and `discountBp` (12.5 % = 1250). Discounts with more than 2 decimal places are not supported (legacy precision NOT VERIFIED). |
| Rounding helper | `roundHalfUp(numerator, denominator)` using integer/BigInt math in `packages/domain/money.ts`. Nothing else may round money. |
| Line math | Defined in `BUSINESS-RULES.md` BR-GST-03..06, applied in paise. Rounding granularity per line: **OQ-05** (recommended: round `taxable`, `cgst`, `sgst` and `igst` to the paise per line; CGST and SGST are each computed as `round(taxable × rate / 2)` so they are always equal). |
| Grand total | Sum of line totals, rounded to the nearest 100 paise (₹1). `roundOffPaise` is between −50 and +50 (BR-MNY-03). |
| Tolerances | Mapped per BR-MNY-02: the outstanding threshold is `> 50` paise, and balance checks are exact. |
| Display | `formatINR(paise)` → `₹1,23,456.78` (en-IN). |
| Legacy conversion | `paise = Math.round(rupees × 100)`, done at migration with a per-document reconciliation report (MIGRATION-PLAN §6). |

## 3. Other primitive conventions

| Concept | Representation |
|---|---|
| Quantity | `number` with **at most 3 decimals**, normalized by `normalizeQty()`. Needed because the units include `Mtr` and `Kg`, and alternate-unit factors can be fractional. Stock is always stored in **base units**. |
| Business date | `'YYYY-MM-DD'` string in the business timezone (default `Asia/Kolkata`), years 1990–2200 (BR-DAT-02). Used for `date`, `dueDate` and range filters. |
| Instant | Firestore `Timestamp`, set by `serverTimestamp()` on the server (`createdAt`, `updatedAt`, `deletedAt`). |
| FY label | `'2627'` string (BR-DAT-01), stored on numbered documents as `fy`. |
| IDs | New records use Firestore auto-ids. **Migrated records keep their legacy ids** (needed for barcodes, BR-BAR-02, and for deterministic seed ids such as `loc-hynish-wh`, `acc-cash` and `exp-cat-rent`). |
| State | `stateCode: '29'` (2-digit GST code) plus a display name from the domain table. Legacy stored names, and the migration maps them (MIGRATION-PLAN §5). |
| Enums | TS string-literal unions exported from `packages/domain/constants.ts`. No magic strings in features. |

---

## 4. Firestore layout

```
users/{uid}                                   UserProfile (preferences, business list)
businesses/{businessId}                       Business
  members/{uid}                               Member
  settings/business                           BusinessSettings (identity, bank, prefixes)
  settings/integrations                       IntegrationSettings (non-secret WhatsApp fields)
  counters/{seriesKey}                        Counter                (server only)
  documentNumbers/{seriesKey}__{numberKey}    NumberReservation      (server only)
  locations/{locationId}                      Location
  products/{productId}                        Product (+ embedded variants)
  barcodes/{normalizedCode}                   BarcodeIndex           (server only)
  stockLevels/{productId}__{variantId}__{locationId}  StockLevel     (server only)
  stockMovements/{movementId}                 StockMovement          (server only, immutable)
  stockTransfers/{transferId}                 StockTransfer          (server only)
  stockCounts/{countId}                       StockCount             (server only)
  customers/{customerId}                      Customer
  suppliers/{supplierId}                      Supplier
  invoices/{invoiceId}                        Invoice (+ embedded InvoiceLine[])     (server only)
  quotations/{quotationId}                    Quotation                              (server only)
  deliveryNotes/{dnId}                        DeliveryNote                           (server only)
  creditNotes/{cnId}                          CreditNote                             (server only)
  debitNotes/{dbnId}                          DebitNote                              (server only)
  purchases/{purchaseId}                      Purchase (+ embedded PurchaseLine[])   (server only)
  payments/{paymentId}                        Payment                                (server only)
  expenseCategories/{categoryId}              ExpenseCategory                        (server only)
  expenses/{expenseId}                        Expense                                (server only)
  cashEntries/{entryId}                       CashEntry                              (server only)
  accounts/{accountId}                        Account                                (server only)
  journalEntries/{entryId}                    JournalEntry                           (server only)
  ledgerMonthly/{yyyymm}__{accountId}__{locationId}   LedgerBucket      (server only)
  salesDaily/{yyyy-mm-dd}__{locationId}       SalesDaily aggregate                   (server only)
  payrollEntries/{entryId}                    PayrollEntry                           (server only)
  staff/{staffId}                             Staff
  staffPayments/{paymentId}                   StaffPayment                           (server only)
  whatsappCampaigns/{campaignId}              WhatsappCampaign (drafts)
  activityLog/{entryId}                       ActivityLog                            (server only, immutable)
  backups/{backupId}                          BackupRecord (metadata; file in Storage)
  restoreJobs/{jobId}                         RestoreJob                             (server only)
  idempotency/{requestId}                     IdempotencyRecord                      (server only, TTL)
```

"Server only" means Firestore rules deny all client writes. The client may **read** those collections, subject to membership, permission and location rules (SECURITY §7).

Storage layout:

```
businesses/{businessId}/branding/logo.jpg
businesses/{businessId}/products/{productId}/{imageId}.jpg
businesses/{businessId}/backups/{backupId}.json.gz     (server only)
```

---

## 5. Common base

```ts
interface AuditFields {
  createdAt: Timestamp;  createdBy: string;   // uid
  updatedAt: Timestamp;  updatedBy: string;   // uid
  schemaVersion: number;
}
interface SoftDelete {
  deletedAt: Timestamp | null;  deletedBy: string | null;
}
interface BusinessScoped { id: string; businessId: string; }
type Entity = BusinessScoped & AuditFields;
```

`businessId` is stored in every document even though the path implies it. This lets collection-group queries, backups and rule assertions (`resource.data.businessId == businessId`) work without parsing the path.

---

## 6. Entities

### 6.1 UserProfile — `users/{uid}`
```ts
interface UserProfile {
  uid: string; email: string; displayName: string | null;
  businessIds: string[];              // maintained by functions from memberships
  defaultBusinessId: string | null;
  preferences: { theme: 'light' | 'dark' | 'system' };   // LC-2.4, UI-UX §3.4
  createdAt: Timestamp; updatedAt: Timestamp;
}
```
Writable by the user only for `preferences` and `defaultBusinessId` (rules enforce the allowed fields).

### 6.2 Business — `businesses/{businessId}`
```ts
interface Business extends AuditFields {
  id: string; name: string; ownerUid: string;
  status: 'active' | 'suspended';
  timezone: 'Asia/Kolkata' | string;          // BR-DAT-03
  legacyBusinessCode: string | null;          // 'hh-erp-2026' for the migrated tenant
  currentSchemaVersion: number;
}
```

### 6.3 Member — `businesses/{b}/members/{uid}`
```ts
type Role = 'owner' | 'admin' | 'shop' /* + 'manager' | 'accountant' | 'staff' pending OQ-02 */;
interface Member extends Entity {
  uid: string; email: string; displayName: string | null;
  role: Role;
  active: boolean;                             // BR-PRM-01
  locationIds: string[] | null;                // null = unrestricted (admins); [] = no access (fail closed)
  permissionOverrides: Partial<Record<Permission, boolean>> | null;  // legacy `tabs` (LC-5.1)
  lastInteractiveSignInAt: Timestamp | null;   // BR-PRM-08
  legacyLocationName: string | null;           // audit trail of the migrated free-text value
}
```
`Permission` is defined in SECURITY §5.

### 6.4 Settings — `businesses/{b}/settings/business`
```ts
type SeriesKey = 'invoice_gst' | 'invoice_nogst' | 'quotation' | 'delivery_note' | 'credit_note' | 'debit_note';
interface BusinessSettings extends Entity {
  businessName: string; gstin: string; address: string; city: string;
  stateCode: string; pincode: string; phone: string; email: string;
  logoPath: string | null;                       // Storage path (LC-47.1)
  licenseKey: string;                            // LC-2.1, OQ-26
  bank: { bankName: string; accountNumber: string; ifsc: string };   // LC-2.3
  prefixes: Record<SeriesKey, string>;           // defaults DEF-001..011
}
```
The next sequence values are **not** stored here. They live in `counters/{seriesKey}` and are shown and edited through the `settings.updateNumbering` callable (BR-NUM-08). Theme is a user preference (§6.1), not a business setting.

`settings/integrations`: `{ whatsapp: { provider, phoneNumberId, businessAccountId, notes, hasApiKey: boolean } }`. The API key itself is stored in Secret Manager (SECURITY §9).

### 6.5 Counter and NumberReservation (server only)
```ts
interface Counter { seriesKey: SeriesKey; nextSeq: number; updatedAt: Timestamp; updatedBy: string;
                    fyScoped: boolean; fy: string | null; }        // fy fields used only if OQ-03 = reset per FY
interface NumberReservation { seriesKey: SeriesKey; number: string; fy: string; seq: number;
                              docType: DocType; docId: string; issuedAt: Timestamp; issuedBy: string; }
```
`numberKey` = the number with `/` replaced by `_` (for example `INV_2627_0001`). Reservations are never deleted (BR-NUM-07).

### 6.6 Location — `businesses/{b}/locations/{locationId}`
```ts
interface Location extends Entity, SoftDelete {
  name: string; type: 'shop' | 'warehouse'; address: string;
  openingCashBalancePaise: number; isDefault: boolean; sortOrder: number;
}
```

### 6.7 Product and Variant — `businesses/{b}/products/{productId}`
```ts
type Unit = 'Pcs' | 'Set' | 'Pair' | 'Mtr' | 'Kg' | 'Box' | 'Dozen';
interface AltUnit { name: string; factor: number }               // base units per alt unit, > 0
interface Variant {
  id: string;                                                   // 'default' for non-variant products
  size: string; color: string;
  barcodeOverride: string | null;                              // NOT VERIFIED in legacy; null
  active: boolean;
}
interface Product extends Entity, SoftDelete {
  name: string; nameLower: string; category: string; hsn: string;
  wholesalePricePaise: number; purchasePricePaise: number;
  gstRateBp: GstRateBp;                                         // BR-GST-08
  unit: Unit; altUnits: AltUnit[];
  barcode: string;                                              // normalized upper-case; '' if none
  lowStockThreshold: number | null;                             // null/0 → 5 (BR-STK-04)
  hasVariants: boolean; variants: Variant[];                    // ≥ 1
  imagePath: string | null;
  searchTokens: string[];                                       // for global search (ARCHITECTURE §8.4)
}
```
Stock is **not** stored on the product (legacy `stockByLocation` moves to `stockLevels`).

### 6.8 StockLevel — `stockLevels/{productId}__{variantId}__{locationId}` (server only)
```ts
interface StockLevel { businessId: string; productId: string; variantId: string; locationId: string;
  qty: number; lastMovementId: string; updatedAt: Timestamp; schemaVersion: number; }
```

### 6.9 StockMovement — `stockMovements/{id}` (server only, immutable)
```ts
type MovementType = 'opening' | 'adjustment' | 'purchase' | 'purchase_reversal' | 'transfer_out' | 'transfer_in'
  | 'sale' | 'sale_reversal' | 'delivery_out' | 'delivery_return' | 'sale_return' | 'purchase_return'
  | 'migration_opening';                                       // bridge entry, MIGRATION-PLAN §7
interface StockMovement {
  id: string; businessId: string; date: string;
  productId: string; variantId: string; locationId: string;
  type: MovementType; qtyChange: number;                        // signed, base units
  qtyAfter: number;                                             // new: running level after the move
  reasonCategory: AdjCategory | null; note: string;
  refType: DocType | 'transfer' | 'stock_count' | 'product' | null; refId: string | null;
  enteredUnit: string | null; enteredQty: number | null;       // e.g. purchase in alt unit
  unitCostPaise: number | null;                                 // for wastage valuation (BR-STK-12)
  createdAt: Timestamp; createdBy: string; schemaVersion: number;
}
```

### 6.10 StockTransfer — `stockTransfers/{id}`
```ts
interface StockTransfer extends Entity {
  date: string; fromLocationId: string; toLocationId: string; notes: string;
  items: { productId: string; variantId: string; qty: number; nameSnapshot: string }[];
  shortagesOverridden: boolean;
}
```

### 6.11 StockCount — `stockCounts/{id}`
```ts
interface StockCount extends Entity {
  date: string; locationId: string; notes: string;
  lines: { productId: string; variantId: string; systemQty: number; countedQty: number; diff: number }[];
  changedCount: number;
}
```

### 6.12 Customer — `customers/{id}`
```ts
interface Customer extends Entity, SoftDelete {
  name: string; nameLower: string; contactPerson: string;
  gstin: string;                   // '' ⇒ B2C
  stateCode: string | null; city: string; phone: string; address: string;
  creditLimitPaise: number;        // 0 ⇒ no limit (assumed, BR-INV-06)
  stats: { outstandingPaise: number; overdueInvoiceCount: number; lastInvoiceDate: string | null };  // server-maintained
  searchTokens: string[];
}
```
Customers can be created and edited by the client directly (rules validate the fields and forbid `stats`), or through the quick-add callable. Deletes go through a callable (admin only, soft delete).

### 6.13 Supplier — `suppliers/{id}`
Same shape as Customer minus `creditLimitPaise`. It has `stats.payablePaise` instead. Legacy supplier fields are NOT VERIFIED (OQ-11).

### 6.14 Invoice and InvoiceLine — `invoices/{id}` (server only)
```ts
interface InvoiceLine {
  lineId: string;
  productId: string; variantId: string;
  nameSnapshot: string; codeSnapshot: string; hsnSnapshot: string; unit: string;
  qty: number; baseQty: number;                  // baseQty = toBaseQty(product, qty, unit)
  ratePaise: number; discountBp: number;
  gstRateBp: GstRateBp;                          // snapshot at add time (BR-GST-09)
  taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number;
  unitCostPaise: number;                         // COGS snapshot (BR-COGS-02)
  skipStockDeduction: boolean;                   // true when converted from a DN (BR-DN-04)
}
interface Invoice extends Entity, SoftDelete {
  number: string; seriesKey: 'invoice_gst' | 'invoice_nogst'; fy: string; seq: number;
  date: string; dueDate: string | null; locationId: string;
  customerId: string | null;
  customerSnapshot: { name: string; gstin: string; stateCode: string | null; address: string; phone: string } | null;
  sellerSnapshot: { businessName: string; gstin: string; stateCode: string | null };
  gstApplicable: boolean;                        // DEF-016/019
  taxType: 'intra' | 'inter';
  lines: InvoiceLine[];
  subtotalPaise: number;                         // Σ taxable
  cgstPaise: number; sgstPaise: number; igstPaise: number; taxPaise: number;
  roundOffPaise: number; grandTotalPaise: number;
  initialPaidPaise: number;                      // at-billing paid (BR-ACC-09)
  paidPaise: number;                             // initial + Σ payments
  outstandingPaise: number;                      // max(0, grand − paid)
  paymentStatus: 'paid' | 'partial' | 'unpaid';  // BR-PAY-02 (derived)
  notes: string;
  source: { type: 'quotation' | 'delivery_note'; id: string } | null;
  createdByName: string;                         // account performance (BR-INV-14)
  revision: number;                              // optimistic concurrency, +1 per edit
}
```

### 6.15 Payment — `payments/{id}` (server only)
```ts
type PaymentMode = 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' | 'Card' | 'Other';   // DEF-040
interface Payment extends Entity, SoftDelete {
  direction: 'in' | 'out';                       // in: invoice; out: purchase
  targetType: 'invoice' | 'purchase'; targetId: string; targetNumber: string;
  partyId: string | null;                        // customerId / supplierId
  date: string; amountPaise: number; mode: PaymentMode; reference: string; notes: string;
  locationId: string;
  cashEntryId: string | null;                    // optional Cash Book mirror (BR-CASH-04)
  journalEntryId: string;
}
```

### 6.16 Quotation — `quotations/{id}`
Same line and total shape as Invoice, with no `gstApplicable` and no payment fields. `status: 'open' | 'converted'` and `convertedInvoiceId: string | null`.

### 6.17 DeliveryNote — `deliveryNotes/{id}`
```ts
interface DeliveryNote extends Entity, SoftDelete {
  number: string; fy: string; seq: number; date: string; locationId: string;
  customerId: string | null; customerSnapshot: Invoice['customerSnapshot'];
  lines: { lineId: string; productId: string; variantId: string; nameSnapshot: string; codeSnapshot: string;
           hsnSnapshot: string; unit: string; qty: number; baseQty: number; referenceRatePaise: number }[];
  referenceValuePaise: number;                   // Σ qty × reference rate (no GST, BR-DN-02)
  status: 'pending' | 'invoiced' | 'returned';
  invoiceId: string | null; returnedAt: Timestamp | null; notes: string;
}
```

### 6.18 CreditNote — `creditNotes/{id}`
```ts
interface CreditNote extends Entity, SoftDelete {
  number: string; fy: string; seq: number; date: string; locationId: string;
  invoiceId: string; invoiceNumber: string; customerId: string | null; customerSnapshot: Invoice['customerSnapshot'];
  taxType: 'intra' | 'inter'; gstApplicable: boolean;   // inherited (BR-CN-02)
  restock: boolean;
  lines: (Omit<InvoiceLine, 'skipStockDeduction'> & { invoiceLineId: string })[];
  subtotalPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; taxPaise: number;
  roundOffPaise: number; grandTotalPaise: number;        // rounding per OQ-11/BR-CN-06
  reason: string;
}
```

### 6.19 DebitNote — `debitNotes/{id}`
```ts
interface DebitNote extends Entity, SoftDelete {
  number: string; fy: string; seq: number; date: string; locationId: string;
  purchaseId: string; supplierId: string; supplierSnapshot: { name: string; gstin: string };
  restock: boolean;
  lines: { purchaseLineId: string; productId: string; variantId: string; nameSnapshot: string;
           qty: number; baseQty: number; ratePaise: number; amountPaise: number }[];
  totalPaise: number; reason: string;
}
```

### 6.20 Purchase and PurchaseLine — `purchases/{id}`
```ts
interface PurchaseLine {
  lineId: string; productId: string; variantId: string; nameSnapshot: string;
  enteredUnit: string; enteredQty: number; baseQty: number;
  ratePaise: number;                       // per entered unit
  amountPaise: number;
  // GST fields reserved pending OQ-06: gstRateBp?, taxPaise?
}
interface Purchase extends Entity, SoftDelete {
  date: string; locationId: string; supplierId: string; supplierSnapshot: { name: string; gstin: string };
  supplierBillNo: string;                  // NOT VERIFIED in legacy (OQ-11); optional
  lines: PurchaseLine[]; totalPaise: number;
  initialPaidPaise: number; paidPaise: number; outstandingPaise: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid'; dueDate: string | null; notes: string;
}
```

### 6.21 ExpenseCategory, Expense — `expenseCategories/{id}`, `expenses/{id}`
```ts
interface ExpenseCategory extends Entity, SoftDelete { name: string; slug: string; accountId: string; isDefault: boolean }
interface Expense extends Entity, SoftDelete {
  date: string; locationId: string; categoryId: string; categoryNameSnapshot: string;
  amountPaise: number; mode: PaymentMode; notes: string; journalEntryId: string;
}
```

### 6.22 CashEntry — `cashEntries/{id}`
```ts
interface CashEntry extends Entity, SoftDelete {
  date: string; locationId: string; type: 'in' | 'out';
  category: CashInCategory | CashOutCategory;       // DEF-038/039
  amountPaise: number; mode: PaymentMode; reference: string; notes: string;
  source: { type: 'payment' | 'payroll' | 'staff_payment' | 'manual'; id: string | null };
}
```

### 6.23 Account — `accounts/{id}`
```ts
type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
interface Account extends Entity, SoftDelete {
  code: number; name: string; nameLower: string; type: AccountType;
  isSystem: boolean; expenseCategoryId: string | null;
  normalSide: 'debit' | 'credit';                   // derived from type (BR-ACC-06)
}
```

### 6.24 JournalEntry — `journalEntries/{id}` (server only)
```ts
type RefType = 'invoice' | 'invoice_cogs' | 'purchase' | 'expense' | 'payroll' | 'staffpayroll'
  | 'credit_note' | 'credit_note_cogs' | 'debit_note' | 'payment_in' | 'payment_out' | 'migration_opening';
interface JournalLine { accountId: string; debitPaise: number; creditPaise: number }
interface JournalEntry {
  id: string; businessId: string; date: string; locationId: string;
  refType: RefType; refId: string; refLabel: string;
  lines: JournalLine[];                             // Σ debit === Σ credit (BR-ACC-01)
  totalPaise: number;
  status: 'posted' | 'voided';                      // BR-ACC-05
  voidedAt: Timestamp | null; voidedBy: string | null; voidReason: 'edit' | 'delete' | 'restore' | null;
  createdAt: Timestamp; createdBy: string; schemaVersion: number;
}
```
`ledgerMonthly/{yyyymm}__{accountId}__{locationId}` → `{ debitPaise, creditPaise }` is updated in the same transaction on post (+) and void (−). Statements = the sum of complete months + a query over the partial range (ARCHITECTURE §6.4).

### 6.25 Payroll — `payrollEntries/{id}`
```ts
interface PayrollEntry extends Entity, SoftDelete {
  date: string; locationId: string;                 // legacy `userId` (TD §6.6)
  type: 'commission' | 'salary';                    // exact legacy values NOT VERIFIED (OQ-11)
  periodFrom: string | null; periodTo: string | null;
  amountPaise: number; mode: PaymentMode; notes: string;
  journalEntryId: string; cashEntryId: string | null;
}
```

### 6.26 Staff and StaffPayment — `staff/{id}`, `staffPayments/{id}`
```ts
interface Staff extends Entity, SoftDelete {
  name: string; phone: string; locationId: string | null;
  defaultPaymentType: PayrollEntry['type']; defaultMode: PaymentMode;
  status: 'active' | 'inactive';
}
interface StaffPayment extends Entity, SoftDelete {
  staffId: string; staffNameSnapshot: string; date: string; locationId: string | null;
  type: PayrollEntry['type']; amountPaise: number; mode: PaymentMode; notes: string;
  journalEntryId: string; cashEntryId: string | null;
}
```

### 6.27 ActivityLog — `activityLog/{id}` (server only, immutable)
```ts
interface ActivityLog {
  id: string; businessId: string; at: Timestamp;
  actorUid: string; actorName: string; locationId: string | null;
  action: ActivityAction;                            // legacy ACTIVITY_LABELS codes (OQ-11) + new ones
  target: { type: string; id: string; label: string } | null;
  details: Record<string, string | number | boolean | null>;
  requestId: string | null;
}
```

### 6.28 WhatsappCampaign — `whatsappCampaigns/{id}`
Drafts only: `{ name, message, audience: {...}, status: 'draft' }` (LC-45.3). Exact legacy fields NOT VERIFIED.

### 6.29 BackupRecord, RestoreJob, IdempotencyRecord
```ts
interface BackupRecord extends Entity { storagePath: string; sizeBytes: number; sha256: string;
  schemaVersion: number; appVersion: string; counts: Record<string, number>;
  reason: 'manual' | 'pre_restore' | 'pre_reset' | 'scheduled' }
interface RestoreJob extends Entity { sourceBackupId: string | null; uploadedPath: string | null;
  status: 'validating' | 'awaiting_confirmation' | 'running' | 'completed' | 'failed';
  dryRun: { counts: Record<string, number>; warnings: string[] } | null; preRestoreBackupId: string | null }
interface IdempotencyRecord { requestId: string; uid: string; operation: string;
  resultRef: { collection: string; id: string } | null; createdAt: Timestamp; expireAt: Timestamp }  // TTL policy
```

### 6.30 SalesDaily (aggregate, server only)
`salesDaily/{yyyy-mm-dd}__{locationId}` → `{ date, locationId, salesPaise, billCount, gstSalesPaise, noGstSalesPaise }`. It is maintained in the invoice transactions and powers the Dashboard KPIs and trend (BR-RPT-01) without scanning invoices.

---

## 7. Invariants enforced by functions

| Invariant | Enforced where |
|---|---|
| `Σ debit === Σ credit` per journal entry | `postJournal()` in `functions/src/services/ledger.ts` |
| `stockLevels.qty` = Σ `stockMovements.qtyChange` for the key | stock service (same transaction); nightly verification job |
| `invoice.paidPaise = initialPaidPaise + Σ non-deleted payments` | payment service |
| `customer.stats.outstandingPaise = Σ outstanding of non-deleted invoices` | invoice/payment services; nightly verification job |
| One reservation per issued number | numbering service |
| `ledgerMonthly` = Σ posted journal lines | ledger service; nightly verification job |

---

## 8. Indexes (initial)

| Collection | Fields |
|---|---|
| invoices | `deletedAt ASC, date DESC, createdAt DESC`; `locationId ASC, deletedAt ASC, date DESC`; `customerId ASC, deletedAt ASC, date ASC`; `gstApplicable ASC, date ASC`; `outstandingPaise DESC, dueDate ASC` |
| stockMovements | `locationId ASC, createdAt DESC`; `productId ASC, createdAt DESC`; `type ASC, date DESC`; `reasonCategory ASC, date DESC` |
| stockLevels | `locationId ASC, qty ASC` |
| journalEntries | `status ASC, date ASC`; `refType ASC, refId ASC` ; `locationId ASC, status ASC, date ASC` |
| payments | `targetType ASC, targetId ASC, date ASC`; `partyId ASC, date ASC` |
| expenses / cashEntries | `locationId ASC, deletedAt ASC, date DESC` |
| products / customers | `deletedAt ASC, nameLower ASC`; `searchTokens ARRAY_CONTAINS` |

These go in `firestore.indexes.json` and are deployed by CI.

---

## 9. Limits and constraints

- Maximum **500 lines** per document (invoice, purchase, quotation, DN, CN, DBN, transfer, count). This keeps documents far below Firestore's 1 MiB limit. Stock counts with more lines are split into batches of ≤ 500 lines per `stockCount` record, applied as one operation id. This is a technical constraint; the legacy app has no limit (its 900 KB guard applied to the whole database, TD §7.2).
- A transaction touching an invoice with N lines reads and writes N stock levels. Firestore's limit of 500 writes per transaction bounds this. With the 500-line cap, the stock + movement writes (2N) require chunking for very large bills. Bills over 200 lines are processed as a **single logical operation split into sequential transactions guarded by an operation lock**, and this is documented in ARCHITECTURE §6.3.

---

## 10. Legacy → new shape summary

The full field mapping is in `MIGRATION-PLAN.md §5`. Key structural changes:

| Legacy | New |
|---|---|
| `variant.stockByLocation{loc: qty}` | `stockLevels` docs |
| `invoice.payments[]` | `payments` collection + `invoice.paidPaise` |
| `productImages{id: base64|url}` | Storage object + `product.imagePath` |
| `settings.next*Seq` | `counters/{seriesKey}` |
| `payrollEntry.userId` (a location id) | `payrollEntry.locationId` |
| `membership.locationName` | `member.locationIds[]` |
| `membership.tabs` | `member.permissionOverrides` |
| floats (₹) | integer paise |
| hard delete | `deletedAt` tombstone |
| journal delete-and-repost | `status: 'voided'` + repost |

---

## 11. Phase 3 addendum — implemented representations

- **Money:** integer paise everywhere (§2), implemented in `@hynish/domain/money` (`Money.*`,
  `roundHalfUp`, `formatINR`). No floats persisted.
- **Timestamps (canonical, §52):** the DOMAIN represents instants as **epoch milliseconds**
  (numbers) under the same field names Firestore uses (`createdAt`, `updatedAt`, `deletedAt`,
  `at`, `voidedAt`, `returnedAt`, `lastInteractiveSignInAt`). Firestore stores them as
  `Timestamp` (written by Cloud Functions via `serverTimestamp()`); the converter
  (`infrastructure/firestore/converter.ts`) deep-converts `Timestamp → ms` on read. Business
  dates remain `'YYYY-MM-DD'` strings.
- **Schemas:** every entity in §6 has a Zod schema in `@hynish/domain/schemas` (the source of the
  TS types via `z.infer`), with Create/Update DTOs where a client/service submits data. Reads are
  validated by the converter — no `doc.data() as T`.
- **Soft delete (§36 decision):** entities that can be removed carry `deletedAt`/`deletedBy`
  tombstones (queries filter `deletedAt == null`). Immutable ledgers (stock movements, journal
  entries, activity log) are never deleted — journal entries are `voided` instead.
- **IDs (§51):** persisted documents use Firestore auto-ids; server-sensitive ids (number
  reservations, idempotency keys) are server-generated; `newId()` is for local/optimistic use only.
- **Numbering:** counters live in `businesses/{b}/counters/{seriesKey}`; each issued number writes
  a reservation in `businesses/{b}/documentNumbers/{numberKey}` inside one transaction
  (`functions/src/numbering/reserve-core.ts`) — collision-free across devices (fixes KL-01).

## Phase 4 — Master data collections (implemented)

- **`products/{id}`** — full catalog doc: `name`/`nameLower`, `category` (free-text; no separate
  category entity), `hsn`, `unit`, `wholesalePricePaise`/`purchasePricePaise` (integer paise),
  `gstRateBp`, `barcode` (normalized upper-case; `''` if none), `lowStockThreshold` (null → default
  5), `hasVariants` + `variants[]` (`'default'` when single), `altUnits[]`, `imagePath`,
  `searchTokens[]`, and the soft-delete tombstone (`deletedAt`/`deletedBy`).
- **`barcodes/{normalizedCode}`** — server-only uniqueness index (`{ productId, barcode }`) written
  transactionally by `saveProduct`; enforces case-insensitive barcode uniqueness (fixes the legacy
  client-only check). Client writes denied.
- **`customers/{id}` / `suppliers/{id}`** — `name`/`nameLower`, `contactPerson`, `gstin`
  (upper-cased; `''` = B2C), `stateCode` (derived from GSTIN, structured for future intra/inter-state
  GST), `city`, `phone`, `address`, `searchTokens[]`, soft-delete; customers also carry
  `creditLimitPaise` and `stats`.
- **`locations/{id}`** — `name`, `type` (shop/warehouse), `address`, `openingCashBalancePaise`,
  `isDefault`, `sortOrder`, soft-delete. At least one active location is always kept.
- **Categories** are a **derived view** over `products.category`, not a stored collection.
- **Indexes** (`firestore.indexes.json`): `products` by `deletedAt`+`nameLower`, by
  `deletedAt`+`category`+`nameLower`, and `searchTokens[array]`+`nameLower`; the same name/token
  indexes for `customers` and `suppliers`.
- **Images** live in Storage at `businesses/{b}/products/{productId}/{imageId}.jpg`; the doc stores
  only `imagePath`. Replacing/clearing deletes the old object server-side (fixes KL-03).

## Phase 5 — Sales collections (implemented)

- **`invoices/{id}`** — number/seriesKey (`invoice_gst`|`invoice_nogst`)/fy/seq, date, dueDate,
  locationId, customerId + frozen `customerSnapshot`, `sellerSnapshot`, `gstApplicable`, `taxType`,
  `lines[]` (each with name/code/HSN/unit/qty/baseQty/rate/discountBp/gstRateBp/taxable/cgst/sgst/
  igst/total + `unitCostPaise` COGS snapshot + `skipStockDeduction`), header totals
  (subtotal/cgst/sgst/igst/tax/roundOff/grandTotal), `initialPaidPaise`/`paidPaise`/`outstandingPaise`/
  `paymentStatus`, `source`, `createdByName`, `revision`, soft-delete.
- **`quotations/{id}`** — number/fy/seq, date, location, customer + snapshot, taxType, lines (invoice
  line shape minus cost/stock), totals (subtotal/tax/roundOff/grand), `status` (`open`|`converted`),
  `convertedInvoiceId`, soft-delete.
- **`payments/{id}`** — direction/targetType/targetId/targetNumber, partyId, date, amountPaise, mode,
  reference, locationId, `cashEntryId`, `journalEntryId`, soft-delete.
- **`journalEntries/{id}`** — server-only double-entry: date, locationId, refType, refId, refLabel,
  balanced `lines[]`, totalPaise, `status` (`posted`|`voided`) + void audit. Edits/deletes VOID and
  re-post (BR-ACC-05).
- **`documentNumbers/{key}`** and **`idempotency/{requestId}`** — server-only (uniqueness reservation;
  transaction-scoped operation dedupe). Client writes denied.
- **Indexes:** invoices by (deletedAt,date) + (deletedAt,{location|customer|paymentStatus|seriesKey},
  date); quotations by (deletedAt,date)/(…,status)/(…,customer); payments by (deletedAt,date) and
  (targetType,targetId,date).

## Phase 6 — Purchases & inventory collections (implemented)

- **`stockMovements/{id}`** — immutable, append-only ledger (BR-STK-02): productId, variantId,
  locationId, `type` (STOCK_MOVEMENT_TYPES), `qtyChange` (signed base units), `qtyAfter`,
  reasonCategory, note, refType/refId, enteredUnit/enteredQty, unitCostPaise, createdAt/By. Source of truth.
- **`stockLevels/{productId_variantId_locationId}`** — derived per-cell balance (qty, lastMovementId,
  updatedAt), written only in the same transaction as its movement (BR-STK-03). Server-only.
- **`purchases/{id}`** — date, locationId, supplierId + snapshot, `supplierBillNo` (no document
  number, no GST), lines (productId/variantId/name/enteredUnit/enteredQty/baseQty/rate/amount),
  totalPaise, initialPaid/paid/outstanding/paymentStatus, dueDate, notes, soft-delete.
- **`stockTransfers/{id}`** — date, from/to location, items[], notes, shortagesOverridden.
- **`stockCounts/{id}`** — date, locationId, lines[{system,counted,diff}], changedCount (summary; the
  corrections are `adjustment` movements).
- Client writes to all of the above are denied; every mutation is a Cloud Function.
- Indexes: stockLevels (locationId+qty; productId+locationId); stockMovements (locationId+date;
  productId+date; type+date; productId+locationId+date); purchases (deletedAt+date;
  deletedAt+locationId+date; deletedAt+supplierId+date).
