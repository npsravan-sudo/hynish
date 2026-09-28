/**
 * finalizePurchase (§6, §8–§13, §34, §37, BR-PUR-01..07). Server-authoritative, atomic, idempotent.
 * In one transaction: recompute line amounts + total (Σ qty×rate — purchases carry NO GST, BR-PUR-08),
 * write the purchase doc (no document number; it references the supplier's bill number), add stock
 * (`purchase` movement per line at the location, BR-PUR-03), update the product's `purchasePrice` for
 * base-unit lines only (BR-PUR-05 — this is the cost basis Phase 5 COGS snapshots read), post the
 * purchase journal (Dr Inventory total / Cr Cash paidNow / Cr AP remainder, BR-PUR-04), set the
 * payable state, and audit. Purchases never go negative (stock-in only).
 */
import {
  toBaseQty, derivePaymentStatus, outstandingOf, journalLinesForPurchase, newId,
} from '@hynish/domain';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { createAudit, updateAudit, logActivity } from '../masterdata/common.js';
import { postJournalTx } from '../accounting/post-core.js';
import { applyMovementTx, readLevelTx } from '../inventory/stock-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { finalizePurchaseRequest } from '../schemas/purchases.js';

export const finalizePurchase = defineCallable(finalizePurchaseRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'purchases.manage');
  assertLocationAccess(actor.member, input.locationId);

  const b = input.businessId;

  const result = await db.runTransaction(async (tx) => {
    // ---- READ PHASE ----
    const cached = await readIdempotentResult<{ purchaseId: string }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const supplierSnap = await tx.get(db.doc(`businesses/${b}/suppliers/${input.supplierId}`));
    if (!supplierSnap.exists || supplierSnap.data()!.deletedAt != null) throw appError('NOT_FOUND', 'Supplier not found.');
    const supplier = supplierSnap.data()!;

    const uniqueProductIds = [...new Set(input.lines.map((l) => l.productId))];
    const productSnaps = await Promise.all(uniqueProductIds.map((pid) => tx.get(db.doc(`businesses/${b}/products/${pid}`))));
    const products = new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!] as const));

    // Current levels for each (product,variant) at this location (read before any write).
    const levelKeys = input.lines.map((l) => `${l.productId}_${l.variantId}`);
    const levels = new Map<string, number>();
    for (const l of input.lines) {
      const key = `${l.productId}_${l.variantId}`;
      if (!levels.has(key)) levels.set(key, await readLevelTx(tx, db, b, l.productId, l.variantId, input.locationId));
    }

    // ---- COMPUTE ----
    const purchaseRef = db.collection(`businesses/${b}/purchases`).doc();
    const builtLines = input.lines.map((l) => {
      const p = products.get(l.productId);
      if (!p || p.deletedAt != null) throw appError('NOT_FOUND', `Product not found: ${l.productId}`);
      const variant = (p.variants ?? []).find((v: { id: string }) => v.id === l.variantId);
      if (!variant) throw appError('NOT_FOUND', `Variant not found: ${l.variantId}`);
      if (!(l.enteredQty > 0)) throw appError('VALIDATION_FAILED', 'Quantity must be greater than zero.'); // BR-PUR-01
      const factor = (p.altUnits ?? []).find((a: { name: string }) => a.name === l.enteredUnit)?.factor;
      const baseQty = toBaseQty(l.enteredQty, factor);
      const amountPaise = Math.round(l.ratePaise * l.enteredQty);
      const isBaseUnit = l.enteredUnit === p.unit;
      return { l, p, baseQty, amountPaise, isBaseUnit, nameSnapshot: p.name };
    });
    const totalPaise = builtLines.reduce((s, x) => s + x.amountPaise, 0);
    const initialPaidPaise = Math.max(0, Math.min(Math.trunc(input.initialPaidPaise), totalPaise));
    const paidPaise = initialPaidPaise;
    const outstandingPaise = outstandingOf(totalPaise, paidPaise);
    const paymentStatus = derivePaymentStatus(totalPaise, paidPaise);

    // ---- WRITE PHASE ----
    const lines = builtLines.map((x) => ({
      lineId: newId(),
      productId: x.l.productId,
      variantId: x.l.variantId,
      nameSnapshot: x.nameSnapshot,
      enteredUnit: x.l.enteredUnit,
      enteredQty: x.l.enteredQty,
      baseQty: x.baseQty,
      ratePaise: x.l.ratePaise,
      amountPaise: x.amountPaise,
    }));

    tx.set(purchaseRef, {
      id: purchaseRef.id, businessId: b, date: input.date, locationId: input.locationId,
      supplierId: input.supplierId, supplierSnapshot: { name: supplier.name ?? '', gstin: supplier.gstin ?? '' },
      supplierBillNo: input.supplierBillNo, lines, totalPaise,
      initialPaidPaise, paidPaise, outstandingPaise, paymentStatus,
      dueDate: input.dueDate ?? null, notes: input.notes, ...createAudit(actor.uid),
    });

    // Stock IN per line (BR-PUR-03); update purchasePrice for base-unit lines (BR-PUR-05).
    for (const x of builtLines) {
      const key = `${x.l.productId}_${x.l.variantId}`;
      const current = levels.get(key)!;
      const { qtyAfter } = applyMovementTx(tx, db, {
        businessId: b, date: input.date, productId: x.l.productId, variantId: x.l.variantId,
        locationId: input.locationId, type: 'purchase', qtyChange: x.baseQty,
        refType: 'purchase', refId: purchaseRef.id,
        enteredUnit: x.l.enteredUnit, enteredQty: x.l.enteredQty,
        unitCostPaise: x.l.ratePaise, actorUid: actor.uid,
      }, current);
      levels.set(key, qtyAfter); // subsequent same-cell lines stack correctly
      if (x.isBaseUnit) {
        tx.set(db.doc(`businesses/${b}/products/${x.l.productId}`), { purchasePricePaise: x.l.ratePaise, ...updateAudit(actor.uid) }, { merge: true });
      }
    }

    // Accounting: Dr Inventory total / Cr Cash paidNow / Cr AP remainder (BR-PUR-04). No GST.
    postJournalTx(tx, db, {
      businessId: b, date: input.date, locationId: input.locationId,
      refType: 'purchase', refId: purchaseRef.id, refLabel: input.supplierBillNo || purchaseRef.id,
      lines: journalLinesForPurchase(totalPaise, initialPaidPaise), actorUid: actor.uid,
    });

    logActivity(db, (r, d) => tx.set(r, d), actor, 'finalize', { type: 'purchase', id: purchaseRef.id, label: input.supplierBillNo || purchaseRef.id }, input.locationId);

    const out = { purchaseId: purchaseRef.id };
    writeIdempotentResult(tx, db, b, input.requestId, 'finalizePurchase', out, actor.uid);
    void levelKeys;
    return out;
  });

  return result;
});
