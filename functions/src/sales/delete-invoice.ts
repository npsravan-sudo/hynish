/**
 * deleteInvoice (BR-INV-13, §39). Admin/owner only. In one transaction: void the invoice, COGS and
 * every payment journal for this invoice; revert a source quotation to `open` / a source DN to
 * `pending`; then SOFT-delete the invoice (its number stays reserved — the [FIX] over the legacy
 * hard delete). Physical stock restore is a Phase-6 boundary (§15/§29): each line already carries
 * baseQty + skipStockDeduction for the Inventory phase to restore movements inside this transaction.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { updateAudit, logActivity } from '../masterdata/common.js';
import { readPostedJournalsForRef, voidEntries } from '../accounting/post-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { deleteInvoiceRequest } from '../schemas/sales.js';

export const deleteInvoice = defineCallable(deleteInvoiceRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'sales.delete');

  const b = input.businessId;
  const ref = db.doc(`businesses/${b}/invoices/${input.id}`);

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ ok: boolean }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const snap = await tx.get(ref);
    if (!snap.exists) throw appError('NOT_FOUND', 'Invoice not found.');
    const inv = snap.data()!;
    if (inv.deletedAt != null) return { ok: true };
    assertLocationAccess(actor.member, inv.locationId);

    // READ all posted journals to void (invoice, COGS, and payments).
    const refs = [
      ...(await readPostedJournalsForRef(tx, db, b, 'invoice', input.id)),
      ...(await readPostedJournalsForRef(tx, db, b, 'invoice_cogs', input.id)),
    ];
    // Payment journals reference the payment id, not the invoice — collect via the payments query.
    const paySnap = await tx.get(
      db.collection(`businesses/${b}/payments`).where('targetType', '==', 'invoice').where('targetId', '==', input.id),
    );
    for (const p of paySnap.docs) {
      refs.push(...(await readPostedJournalsForRef(tx, db, b, 'payment_in', p.id)));
    }
    const source = inv.source as { type: 'quotation' | 'delivery_note'; id: string } | null;
    const sourceRef = source
      ? db.doc(`businesses/${b}/${source.type === 'quotation' ? 'quotations' : 'deliveryNotes'}/${source.id}`)
      : null;
    if (sourceRef) await tx.get(sourceRef);

    // WRITE: void journals, revert source, soft-delete the invoice.
    voidEntries(tx, refs, actor.uid, 'delete');
    if (sourceRef && source) {
      tx.set(sourceRef, source.type === 'quotation'
        ? { status: 'open', convertedInvoiceId: null, ...updateAudit(actor.uid) }
        : { status: 'pending', invoiceId: null, ...updateAudit(actor.uid) }, { merge: true });
    }
    tx.set(ref, { deletedAt: FieldValue.serverTimestamp(), deletedBy: actor.uid, ...updateAudit(actor.uid) }, { merge: true });

    logActivity(db, (r, d) => tx.set(r, d), actor, 'delete', { type: 'invoice', id: input.id, label: inv.number }, inv.locationId);

    const out = { ok: true };
    writeIdempotentResult(tx, db, b, input.requestId, 'deleteInvoice', out, actor.uid);
    return out;
  });

  return result;
});
