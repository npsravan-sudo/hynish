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
