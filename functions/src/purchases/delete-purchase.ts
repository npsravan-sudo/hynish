/**
 * deletePurchase (BR-PUR-06, §45). purchases.delete only. In one transaction: reverse stock
 * (`purchase_reversal` per line at the purchase's location), void the purchase journal and every
 * payment journal for it, then soft-delete. Reversing may drive a cell negative if the goods were
 * already sold — that needs stock.overrideNegative + a NEGATIVE_STOCK confirmation (BR-STK-06).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess, hasPermission } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { updateAudit, logActivity } from '../masterdata/common.js';
import { readPostedJournalsForRef, voidEntries } from '../accounting/post-core.js';
import { applyMovementTx, readLevelTx } from '../inventory/stock-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { deletePurchaseRequest } from '../schemas/purchases.js';

export const deletePurchase = defineCallable(deletePurchaseRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'purchases.delete');

  const b = input.businessId;
  const ref = db.doc(`businesses/${b}/purchases/${input.id}`);

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ ok: boolean }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const snap = await tx.get(ref);
    if (!snap.exists) throw appError('NOT_FOUND', 'Purchase not found.');
    const pur = snap.data()!;
    if (pur.deletedAt != null) return { ok: true };
    assertLocationAccess(actor.member, pur.locationId);

    // READS: posted journals (purchase + its payments) and current levels for each line.
    const refs = [...(await readPostedJournalsForRef(tx, db, b, 'purchase', input.id))];
    const paySnap = await tx.get(db.collection(`businesses/${b}/payments`).where('targetType', '==', 'purchase').where('targetId', '==', input.id));
    for (const p of paySnap.docs) refs.push(...(await readPostedJournalsForRef(tx, db, b, 'payment_out', p.id)));

    const lines: { productId: string; variantId: string; baseQty: number }[] = pur.lines ?? [];
    const levels = new Map<string, number>();
    for (const l of lines) {
      const key = `${l.productId}_${l.variantId}`;
      if (!levels.has(key)) levels.set(key, await readLevelTx(tx, db, b, l.productId, l.variantId, pur.locationId));
    }

    const allowNegative = input.confirmations.includes('NEGATIVE_STOCK') && hasPermission(actor.member, 'stock.overrideNegative');

    // WRITES: reverse stock, void journals, soft-delete.
    for (const l of lines) {
      const key = `${l.productId}_${l.variantId}`;
      const current = levels.get(key)!;
      const { qtyAfter } = applyMovementTx(tx, db, {
        businessId: b, date: pur.date, productId: l.productId, variantId: l.variantId,
        locationId: pur.locationId, type: 'purchase_reversal', qtyChange: -l.baseQty,
        refType: 'purchase', refId: input.id, note: 'Purchase deleted', actorUid: actor.uid,
        allowNegative,
      }, current);
      levels.set(key, qtyAfter);
    }
    voidEntries(tx, refs, actor.uid, 'delete');
    tx.set(ref, { deletedAt: FieldValue.serverTimestamp(), deletedBy: actor.uid, ...updateAudit(actor.uid) }, { merge: true });

    logActivity(db, (r, d) => tx.set(r, d), actor, 'delete', { type: 'purchase', id: input.id, label: pur.supplierBillNo || input.id }, pur.locationId);

    const out = { ok: true };
    writeIdempotentResult(tx, db, b, input.requestId, 'deletePurchase', out, actor.uid);
    return out;
  });

  return result;
});
