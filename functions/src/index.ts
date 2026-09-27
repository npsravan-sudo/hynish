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

// Boundary note (§60): future server-authoritative operations — postJournal, recordStockMovement,
// postInvoice, postPurchase, postPayment — have their request/response contracts and validation
// in @hynish/domain (AccountingService, InventoryService, DocumentNumberService) and are
// implemented in their module phases. reserveDocumentNumber is the concrete example this phase.
