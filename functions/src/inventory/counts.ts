/**
 * finalizeStockCount (BR-STK-10, §30, §31). stock.count only. The diff is recomputed against LIVE
 * stock at apply time (not the diff the client computed earlier). Each changed line becomes an
 * `adjustment` movement with reason `correction` that sets the cell to the counted quantity. A count
 * with zero net changes is rejected. A summary stockCount record is kept. Idempotent; audited.
 */
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { createAudit, logActivity } from '../masterdata/common.js';
import { applyMovementTx, readLevelTx } from './stock-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { finalizeStockCountRequest } from '../schemas/inventory.js';

export const finalizeStockCount = defineCallable(finalizeStockCountRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'stock.count');
  assertLocationAccess(actor.member, input.locationId);

  const b = input.businessId;

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ stockCountId: string; changedCount: number }>(tx, db, b, input.requestId);
    if (cached) return cached;

    // READ live system quantities and recompute diffs (BR-STK-10 [FIX]).
    const rows = [];
    for (const l of input.lines) {
      const systemQty = await readLevelTx(tx, db, b, l.productId, l.variantId, input.locationId);
      rows.push({ ...l, systemQty, diff: l.countedQty - systemQty });
    }
    const changed = rows.filter((r) => r.diff !== 0);
    if (changed.length === 0) throw appError('VALIDATION_FAILED', 'The count has no differences to apply.'); // BR-STK-10

    // WRITE a summary record then a correction movement per changed line.
    const countRef = db.collection(`businesses/${b}/stockCounts`).doc();
    tx.set(countRef, {
      id: countRef.id, businessId: b, date: input.date, locationId: input.locationId, notes: input.notes,
      lines: rows.map((r) => ({ productId: r.productId, variantId: r.variantId, systemQty: r.systemQty, countedQty: r.countedQty, diff: r.diff })),
      changedCount: changed.length, ...createAudit(actor.uid),
    });
    for (const r of changed) {
      applyMovementTx(tx, db, {
        businessId: b, date: input.date, productId: r.productId, variantId: r.variantId,
        locationId: input.locationId, type: 'adjustment', qtyChange: r.diff, reasonCategory: 'correction',
        note: `Stock count correction`, refType: 'stock_count', refId: countRef.id, actorUid: actor.uid,
        allowNegative: true, // counted quantity is non-negative, so the resulting level cannot be negative
      }, r.systemQty);
    }

    logActivity(db, (r, d) => tx.set(r, d), actor, 'finalize', { type: 'stock_count', id: countRef.id, label: `${changed.length} change(s)` }, input.locationId);
    const res = { stockCountId: countRef.id, changedCount: changed.length };
    writeIdempotentResult(tx, db, b, input.requestId, 'finalizeStockCount', res, actor.uid);
    return res;
  });

  return result;
});
