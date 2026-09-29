/**
 * saveDebitNote (BR-DBN-01..04, TD §5.5, §6.1.5). The source's ONLY purchase-return mechanism —
 * there is no separate "Purchase Return" document (§68, do not invent). Issued against an existing
 * purchase; each line's debited quantity is clamped server-side to what's still eligible
 * (`[0, originalQty − alreadyDebitedQty]`, BR-DBN-01, same capping pattern as Credit Notes). No GST
 * math at all — `amount = qty × rate` (BR-DBN-02). Reverses Dr Accounts Payable / Cr Inventory
 * (BR-DBN-03) and, ONLY if `restock` is checked, removes the units from stock with a
 * `purchase_return` movement (BR-DBN-04) — this REMOVES stock (goods returned to the supplier), the
 * mirror of a Credit Note's restock which adds stock back. No edit/delete exists for a Debit Note in
 * the source — once issued it stands.
 */
import { journalLinesForDebitNote, clampEligibleQty } from '@hynish/domain';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess, hasPermission } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { createAudit, logActivity } from '../masterdata/common.js';
import { reserveNumberInTx } from '../numbering/reserve-core.js';
import { postJournalTx } from '../accounting/post-core.js';
import { applyMovementTx, readLevelTx } from '../inventory/stock-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { saveDebitNoteRequest } from '../schemas/purchases.js';

interface PurchaseLineData {
  lineId: string;
  productId: string;
  variantId: string;
  nameSnapshot: string;
  enteredQty: number;
  baseQty: number;
  ratePaise: number;
}

export const saveDebitNote = defineCallable(saveDebitNoteRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'debitNotes.manage');

  const b = input.businessId;
  const purchaseRef = db.doc(`businesses/${b}/purchases/${input.purchaseId}`);
  const col = db.collection(`businesses/${b}/debitNotes`);

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ debitNoteId: string; number: string }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const purSnap = await tx.get(purchaseRef);
    if (!purSnap.exists) throw appError('NOT_FOUND', 'Purchase not found.');
    const purchase = purSnap.data()!;
    if (purchase.deletedAt != null) throw appError('CONFLICT', 'This purchase was deleted.');
    if (purchase.locationId !== input.locationId) throw appError('LOCATION_DENIED', 'A debit note must be issued from the purchase’s own location.');
    assertLocationAccess(actor.member, purchase.locationId);

    const purchaseLines: PurchaseLineData[] = purchase.lines ?? [];
    const linesByLineId = new Map(purchaseLines.map((l) => [l.lineId, l] as const));

    // READ: prior debit notes against this purchase, to compute what's already been debited per line.
    const priorSnap = await tx.get(col.where('purchaseId', '==', input.purchaseId));
    const alreadyDebited = new Map<string, number>();
    for (const doc of priorSnap.docs) {
      for (const l of (doc.data().lines ?? []) as { purchaseLineId: string; qty: number }[]) {
        alreadyDebited.set(l.purchaseLineId, (alreadyDebited.get(l.purchaseLineId) ?? 0) + l.qty);
      }
    }

    const stockLevels = new Map<string, number>();
    if (input.restock) {
      for (const draft of input.lines) {
        const purLine = linesByLineId.get(draft.purchaseLineId);
        if (!purLine) continue;
        const key = `${purLine.productId}_${purLine.variantId}`;
        if (!stockLevels.has(key)) stockLevels.set(key, await readLevelTx(tx, db, b, purLine.productId, purLine.variantId, purchase.locationId));
      }
    }

    // ---- COMPUTE (pure — no writes yet) --------------------------------------------
    let totalPaise = 0;
    const lines: Record<string, unknown>[] = [];
    const restocks: { productId: string; variantId: string; baseQty: number }[] = [];
    for (const draft of input.lines) {
      const purLine = linesByLineId.get(draft.purchaseLineId);
      if (!purLine) throw appError('NOT_FOUND', `Purchase line not found: ${draft.purchaseLineId}`);
      const already = alreadyDebited.get(draft.purchaseLineId) ?? 0;
      const debitedQty = clampEligibleQty(purLine.enteredQty, already, draft.qty);
      if (debitedQty <= 0) continue;

      const baseQtyPerUnit = purLine.baseQty / purLine.enteredQty;
      const debitedBaseQty = Math.round(debitedQty * baseQtyPerUnit);
      const amountPaise = Math.round(debitedQty * purLine.ratePaise); // BR-DBN-02: amount = qty × rate, no GST
      totalPaise += amountPaise;

      lines.push({
        purchaseLineId: draft.purchaseLineId, productId: purLine.productId, variantId: purLine.variantId,
        nameSnapshot: purLine.nameSnapshot, qty: debitedQty, baseQty: debitedBaseQty,
        ratePaise: purLine.ratePaise, amountPaise,
      });
      if (input.restock) restocks.push({ productId: purLine.productId, variantId: purLine.variantId, baseQty: debitedBaseQty });
    }
    if (lines.length === 0) throw appError('VALIDATION_FAILED', 'Nothing eligible to debit-note on the selected lines.');

    // ---- WRITE PHASE ----------------------------------------------------------------
    const reserved = await reserveNumberInTx(tx, db, { businessId: b, seriesKey: 'debit_note', dateISO: input.date, actorUid: actor.uid });
    const ref = col.doc();

    if (input.restock) {
      const allowNegative = input.confirmations.includes('NEGATIVE_STOCK') && hasPermission(actor.member, 'stock.overrideNegative');
      for (const r of restocks) {
        const key = `${r.productId}_${r.variantId}`;
        const res = applyMovementTx(tx, db, {
          businessId: b, date: input.date, productId: r.productId, variantId: r.variantId,
          locationId: purchase.locationId, type: 'purchase_return', qtyChange: -r.baseQty,
          refType: 'debit_note', refId: ref.id, note: 'Debit note — returned to supplier', actorUid: actor.uid,
          allowNegative,
        }, stockLevels.get(key)!);
        stockLevels.set(key, res.qtyAfter);
      }
    }

    tx.set(ref, {
      id: ref.id, businessId: b, number: reserved.number, fy: reserved.fy, seq: reserved.seq,
      date: input.date, locationId: purchase.locationId, purchaseId: input.purchaseId,
      supplierId: purchase.supplierId, supplierSnapshot: purchase.supplierSnapshot,
      restock: input.restock, lines, totalPaise, reason: input.reason,
      ...createAudit(actor.uid),
    });

    // Accounting (BR-DBN-03): Dr Accounts Payable / Cr Inventory.
    postJournalTx(tx, db, {
      businessId: b, date: input.date, locationId: purchase.locationId,
      refType: 'debit_note', refId: ref.id, refLabel: reserved.number,
      lines: journalLinesForDebitNote(totalPaise),
      actorUid: actor.uid,
    });

    logActivity(db, (r, d) => tx.set(r, d), actor, 'create', { type: 'debit_note', id: ref.id, label: reserved.number }, purchase.locationId);

    const out = { debitNoteId: ref.id, number: reserved.number };
    writeIdempotentResult(tx, db, b, input.requestId, 'saveDebitNote', out, actor.uid);
    return out;
  });

  return result;
});
