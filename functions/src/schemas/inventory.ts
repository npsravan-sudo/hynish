/**
 * Callable request schemas for Inventory operations (Phase 6). Every stock mutation is a
 * server-authoritative callable; the client submits business inputs + businessId + requestId. The
 * server records immutable movements and updates derived levels atomically.
 */
import { z } from 'zod';
import { ADJ_CATEGORIES, isValidBusinessDate } from '@hynish/domain';

const businessId = z.string().min(1);
const requestId = z.string().min(1).max(200);
const date = z.string().refine(isValidBusinessDate, 'Invalid date');
const posQty = z.number().positive();
const negConfirm = z.array(z.enum(['NEGATIVE_STOCK'])).default([]);

/** Manual stock adjustment (BR-STK-07): qty>0, direction, reason category + note. */
export const recordStockAdjustmentRequest = z.object({
  businessId,
  date,
  productId: z.string().min(1),
  variantId: z.string().min(1),
  locationId: z.string().min(1),
  direction: z.enum(['in', 'out']),
  qty: posQty,
  reasonCategory: z.enum(ADJ_CATEGORIES),
  note: z.string().default(''),
  requestId,
  confirmations: negConfirm,
});
export type RecordStockAdjustmentRequest = z.infer<typeof recordStockAdjustmentRequest>;

/** Stock transfer (BR-STK-08): source ≠ destination, ≥1 item, qty>0; atomic out + in. */
export const transferStockRequest = z.object({
  businessId,
  date,
  fromLocationId: z.string().min(1),
  toLocationId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().min(1),
    qty: posQty,
    nameSnapshot: z.string().default(''),
  })).min(1).max(500),
  notes: z.string().default(''),
  requestId,
  confirmations: negConfirm,
}).refine((t) => t.fromLocationId !== t.toLocationId, 'Source and destination must differ');
export type TransferStockRequest = z.infer<typeof transferStockRequest>;

/** Physical stock count (BR-STK-10): server recomputes system qty + diff at apply time. */
export const finalizeStockCountRequest = z.object({
  businessId,
  date,
  locationId: z.string().min(1),
  notes: z.string().default(''),
  lines: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().min(1),
    countedQty: z.number().nonnegative(),
  })).min(1).max(500),
  requestId,
});
export type FinalizeStockCountRequest = z.infer<typeof finalizeStockCountRequest>;

/** Opening stock (BR-STK-11/15): opening movements for a location. */
export const postOpeningStockRequest = z.object({
  businessId,
  date,
  locationId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().min(1),
    qty: posQty,
  })).min(1).max(500),
  notes: z.string().default(''),
  requestId,
});
export type PostOpeningStockRequest = z.infer<typeof postOpeningStockRequest>;
