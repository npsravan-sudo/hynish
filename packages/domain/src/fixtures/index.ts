/**
 * Realistic but FICTIONAL test fixtures (§57). Never real personal/customer data. Each factory
 * returns a valid entity (validated against its schema in fixtures.test.ts) and accepts overrides.
 */
import type {
  Business, Member, Location, Product, Customer, Supplier, Invoice, Payment, JournalEntry,
  StockMovement, BusinessSettings, CreditNote,
} from '../schemas/index.js';

const AUDIT = {
  createdAt: 1_700_000_000_000,
  createdBy: 'user-owner',
  updatedAt: 1_700_000_000_000,
  updatedBy: 'user-owner',
  schemaVersion: 1,
};
const SOFT = { deletedAt: null, deletedBy: null };
const BID = 'biz-hynish';

export function businessFixture(over: Partial<Business> = {}): Business {
  return {
    id: BID, businessId: BID, ...AUDIT,
    name: 'Hynish Clothing', ownerUid: 'user-owner', status: 'active',
    timezone: 'Asia/Kolkata', legacyBusinessCode: 'hh-erp-2026', currentSchemaVersion: 1,
    ...over,
  };
}

export function memberFixture(over: Partial<Member> = {}): Member {
  return {
    id: 'user-owner', businessId: BID, ...AUDIT, ...SOFT,
    uid: 'user-owner', email: 'owner@hynish.test', displayName: 'Owner',
    role: 'owner', active: true, locationIds: null, permissionOverrides: null,
    lastInteractiveSignInAt: 1_700_000_000_000,
    ...over,
  };
}

export function locationFixture(over: Partial<Location> = {}): Location {
  return {
    id: 'loc-baby-step', businessId: BID, ...AUDIT, ...SOFT,
    name: 'Baby Step', type: 'shop', address: 'MG Road', openingCashBalancePaise: 500000,
    isDefault: true, sortOrder: 0,
    ...over,
  };
}

export function productFixture(over: Partial<Product> = {}): Product {
  return {
    id: 'prod-shirt', businessId: BID, ...AUDIT, ...SOFT,
    name: 'Cotton Shirt', nameLower: 'cotton shirt', category: 'Shirts', hsn: '6205',
    wholesalePricePaise: 45000, purchasePricePaise: 30000, gstRateBp: 500, unit: 'Pcs',
    altUnits: [{ name: 'Dozen', factor: 12 }], barcode: 'SHIRT001', lowStockThreshold: null,
    hasVariants: true,
    variants: [{ id: 'v-m-blue', size: 'M', color: 'Blue', barcodeOverride: null, active: true }],
    imagePath: null, searchTokens: ['cotton', 'shirt'],
    ...over,
  };
}

export function customerFixture(over: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-acme', businessId: BID, ...AUDIT, ...SOFT,
    name: 'Acme Traders', nameLower: 'acme traders', contactPerson: 'Ramesh',
    gstin: '29ABCDE1234F1Z5', stateCode: '29', city: 'Bengaluru', phone: '9999900000',
    address: 'Market Street', creditLimitPaise: 10000000,
    stats: { outstandingPaise: 0, overdueInvoiceCount: 0, lastInvoiceDate: null },
    searchTokens: ['acme', 'traders'],
    ...over,
  };
}

export function supplierFixture(over: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup-mills', businessId: BID, ...AUDIT, ...SOFT,
    name: 'Textile Mills', nameLower: 'textile mills', contactPerson: 'Suresh',
    gstin: '27PQRSX6789L1Z3', stateCode: '27', city: 'Mumbai', phone: '8888800000',
    address: 'Mill Road', stats: { payablePaise: 0 }, searchTokens: ['textile', 'mills'],
    ...over,
  };
}

export function invoiceFixture(over: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1', businessId: BID, ...AUDIT, ...SOFT,
    number: 'INV/2627/0001', seriesKey: 'invoice_gst', fy: '2627', seq: 1,
    date: '2026-04-05', dueDate: null, locationId: 'loc-baby-step', customerId: 'cust-acme',
    customerSnapshot: { name: 'Acme Traders', gstin: '29ABCDE1234F1Z5', stateCode: '29', address: 'Market Street', phone: '9999900000' },
    sellerSnapshot: { businessName: 'Hynish Clothing', gstin: '29AAAAA0000A1Z5', stateCode: '29' },
    gstApplicable: true, taxType: 'intra',
    lines: [{
      lineId: 'l1', productId: 'prod-shirt', variantId: 'v-m-blue', nameSnapshot: 'Cotton Shirt',
      codeSnapshot: 'SHIRT001', hsnSnapshot: '6205', unit: 'Pcs', qty: 2, baseQty: 2,
      ratePaise: 45000, discountBp: 0, gstRateBp: 500, taxablePaise: 90000, cgstPaise: 2250,
      sgstPaise: 2250, igstPaise: 0, totalPaise: 94500, unitCostPaise: 30000, skipStockDeduction: false,
    }],
    subtotalPaise: 90000, cgstPaise: 2250, sgstPaise: 2250, igstPaise: 0, taxPaise: 4500,
    roundOffPaise: 0, grandTotalPaise: 94500, initialPaidPaise: 94500, paidPaise: 94500,
    outstandingPaise: 0, paymentStatus: 'paid', notes: '', source: null, createdByName: 'Owner', revision: 0,
    ...over,
  };
}

