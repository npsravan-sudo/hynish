/**
 * transferStock (BR-STK-08, §25, §26, §27). stock.transfer only, with access to BOTH locations.
 * Atomic: `transfer_out` at the source and `transfer_in` at the destination for every item, in ONE
 * transaction — never one side without the other. Source ≠ destination. A source shortage may drive
 * a cell negative, which needs stock.overrideNegative + a NEGATIVE_STOCK confirmation. Idempotent.
 */
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess, hasPermission } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { createAudit, logActivity } from '../masterdata/common.js';
import { applyMovementTx, readLevelTx } from './stock-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { transferStockRequest } from '../schemas/inventory.js';

export const transferStock = defineCallable(transferStockRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'stock.transfer');
  assertLocationAccess(actor.member, input.fromLocationId);
  assertLocationAccess(actor.member, input.toLocationId);
  if (input.fromLocationId === input.toLocationId) throw appError('VALIDATION_FAILED', 'Source and destination must differ.');

  const b = input.businessId;
  const allowNegative = input.confirmations.includes('NEGATIVE_STOCK') && hasPermission(actor.member, 'stock.overrideNegative');

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ transferId: string }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const transferRef = db.collection(`businesses/${b}/stockTransfers`).doc();

    // READ current levels for both sides first.
    const fromLevels = new Map<string, number>();
    const toLevels = new Map<string, number>();
    for (const it of input.items) {
      const key = `${it.productId}_${it.variantId}`;
      if (!fromLevels.has(key)) fromLevels.set(key, await readLevelTx(tx, db, b, it.productId, it.variantId, input.fromLocationId));
      if (!toLevels.has(key)) toLevels.set(key, await readLevelTx(tx, db, b, it.productId, it.variantId, input.toLocationId));
    }

    // WRITE the transfer record then both movements per item.
    tx.set(transferRef, {
      id: transferRef.id, businessId: b, date: input.date,
      fromLocationId: input.fromLocationId, toLocationId: input.toLocationId,
      items: input.items, notes: input.notes, shortagesOverridden: allowNegative,
      ...createAudit(actor.uid),
    });

    for (const it of input.items) {
      const key = `${it.productId}_${it.variantId}`;
      const out = applyMovementTx(tx, db, {
        businessId: b, date: input.date, productId: it.productId, variantId: it.variantId,
        locationId: input.fromLocationId, type: 'transfer_out', qtyChange: -it.qty,
        refType: 'transfer', refId: transferRef.id, actorUid: actor.uid, allowNegative,
      }, fromLevels.get(key)!);
      fromLevels.set(key, out.qtyAfter);
      const inn = applyMovementTx(tx, db, {
        businessId: b, date: input.date, productId: it.productId, variantId: it.variantId,
        locationId: input.toLocationId, type: 'transfer_in', qtyChange: it.qty,
        refType: 'transfer', refId: transferRef.id, actorUid: actor.uid,
      }, toLevels.get(key)!);
      toLevels.set(key, inn.qtyAfter);
    }

    logActivity(db, (r, d) => tx.set(r, d), actor, 'update', { type: 'stock_transfer', id: transferRef.id, label: `${input.items.length} item(s)` }, input.fromLocationId);
    const res = { transferId: transferRef.id };
    writeIdempotentResult(tx, db, b, input.requestId, 'transferStock', res, actor.uid);
    return res;
  });

  return result;
});
