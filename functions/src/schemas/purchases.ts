/**
 * Callable request schemas for Purchases (Phase 6). Purchases carry no GST and no document number
 * (they reference the supplier's bill number). The client submits business inputs + businessId +
 * an idempotency requestId; the server computes amounts, totals, stock-in and the payable state.
 */
import { z } from 'zod';
import { createPurchaseSchema } from '@hynish/domain';

const businessId = z.string().min(1);
const requestId = z.string().min(1).max(200);

export const finalizePurchaseRequest = createPurchaseSchema.extend({
  businessId,
  requestId,
});
export type FinalizePurchaseRequest = z.infer<typeof finalizePurchaseRequest>;

export const deletePurchaseRequest = z.object({
  businessId,
  id: z.string().min(1),
  requestId,
  /** Reversing stock may drive a cell negative if the goods were already sold (BR-PUR-06). */
  confirmations: z.array(z.enum(['NEGATIVE_STOCK'])).default([]),
});
export type DeletePurchaseRequest = z.infer<typeof deletePurchaseRequest>;
