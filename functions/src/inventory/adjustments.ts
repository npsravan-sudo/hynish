/**
 * recordStockAdjustment (BR-STK-07, §28, §29). stock.adjust only. A manual in/out adjustment with a
 * required reason category + note, recorded as an immutable `adjustment` movement. Going negative
 * needs stock.overrideNegative + a NEGATIVE_STOCK confirmation (BR-STK-06). Idempotent; audited.
 */
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess, hasPermission } from '../auth/authorize.js';
import { logActivity } from '../masterdata/common.js';
import { applyMovementTx, readLevelTx } from './stock-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { recordStockAdjustmentRequest } from '../schemas/inventory.js';

export const recordStockAdjustment = defineCallable(recordStockAdjustmentRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'stock.adjust');
  assertLocationAccess(actor.member, input.locationId);

  const b = input.businessId;
  const qtyChange = input.direction === 'in' ? input.qty : -input.qty;
  const allowNegative = input.confirmations.includes('NEGATIVE_STOCK') && hasPermission(actor.member, 'stock.overrideNegative');

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ movementId: string; qtyAfter: number }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const current = await readLevelTx(tx, db, b, input.productId, input.variantId, input.locationId);
    const res = applyMovementTx(tx, db, {
      businessId: b, date: input.date, productId: input.productId, variantId: input.variantId,
      locationId: input.locationId, type: 'adjustment', qtyChange,
      reasonCategory: input.reasonCategory, note: input.note,
      refType: 'adjustment', refId: null, actorUid: actor.uid, allowNegative,
    }, current);

    logActivity(db, (r, d) => tx.set(r, d), actor, 'update', { type: 'stock_adjustment', id: res.movementId, label: `${input.direction} ${input.qty}` }, input.locationId);
    writeIdempotentResult(tx, db, b, input.requestId, 'recordStockAdjustment', res, actor.uid);
    return res;
  });

  return result;
});
