/**
 * Stock ledger core (BR-STK-01/02/03, §4, §15, §16, §17, §18). The ONE place stock changes: within a
 * caller-provided transaction it reads the current level, appends an IMMUTABLE movement, and upserts
 * the derived stockLevel — never the balance alone. The movement ledger is the source of truth; the
 * level is a performance cache kept in lock-step. Reads-before-writes: call `readLevelTx` in the read
 * phase, `applyMovementTx` in the write phase (it does a read of the level it is about to write, which
 * must precede any other write in the transaction).
 *
 * Negative stock is a controlled override (BR-STK-06): a caller must both hold `stock.overrideNegative`
 * AND pass an explicit confirmation before a movement may drive a level below zero.
 */
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import type { StockMovementType, AdjCategory } from '@hynish/domain';
import { appError } from '../utils/errors.js';

/** Deterministic level doc id per (product, variant, location). */
export function stockLevelId(productId: string, variantId: string, locationId: string): string {
  return `${productId}_${variantId}_${locationId}`;
}

export interface ApplyMovementInput {
  businessId: string;
  date: string;
  productId: string;
  variantId: string;
  locationId: string;
  type: StockMovementType;
  qtyChange: number; // signed, base units
  reasonCategory?: AdjCategory | null;
  note?: string;
  refType?: string | null;
  refId?: string | null;
  enteredUnit?: string | null;
  enteredQty?: number | null;
  unitCostPaise?: number | null;
  actorUid: string;
  /** True when the actor holds stock.overrideNegative AND confirmed going negative. */
  allowNegative?: boolean;
}

/** READ PHASE: current base-unit balance for a cell (0 when none). */
export async function readLevelTx(
  tx: Transaction,
  db: Firestore,
  businessId: string,
  productId: string,
  variantId: string,
  locationId: string,
): Promise<number> {
  const ref = db.doc(`businesses/${businessId}/stockLevels/${stockLevelId(productId, variantId, locationId)}`);
  const snap = await tx.get(ref);
  return snap.exists ? Number(snap.data()?.qty ?? 0) : 0;
}

/**
 * WRITE PHASE: append a movement and update the level. `current` is the balance read earlier in the
 * SAME transaction (pass the result of readLevelTx). Refuses to go negative unless allowNegative.
 * Returns the new movement id and the resulting balance.
 */
export function applyMovementTx(
  tx: Transaction,
  db: Firestore,
  input: ApplyMovementInput,
  current: number,
): { movementId: string; qtyAfter: number } {
  const qtyAfter = current + input.qtyChange;
  if (qtyAfter < 0 && !input.allowNegative) {
    throw appError('NEGATIVE_STOCK', 'This would take stock below zero.');
  }

  const movementRef = db.collection(`businesses/${input.businessId}/stockMovements`).doc();
  tx.set(movementRef, {
    id: movementRef.id,
    businessId: input.businessId,
    date: input.date,
    productId: input.productId,
    variantId: input.variantId,
    locationId: input.locationId,
    type: input.type,
    qtyChange: input.qtyChange,
    qtyAfter,
    reasonCategory: input.reasonCategory ?? null,
    note: input.note ?? '',
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    enteredUnit: input.enteredUnit ?? null,
    enteredQty: input.enteredQty ?? null,
    unitCostPaise: input.unitCostPaise ?? null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: input.actorUid,
    schemaVersion: 1,
  });

  const levelRef = db.doc(`businesses/${input.businessId}/stockLevels/${stockLevelId(input.productId, input.variantId, input.locationId)}`);
  tx.set(levelRef, {
    businessId: input.businessId,
    productId: input.productId,
    variantId: input.variantId,
    locationId: input.locationId,
    qty: qtyAfter,
    lastMovementId: movementRef.id,
    updatedAt: FieldValue.serverTimestamp(),
    schemaVersion: 1,
  });

  return { movementId: movementRef.id, qtyAfter };
}
