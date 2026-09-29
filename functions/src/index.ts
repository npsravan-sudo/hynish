/**
 * Cloud Functions entry point (Phase 2 §23). Exports only — no logic here.
 * Business-operation functions (invoices, payments, stock, journal, …) are added in later
 * phases; this phase establishes authentication, membership and authorization.
 */
import './config/app.js';

export { createMember, updateMember, setMemberActive } from './members/manage.js';
export { logSession } from './auth/session.js';
export { onMemberWritten } from './members/triggers.js';
export { reserveDocumentNumber } from './numbering/reserve.js';

// Master data (Phase 4) — server-authoritative create/update/archive with validation + audit.
export { saveProduct, setProductActive, setProductImage } from './masterdata/products.js';
export { saveCustomer, setCustomerActive } from './masterdata/customers.js';
export { saveSupplier, setSupplierActive } from './masterdata/suppliers.js';
export { saveLocation, setLocationActive } from './masterdata/locations.js';

// Sales (Phase 5) — server-authoritative billing, payments and quotations. Every financial value is
// recomputed server-side; each op is atomic (numbering + document + journals) and idempotent.
export { finalizeInvoice } from './sales/finalize-invoice.js';
export { deleteInvoice } from './sales/delete-invoice.js';
export { recordPayment } from './sales/record-payment.js';
export { saveQuotation } from './sales/quotations.js';

// Purchases & Inventory (Phase 6) — server-authoritative, atomic, idempotent stock + purchase ops.
export { finalizePurchase } from './purchases/finalize-purchase.js';
export { deletePurchase } from './purchases/delete-purchase.js';
export { recordStockAdjustment } from './inventory/adjustments.js';
export { transferStock } from './inventory/transfers.js';
export { finalizeStockCount } from './inventory/counts.js';
export { postOpeningStock } from './inventory/opening.js';

// Accounting (Phase 7) — Chart of Accounts management + Cash Book. The posting gateway itself
// (postJournalTx) has no client-facing callable: the source never exposes an arbitrary
// debit/credit screen (TD §6.1), so all journal posting stays internal to the sales/purchases/
// payments modules above, which already call it inside their own atomic transactions.
export { seedChartOfAccounts } from './accounting/seed-accounts.js';
export { saveAccount } from './accounting/save-account.js';
export { deleteAccount } from './accounting/delete-account.js';
export { logCashEntry } from './accounting/cash-book.js';

// Business Operations (Phase 8) — Expenses, Delivery Notes, Credit Notes (sales-return equivalent),
// Debit Notes (purchase-return equivalent). No standalone "Sales Return"/"Purchase Return" document
// exists in the source — Credit/Debit Notes ARE that mechanism (with an optional restock flag);
// see docs/PHASE-8-COMPLETION.md. No Bank Operations/fund-transfer callable exists either — the
// source has no such feature (only Cash-vs-Bank routing inside postJournal), so none is built here.
export { seedExpenseCategories } from './accounting/seed-expense-categories.js';
export { saveExpense, deleteExpense } from './accounting/expenses.js';
export { saveDeliveryNote, markDeliveryNoteReturned } from './sales/delivery-notes.js';
export { saveCreditNote } from './sales/credit-notes.js';
export { saveDebitNote } from './purchases/debit-notes.js';

// Administration (Phase 10) — Settings, Backup metadata. All settings writes are server-only;
// clients use these callables, never writing settings/* or backups/* directly.
// Restore is not yet a callable — destructive bulk-restore requires a dedicated migration path
// (OQ-29). The supported flow is client-side export + import via saveBusinessSettings.
export { saveBusinessSettings, saveIntegrationSettings, createBackupMetadata } from './settings/save-settings.js';

// Migration (Phase 12) — Controlled legacy data migration with dry-run mode, journal-balance
// validation, numbering counter seeding, and migration stamp to prevent accidental re-run.
// Requires: owner role + step-up reauth + App Check.
export { runMigration } from './migration/run-migration.js';
