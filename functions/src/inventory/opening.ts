/**
 * postOpeningStock (BR-STK-11/15, §32). stock.adjust only. Records `opening` movements for a location
 * so opening balances always have history (never a silent write). Idempotent; audited.
 */
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess } from '../auth/authorize.js';
import { logActivity } from '../masterdata/common.js';
import { applyMovementTx, readLevelTx } from './stock-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { postOpeningStockRequest } from '../schemas/inventory.js';

export const postOpeningStock = defineCallable(postOpeningStockRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'stock.adjust');
  assertLocationAccess(actor.member, input.locationId);

  const b = input.businessId;

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ count: number }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const levels = new Map<string, number>();
    for (const it of input.items) {
      const key = `${it.productId}_${it.variantId}`;
      if (!levels.has(key)) levels.set(key, await readLevelTx(tx, db, b, it.productId, it.variantId, input.locationId));
    }
    for (const it of input.items) {
      const key = `${it.productId}_${it.variantId}`;
      const res = applyMovementTx(tx, db, {
        businessId: b, date: input.date, productId: it.productId, variantId: it.variantId,
        locationId: input.locationId, type: 'opening', qtyChange: it.qty,
        note: input.notes || 'Opening stock', refType: 'opening', refId: null, actorUid: actor.uid,
      }, levels.get(key)!);
      levels.set(key, res.qtyAfter);
    }

    logActivity(db, (r, d) => tx.set(r, d), actor, 'create', { type: 'opening_stock', id: input.requestId, label: `${input.items.length} item(s)` }, input.locationId);
    const out = { count: input.items.length };
    writeIdempotentResult(tx, db, b, input.requestId, 'postOpeningStock', out, actor.uid);
    return out;
  });

  return result;
});
