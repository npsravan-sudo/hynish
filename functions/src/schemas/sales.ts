/**
 * Callable request schemas for Sales (Phase 5). The client submits business inputs + a businessId +
 * an idempotency requestId; it never sends authoritative money (tax/grandTotal) — the server
 * recomputes those from master data (§23, §56). Location, permission and ownership are enforced
 * server-side; the client cannot widen its own access via the payload.
 */
import { z } from 'zod';
import { createInvoiceSchema, createQuotationSchema, createPaymentSchema } from '@hynish/domain';

const businessId = z.string().min(1);
const requestId = z.string().min(1).max(200);

export const finalizeInvoiceRequest = createInvoiceSchema.extend({
  businessId,
  /** Present on edit; absent on create. */
  id: z.string().min(1).optional(),
  requestId,
  /** A past-month edit shows a non-blocking warning the client must acknowledge (BR-INV-10). */
  acknowledgePastMonth: z.boolean().default(false),
});
export type FinalizeInvoiceRequest = z.infer<typeof finalizeInvoiceRequest>;

export const saveQuotationRequest = createQuotationSchema.extend({
  businessId,
  id: z.string().min(1).optional(),
  requestId,
});
export type SaveQuotationRequest = z.infer<typeof saveQuotationRequest>;

export const recordPaymentRequest = createPaymentSchema.extend({
  businessId,
  requestId,
});
export type RecordPaymentRequest = z.infer<typeof recordPaymentRequest>;

/** Delete = soft-delete + void journals + revert source (BR-INV-13). No legacy "restore" exists. */
export const deleteInvoiceRequest = z.object({
  businessId,
  id: z.string().min(1),
  requestId,
});
export type DeleteInvoiceRequest = z.infer<typeof deleteInvoiceRequest>;
