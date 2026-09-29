/**
 * saveDeliveryNote / markDeliveryNoteReturned (BR-DN-01..09, TD §5.5). "For goods leaving the shop
 * before a tax invoice is raised" — stock is deducted immediately (`delivery_out`) at the DN's
 * location; there is NO GST at all on a DN (BR-DN-02) and NO journal entry is posted for it
 * (BR-DN-09 — none documented). Lifecycle is `pending` → `invoiced` (via the existing
 * `finalizeInvoice({source:{type:'delivery_note',...}})` conversion path, unchanged from Phase 5,
 * which marks the DN `invoiced` and builds invoice lines with `skipStockDeduction:true` so stock
 * isn't deducted twice) → `returned` (restores stock, `delivery_return`). Only a `pending` DN may be
 * edited or marked returned (BR-DN-03).
 */
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { createAudit, updateAudit, logActivity } from '../masterdata/common.js';
import { reserveNumberInTx } from '../numbering/reserve-core.js';
import { applyMovementTx, readLevelTx } from '../inventory/stock-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { buildDeliveryNoteLines, type DraftDeliveryNoteLine, type ProductData } from './build-lines.js';
import { saveDeliveryNoteRequest, markDeliveryNoteReturnedRequest } from '../schemas/sales.js';

export const saveDeliveryNote = defineCallable(saveDeliveryNoteRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'deliveryNotes.manage');
  assertLocationAccess(actor.member, input.locationId);

  const b = input.businessId;
  const col = db.collection(`businesses/${b}/deliveryNotes`);
  const isEdit = Boolean(input.id);

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ deliveryNoteId: string; number: string }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const ref = isEdit ? col.doc(input.id!) : col.doc();
    const existingSnap = isEdit ? await tx.get(ref) : null;
    if (isEdit) {
      if (!existingSnap!.exists) throw appError('NOT_FOUND', 'Delivery note not found.');
      const ex = existingSnap!.data()!;
      if (ex.deletedAt != null) throw appError('CONFLICT', 'This delivery note was deleted.');
      if (ex.status !== 'pending') throw appError('CONFLICT', 'Only a pending delivery note can be edited.'); // BR-DN-03
      if (ex.locationId !== input.locationId) throw appError('LOCATION_DENIED', 'Switch to the delivery note’s location to edit it.');
      assertLocationAccess(actor.member, ex.locationId);
    }

    const uniqueProductIds = [...new Set(input.lines.map((l) => l.productId))];
    const productSnaps = await Promise.all(uniqueProductIds.map((pid) => tx.get(db.doc(`businesses/${b}/products/${pid}`))));
    const products = new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as ProductData] as const));

    let customerSnapshot: { name: string; gstin: string; stateCode: string | null; address: string; phone: string } | null = null;
    if (input.customerId) {
      const custSnap = await tx.get(db.doc(`businesses/${b}/customers/${input.customerId}`));
      if (!custSnap.exists || custSnap.data()!.deletedAt != null) throw appError('NOT_FOUND', 'Customer not found.');
      const c = custSnap.data()!;
      customerSnapshot = { name: c.name ?? '', gstin: c.gstin ?? '', stateCode: (c.stateCode as string | null) ?? null, address: c.address ?? '', phone: c.phone ?? '' };
    }

    const oldLines: { productId: string; variantId: string; baseQty: number }[] = isEdit ? (existingSnap!.data()!.lines ?? []) : [];
    const stockCells = new Map<string, number>();
    async function ensureCell(productId: string, variantId: string): Promise<void> {
      const key = `${productId}_${variantId}`;
      if (!stockCells.has(key)) stockCells.set(key, await readLevelTx(tx, db, b, productId, variantId, input.locationId));
    }
    for (const l of input.lines) await ensureCell(l.productId, l.variantId);
    for (const l of oldLines) await ensureCell(l.productId, l.variantId);

    const built = buildDeliveryNoteLines(input.lines as DraftDeliveryNoteLine[], products);

    // Stock shortage check (BR-DN-07, same as invoices): reverse OLD lines back first, then test.
    const sim = new Map(stockCells);
    for (const l of oldLines) sim.set(`${l.productId}_${l.variantId}`, (sim.get(`${l.productId}_${l.variantId}`) ?? 0) + l.baseQty);
    let shortage = false;
    for (const l of built.lines) {
      const key = `${l.productId}_${l.variantId}`;
      const next = (sim.get(key) ?? 0) - l.baseQty;
      sim.set(key, next);
      if (next < 0) shortage = true;
    }
    const stockConfirmed = input.confirmations.includes('STOCK_SHORTAGE');
    if (shortage && !stockConfirmed) throw appError('STOCK_SHORTAGE', 'One or more items do not have enough stock at this location.');

    let number: string; let fy: string; let seq: number;
    if (isEdit) {
      const ex = existingSnap!.data()!;
      number = ex.number; fy = ex.fy; seq = ex.seq;
    } else {
      const reserved = await reserveNumberInTx(tx, db, { businessId: b, seriesKey: 'delivery_note', dateISO: input.date, actorUid: actor.uid });
      number = reserved.number; fy = reserved.fy; seq = reserved.seq;
    }

    const body = {
      number, fy, seq, date: input.date, locationId: input.locationId,
      customerId: input.customerId, customerSnapshot, lines: built.lines,
      referenceValuePaise: built.referenceValuePaise, notes: input.notes,
    };

    if (isEdit) {
      tx.set(ref, { ...body, ...updateAudit(actor.uid) }, { merge: true });
    } else {
      tx.set(ref, { id: ref.id, businessId: b, ...body, status: 'pending', invoiceId: null, returnedAt: null, ...createAudit(actor.uid) });
    }

    // Stock (BR-DN-01/BR-STK-06): reverse old lines on edit, then deduct the new ones — undo-then-reapply.
    const run = new Map(stockCells);
    for (const l of oldLines) {
      const key = `${l.productId}_${l.variantId}`;
      const res = applyMovementTx(tx, db, {
        businessId: b, date: input.date, productId: l.productId, variantId: l.variantId,
        locationId: input.locationId, type: 'delivery_return', qtyChange: l.baseQty,
        refType: 'delivery_note', refId: ref.id, note: 'Delivery note edit — reverse', actorUid: actor.uid,
      }, run.get(key)!);
      run.set(key, res.qtyAfter);
    }
    for (const l of built.lines) {
      const key = `${l.productId}_${l.variantId}`;
      const res = applyMovementTx(tx, db, {
        businessId: b, date: input.date, productId: l.productId, variantId: l.variantId,
        locationId: input.locationId, type: 'delivery_out', qtyChange: -l.baseQty,
        refType: 'delivery_note', refId: ref.id, actorUid: actor.uid,
        allowNegative: stockConfirmed,
      }, run.get(key)!);
      run.set(key, res.qtyAfter);
    }

    logActivity(db, (r, d) => tx.set(r, d), actor, isEdit ? 'edit' : 'create', { type: 'delivery_note', id: ref.id, label: number }, input.locationId);

    const out = { deliveryNoteId: ref.id, number };
    writeIdempotentResult(tx, db, b, input.requestId, 'saveDeliveryNote', out, actor.uid);
    return out;
  });

  return result;
});

