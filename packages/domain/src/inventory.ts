/**
 * Inventory domain (BR-STK-01..15, LEGACY-COMPATIBILITY §11/§12). Pure, deterministic.
 * Stock is per (product, variant, location). Movements form an append-only, immutable audit
 * ledger — the balance is derived from movements, not the other way round. Stock shortage is a
 * WARNING, never a hard block (BR-STK-06, §25). Low-stock default is 5 (BR-STK-04, §26).
 */
import { DEFAULT_LOW_STOCK_THRESHOLD } from './constants.js';

/** All stock movement types (BR-STK-02, TD §4.3). Immutable once created. */
export const STOCK_MOVEMENT_TYPES = [
  'opening',
  'adjustment',
  'purchase',
  'purchase_reversal',
  'transfer_out',
  'transfer_in',
  'sale',
  'sale_reversal',
  'delivery_out',
  'delivery_return',
  'sale_return', // credit-note restock (BR-CN-04)
  'purchase_return', // debit-note restock (BR-DBN-04)
  'migration_opening', // migration bridge (MIGRATION-PLAN §7)
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

/**
 * Adjustment reason categories. The exact legacy ADJ_CATEGORIES list is NOT VERIFIED (OQ-11);
 * `wastage` and `correction` are confirmed from TD §4.3/§4.7. This is the single place they are
 * defined — extend once the source list is confirmed.
 */
export const ADJ_CATEGORIES = ['wastage', 'correction', 'damage', 'theft', 'other'] as const;
export type AdjCategory = (typeof ADJ_CATEGORIES)[number];

/** Effective low-stock threshold: product override if positive, else the default of 5 (BR-STK-04). */
export function lowStockThreshold(productThreshold: number | null | undefined): number {
  return productThreshold && productThreshold > 0 ? productThreshold : DEFAULT_LOW_STOCK_THRESHOLD;
}

/** Stock status bucket at a location (BR-STK-05). */
export type StockStatus = 'out' | 'low' | 'healthy';
export function stockStatus(qty: number, productThreshold: number | null | undefined): StockStatus {
  if (qty <= 0) return 'out';
  return qty <= lowStockThreshold(productThreshold) ? 'low' : 'healthy';
}

export function isLowStock(qty: number, productThreshold: number | null | undefined): boolean {
  return qty <= lowStockThreshold(productThreshold);
}

/** Convert a quantity in an alternate unit back to base units (BR-STK, LEGACY §9). */
export function toBaseQty(qty: number, factor: number | null | undefined): number {
  return factor && factor > 0 ? qty * factor : qty;
}

export interface ShortageCheck {
  requestedBaseQty: number;
  availableBaseQty: number;
  hasShortage: boolean;
  shortfallBaseQty: number;
}

/**
 * Evaluate stock availability WITHOUT blocking (BR-STK-06, §25). Returns a shortage warning the
 * UI/server surfaces as a confirm-to-override; it is never a hard failure by itself.
 */
export function checkAvailability(requestedBaseQty: number, availableBaseQty: number): ShortageCheck {
  const shortfall = requestedBaseQty - availableBaseQty;
  return {
    requestedBaseQty,
    availableBaseQty,
    hasShortage: shortfall > 0,
    shortfallBaseQty: shortfall > 0 ? shortfall : 0,
  };
}

/** Movements that DECREASE stock (used by the future recordStockMovement gateway). */
export const OUTBOUND_MOVEMENTS: ReadonlySet<StockMovementType> = new Set<StockMovementType>([
  'sale', 'delivery_out', 'transfer_out', 'purchase_reversal', 'purchase_return',
]);
export function isOutbound(type: StockMovementType): boolean {
  return OUTBOUND_MOVEMENTS.has(type);
}

// ---- Server-authoritative inventory gateway (implemented as a Cloud Function) -------------
export interface RecordMovementRequest {
  businessId: string;
  productId: string;
  variantId: string;
  locationId: string;
  type: StockMovementType;
  qtyChangeBase: number; // signed, base units
  reasonCategory?: AdjCategory;
  note?: string;
  refType?: string;
  refId?: string;
}

/**
 * Contract for stock mutations (BR-STK-03). The implementation writes the stock level and an
 * immutable movement in ONE transaction; clients never write stock directly. `getStockBalance`
 * and `validateStockAvailability` support reads and the warning-based shortage flow.
 */
export interface InventoryService {
  recordStockMovement(request: RecordMovementRequest): Promise<{ movementId: string; qtyAfter: number }>;
  getStockBalance(businessId: string, productId: string, variantId: string, locationId: string): Promise<number>;
  validateStockAvailability(
    businessId: string,
    productId: string,
    variantId: string,
    locationId: string,
    requestedBaseQty: number,
  ): Promise<ShortageCheck>;
}
