/** Inventory schemas: StockLevel, StockMovement, StockTransfer, StockCount (DATA-MODEL §6.8–6.11). */
import { z } from 'zod';
import { STOCK_MOVEMENT_TYPES, ADJ_CATEGORIES } from '../inventory.js';
import { entity, nonNegPaise, businessDate, epochMs } from './common.js';

/** Server-owned derived balance per (product, variant, location). */
export const stockLevelSchema = z.object({
  businessId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  locationId: z.string().min(1),
  qty: z.number(), // base units; may be negative (override, BR-STK-06)
  lastMovementId: z.string(),
  updatedAt: epochMs,
  schemaVersion: z.number().int().positive(),
});
export type StockLevel = z.infer<typeof stockLevelSchema>;

/** Immutable, append-only movement (BR-STK-02). Never updated or deleted. */
export const stockMovementSchema = z.object({
  id: z.string().min(1),
  businessId: z.string().min(1),
  date: businessDate,
  productId: z.string().min(1),
  variantId: z.string().min(1),
  locationId: z.string().min(1),
  type: z.enum(STOCK_MOVEMENT_TYPES),
  qtyChange: z.number(), // signed, base units
  qtyAfter: z.number(),
  reasonCategory: z.enum(ADJ_CATEGORIES).nullable(),
  note: z.string().default(''),
  refType: z.string().nullable(),
  refId: z.string().nullable(),
  enteredUnit: z.string().nullable(),
  enteredQty: z.number().nullable(),
  unitCostPaise: nonNegPaise.nullable(),
  createdAt: epochMs,
  createdBy: z.string(),
  schemaVersion: z.number().int().positive(),
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

export const stockTransferSchema = entity.extend({
  date: businessDate,
  fromLocationId: z.string().min(1),
  toLocationId: z.string().min(1),
  notes: z.string().default(''),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        qty: z.number().positive(),
        nameSnapshot: z.string(),
      }),
    )
    .min(1),
  shortagesOverridden: z.boolean().default(false),
}).refine((t) => t.fromLocationId !== t.toLocationId, 'Source and destination must differ'); // BR-STK-08
export type StockTransfer = z.infer<typeof stockTransferSchema>;

export const stockCountSchema = entity.extend({
  date: businessDate,
  locationId: z.string().min(1),
  notes: z.string().default(''),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        systemQty: z.number(),
        countedQty: z.number().nonnegative(),
        diff: z.number(),
      }),
    )
    .min(1)
    .max(500),
  changedCount: z.number().int().positive(), // zero-difference count rejected (BR-STK-10)
});
export type StockCount = z.infer<typeof stockCountSchema>;
