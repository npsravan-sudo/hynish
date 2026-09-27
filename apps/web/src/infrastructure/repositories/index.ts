/**
 * Repository registry (§40). Domain-oriented, typed reads bound to a business. Features consume
 * these via hooks/services — never Firestore directly. Writes for these collections are
 * server-authoritative (Cloud Functions); repositories provide reads + realtime for this phase.
 */
import {
  productSchema, customerSchema, supplierSchema, locationSchema, memberSchema,
  invoiceSchema, quotationSchema, deliveryNoteSchema, creditNoteSchema, debitNoteSchema,
  purchaseSchema, paymentSchema, accountSchema, journalEntrySchema, stockMovementSchema,
  stockLevelSchema, expenseSchema, cashEntrySchema, activityLogSchema,
  businessSettingsSchema, integrationSettingsSchema,
  type Product, type Customer, type Supplier, type Location, type Member,
  type Invoice, type Payment, type Account, type JournalEntry, type StockMovement,
  type BusinessSettings,
} from '@hynish/domain';
import { paths } from '../firestore/paths';
import { createReadRepository, type ReadRepository } from './firestore-repository';
import { createDocumentReader, type DocumentReader } from './document-reader';

export interface Repositories {
  members: ReadRepository<Member>;
  locations: ReadRepository<Location>;
  products: ReadRepository<Product>;
  customers: ReadRepository<Customer>;
  suppliers: ReadRepository<Supplier>;
  invoices: ReadRepository<Invoice>;
  payments: ReadRepository<Payment>;
  accounts: ReadRepository<Account>;
  journalEntries: ReadRepository<JournalEntry>;
  stockMovements: ReadRepository<StockMovement>;
  businessSettings: DocumentReader<BusinessSettings>;
}

/** Build the repositories bound to a business id. Cheap to call; repos are stateless. */
export function makeRepositories(businessId: string): Repositories {
  return {
    members: createReadRepository(paths.members(businessId), memberSchema),
    locations: createReadRepository(paths.locations(businessId), locationSchema),
    products: createReadRepository(paths.products(businessId), productSchema),
    customers: createReadRepository(paths.customers(businessId), customerSchema),
    suppliers: createReadRepository(paths.suppliers(businessId), supplierSchema),
    invoices: createReadRepository(paths.invoices(businessId), invoiceSchema),
    payments: createReadRepository(paths.payments(businessId), paymentSchema),
    accounts: createReadRepository(paths.accounts(businessId), accountSchema),
    journalEntries: createReadRepository(paths.journalEntries(businessId), journalEntrySchema),
    stockMovements: createReadRepository(paths.stockMovements(businessId), stockMovementSchema),
    businessSettings: createDocumentReader(paths.settingsBusiness(businessId), businessSettingsSchema),
  };
}

// Additional entity schemas are exported for future repositories/services as their modules land.
export {
  quotationSchema, deliveryNoteSchema, creditNoteSchema, debitNoteSchema, purchaseSchema,
  stockLevelSchema, expenseSchema, cashEntrySchema, activityLogSchema, integrationSettingsSchema,
};