export const markDeliveryNoteReturned = defineCallable(markDeliveryNoteReturnedRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'deliveryNotes.manage');

  const b = input.businessId;
  const ref = db.doc(`businesses/${b}/deliveryNotes/${input.id}`);

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ ok: boolean }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const snap = await tx.get(ref);
    if (!snap.exists) throw appError('NOT_FOUND', 'Delivery note not found.');
    const dn = snap.data()!;
    if (dn.deletedAt != null) throw appError('NOT_FOUND', 'Delivery note not found.');
    if (dn.status !== 'pending') throw appError('CONFLICT', 'Only a pending delivery note can be marked returned.'); // BR-DN-03
    assertLocationAccess(actor.member, dn.locationId);

    const lines: { productId: string; variantId: string; baseQty: number }[] = dn.lines ?? [];
    const levels = new Map<string, number>();
    for (const l of lines) {
      const key = `${l.productId}_${l.variantId}`;
      if (!levels.has(key)) levels.set(key, await readLevelTx(tx, db, b, l.productId, l.variantId, dn.locationId));
    }

    for (const l of lines) {
      const key = `${l.productId}_${l.variantId}`;
      // A restock always adds (qtyChange > 0), so it can never drive a cell negative.
      const res = applyMovementTx(tx, db, {
        businessId: b, date: dn.date, productId: l.productId, variantId: l.variantId,
        locationId: dn.locationId, type: 'delivery_return', qtyChange: l.baseQty,
        refType: 'delivery_note', refId: input.id, note: 'Delivery note marked returned', actorUid: actor.uid,
      }, levels.get(key)!);
      levels.set(key, res.qtyAfter);
    }

    tx.set(ref, { status: 'returned', returnedAt: Date.now(), ...updateAudit(actor.uid) }, { merge: true });
    logActivity(db, (r, d) => tx.set(r, d), actor, 'update', { type: 'delivery_note', id: input.id, label: dn.number }, dn.locationId);

    const out = { ok: true };
    writeIdempotentResult(tx, db, b, input.requestId, 'markDeliveryNoteReturned', out, actor.uid);
    return out;
  });

  return result;
});