export function creditNoteFixture(over: Partial<CreditNote> = {}): CreditNote {
  return {
    id: 'cn-1', businessId: BID, ...AUDIT, ...SOFT,
    number: 'CN/2627/0001', fy: '2627', seq: 1,
    date: '2026-04-06', locationId: 'loc-baby-step', invoiceId: 'inv-1', invoiceNumber: 'INV/2627/0001',
    customerId: 'cust-acme', customerSnapshot: { name: 'Acme Traders', gstin: '29ABCDE1234F1Z5', stateCode: '29', address: 'Market Street', phone: '9999900000' },
    taxType: 'intra', gstApplicable: true, restock: false,
    lines: [{
      invoiceLineId: 'l1', lineId: 'l1', productId: 'prod-shirt', variantId: 'v-m-blue', nameSnapshot: 'Cotton Shirt',
      codeSnapshot: 'SHIRT001', hsnSnapshot: '6205', unit: 'Pcs', qty: 1, baseQty: 1,
      ratePaise: 45000, discountBp: 0, gstRateBp: 500, taxablePaise: 45000, cgstPaise: 1125,
      sgstPaise: 1125, igstPaise: 0, totalPaise: 47250, unitCostPaise: 30000,
    }],
    subtotalPaise: 45000, cgstPaise: 1125, sgstPaise: 1125, igstPaise: 0, taxPaise: 2250,
    roundOffPaise: 0, grandTotalPaise: 47250, reason: '',
    ...over,
  };
}

export function paymentFixture(over: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1', businessId: BID, ...AUDIT, ...SOFT,
    direction: 'in', targetType: 'invoice', targetId: 'inv-1', targetNumber: 'INV/2627/0001',
    partyId: 'cust-acme', date: '2026-04-06', amountPaise: 50000, mode: 'UPI', reference: 'UPI-123',
    notes: '', locationId: 'loc-baby-step', cashEntryId: null, journalEntryId: 'je-pay-1',
    ...over,
  };
}

export function journalEntryFixture(over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'je-1', businessId: BID, date: '2026-04-05', locationId: 'loc-baby-step',
    refType: 'invoice', refId: 'inv-1', refLabel: 'INV/2627/0001',
    lines: [
      { accountId: 'acc-cash', debitPaise: 94500, creditPaise: 0 },
      { accountId: 'acc-sales', debitPaise: 0, creditPaise: 90000 },
      { accountId: 'acc-gst-output', debitPaise: 0, creditPaise: 4500 },
    ],
    accountIds: ['acc-cash', 'acc-sales', 'acc-gst-output'],
    totalPaise: 94500, status: 'posted', voidedAt: null, voidedBy: null, voidReason: null,
    createdAt: 1_700_000_000_000, createdBy: 'user-owner', schemaVersion: 1,
    ...over,
  };
}

export function stockMovementFixture(over: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'mov-1', businessId: BID, date: '2026-04-05', productId: 'prod-shirt', variantId: 'v-m-blue',
    locationId: 'loc-baby-step', type: 'sale', qtyChange: -2, qtyAfter: 8, reasonCategory: null,
    note: '', refType: 'invoice', refId: 'inv-1', enteredUnit: null, enteredQty: null,
    unitCostPaise: 30000, createdAt: 1_700_000_000_000, createdBy: 'user-owner', schemaVersion: 1,
    ...over,
  };
}

export function settingsFixture(over: Partial<BusinessSettings> = {}): BusinessSettings {
  return {
    businessName: 'Hynish Clothing', gstin: '29AAAAA0000A1Z5', address: 'MG Road', city: 'Bengaluru',
    stateCode: '29', pincode: '560001', phone: '9000000000', email: 'hello@hynish.test',
    logoPath: null, licenseKey: '',
    bank: { bankName: 'HDFC', accountNumber: '000111222333', ifsc: 'HDFC0000001' },
    prefixes: { invoice_gst: 'INV', invoice_nogst: 'NGST', quotation: 'QUO', delivery_note: 'DN', credit_note: 'CN', debit_note: 'DBN' },
    ...over,
  };
}
