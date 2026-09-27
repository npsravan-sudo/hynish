/** Sales schemas: Invoice(+line), Quotation, DeliveryNote, CreditNote, DebitNote (DATA-MODEL §6.14–6.19). */
import { z } from 'zod';
import { TAX_TYPES, QUOTATION_STATUSES, DELIVERY_NOTE_STATUSES, PAYMENT_STATUSES } from '../constants.js';
import { entity, softDelete, paise, nonNegPaise, gstRateBp, basisPoints, qty, businessDate } from './common.js';

const customerSnapshot = z
  .object({
    name: z.string(),
    gstin: z.string(),
    stateCode: z.string().nullable(),
    address: z.string(),
    phone: z.string(),
  })
  .nullable();

export const invoiceLineSchema = z.object({
  lineId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  nameSnapshot: z.string(),
  codeSnapshot: z.string(),
  hsnSnapshot: z.string(),
  unit: z.string(),
  qty,
  baseQty: z.number().positive(),
  ratePaise: nonNegPaise,
  discountBp: basisPoints,
  gstRateBp, // snapshot at add time (BR-GST-09)
  taxablePaise: paise,
  cgstPaise: nonNegPaise,
  sgstPaise: nonNegPaise,
  igstPaise: nonNegPaise,
  totalPaise: paise,
  unitCostPaise: nonNegPaise, // COGS snapshot (BR-COGS-02)
  skipStockDeduction: z.boolean().default(false), // true when converted from a DN (BR-DN-04)
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const invoiceSchema = entity.merge(softDelete).extend({
  number: z.string(),
  seriesKey: z.enum(['invoice_gst', 'invoice_nogst']),
  fy: z.string(),
  seq: z.number().int().positive(),
  date: businessDate,
  dueDate: businessDate.nullable(),
  locationId: z.string().min(1),
  customerId: z.string().nullable(),
  customerSnapshot,
  sellerSnapshot: z.object({ businessName: z.string(), gstin: z.string(), stateCode: z.string().nullable() }),
  gstApplicable: z.boolean(), // DEF-016/019
  taxType: z.enum(TAX_TYPES),
  lines: z.array(invoiceLineSchema).min(1).max(500),
  subtotalPaise: paise,
  cgstPaise: nonNegPaise,
  sgstPaise: nonNegPaise,
  igstPaise: nonNegPaise,
  taxPaise: nonNegPaise,
  roundOffPaise: paise,
  grandTotalPaise: paise,
  initialPaidPaise: nonNegPaise, // at-billing paid (BR-ACC-09)
  paidPaise: nonNegPaise,
  outstandingPaise: nonNegPaise,
  paymentStatus: z.enum(PAYMENT_STATUSES),
  notes: z.string().default(''),
  source: z.object({ type: z.enum(['quotation', 'delivery_note']), id: z.string() }).nullable(),
  createdByName: z.string(),
  revision: z.number().int().nonnegative(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

/** Draft line the client submits (business inputs only; server computes taxes/totals). */
export const draftInvoiceLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  unit: z.string(),
  qty,
  ratePaise: nonNegPaise,
  discountBp: basisPoints.default(0),
  gstRateBp,
});
export const createInvoiceSchema = z.object({
  locationId: z.string().min(1),
  date: businessDate,
  dueDate: businessDate.nullable().optional(),
  customerId: z.string().nullable(),
  gstApplicable: z.boolean(),
  lines: z.array(draftInvoiceLineSchema).min(1).max(500),
  initialPaidPaise: nonNegPaise.default(0),
  notes: z.string().default(''),
  source: z.object({ type: z.enum(['quotation', 'delivery_note']), id: z.string() }).nullable().optional(),
  /** Client confirmations for warning-level rules (stock shortage, credit limit) — §25. */
  confirmations: z.array(z.enum(['STOCK_SHORTAGE', 'CREDIT_LIMIT'])).default([]),
});
export type CreateInvoice = z.infer<typeof createInvoiceSchema>;

export const quotationSchema = entity.merge(softDelete).extend({
  number: z.string(),
  fy: z.string(),
  seq: z.number().int().positive(),
  date: businessDate,
  locationId: z.string().min(1),
  customerId: z.string().nullable(),
  customerSnapshot,
  taxType: z.enum(TAX_TYPES),
  lines: z.array(invoiceLineSchema.omit({ unitCostPaise: true, skipStockDeduction: true })).min(1).max(500),
  subtotalPaise: paise,
  taxPaise: nonNegPaise,
  roundOffPaise: paise,
  grandTotalPaise: paise,
  status: z.enum(QUOTATION_STATUSES),
  convertedInvoiceId: z.string().nullable(),
  notes: z.string().default(''),
});
export type Quotation = z.infer<typeof quotationSchema>;

export const deliveryNoteLineSchema = z.object({
  lineId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  nameSnapshot: z.string(),
  codeSnapshot: z.string(),
  hsnSnapshot: z.string(),
  unit: z.string(),
  qty,
  baseQty: z.number().positive(),
  referenceRatePaise: nonNegPaise, // reference only — no GST (BR-DN-02)
});
export const deliveryNoteSchema = entity.merge(softDelete).extend({
  number: z.string(),
  fy: z.string(),
  seq: z.number().int().positive(),
  date: businessDate,
  locationId: z.string().min(1),
  customerId: z.string().nullable(),
  customerSnapshot,
  lines: z.array(deliveryNoteLineSchema).min(1).max(500),
  referenceValuePaise: nonNegPaise,
  status: z.enum(DELIVERY_NOTE_STATUSES),
  invoiceId: z.string().nullable(),
  returnedAt: z.number().int().nullable(),
  notes: z.string().default(''),
});
export type DeliveryNote = z.infer<typeof deliveryNoteSchema>;

export const creditNoteSchema = entity.merge(softDelete).extend({
  number: z.string(),
  fy: z.string(),
  seq: z.number().int().positive(),
  date: businessDate,
  locationId: z.string().min(1),
  invoiceId: z.string().min(1),
  invoiceNumber: z.string(),
  customerId: z.string().nullable(),
  customerSnapshot,
  taxType: z.enum(TAX_TYPES),
  gstApplicable: z.boolean(), // inherited (BR-CN-02)
  restock: z.boolean(),
  lines: z.array(invoiceLineSchema.extend({ invoiceLineId: z.string() }).omit({ skipStockDeduction: true })).min(1),
  subtotalPaise: paise,
  cgstPaise: nonNegPaise,
  sgstPaise: nonNegPaise,
  igstPaise: nonNegPaise,
  taxPaise: nonNegPaise,
  roundOffPaise: paise,
  grandTotalPaise: paise,
  reason: z.string().default(''),
});
export type CreditNote = z.infer<typeof creditNoteSchema>;

export const debitNoteLineSchema = z.object({
  purchaseLineId: z.string(),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  nameSnapshot: z.string(),
  qty,
  baseQty: z.number().positive(),
  ratePaise: nonNegPaise,
  amountPaise: nonNegPaise,
});
export const debitNoteSchema = entity.merge(softDelete).extend({
  number: z.string(),
  fy: z.string(),
  seq: z.number().int().positive(),
  date: businessDate,
  locationId: z.string().min(1),
  purchaseId: z.string().min(1),
  supplierId: z.string().min(1),
  supplierSnapshot: z.object({ name: z.string(), gstin: z.string() }),
  restock: z.boolean(),
  lines: z.array(debitNoteLineSchema).min(1),
  totalPaise: nonNegPaise, // no GST math (BR-DBN-02)
  reason: z.string().default(''),
});
export type DebitNote = z.infer<typeof debitNoteSchema>;
