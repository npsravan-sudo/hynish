/**
 * saveQuotation (§6, §7, §43). Quotations never touch stock or accounting (BR-QUO-02); they only
 * capture a priced offer. GST is always applied via the generic tax engine (§18) — there is no
 * Without-GST toggle. On create a QUO number is reserved server-side (BR-NUM-01/05); on edit the
 * number is preserved (BR-NUM-06). Totals are recomputed from master data; client money is ignored.
 */
import {
  taxTypeFor,
} from '@hynish/domain';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { createAudit, updateAudit, logActivity } from '../masterdata/common.js';
import { reserveNumberInTx } from '../numbering/reserve-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { buildLines, type DraftLine, type ProductData } from './build-lines.js';
import { saveQuotationRequest } from '../schemas/sales.js';

export const saveQuotation = defineCallable(saveQuotationRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'quotations.manage');
  assertLocationAccess(actor.member, input.locationId);

  const b = input.businessId;
  const col = db.collection(`businesses/${b}/quotations`);
  const isEdit = Boolean(input.id);

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ quotationId: string; number: string }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const ref = isEdit ? col.doc(input.id!) : col.doc();
    const existingSnap = isEdit ? await tx.get(ref) : null;
    if (isEdit) {
      if (!existingSnap!.exists) throw appError('NOT_FOUND', 'Quotation not found.');
      const ex = existingSnap!.data()!;
      if (ex.deletedAt != null) throw appError('CONFLICT', 'This quotation was deleted.');
      if (ex.status === 'converted') throw appError('CONFLICT', 'A converted quotation cannot be edited.');
      if (ex.locationId !== input.locationId) throw appError('LOCATION_DENIED', 'Switch to the quotation’s location to edit it.');
      assertLocationAccess(actor.member, ex.locationId);
    }

    const uniqueProductIds = [...new Set(input.lines.map((l) => l.productId))];
    const productSnaps = await Promise.all(uniqueProductIds.map((pid) => tx.get(db.doc(`businesses/${b}/products/${pid}`))));
    const products = new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as ProductData] as const));

    let customerSnapshot: { name: string; gstin: string; stateCode: string | null; address: string; phone: string } | null = null;
    let customerStateCode: string | null = null;
    if (input.customerId) {
      const custSnap = await tx.get(db.doc(`businesses/${b}/customers/${input.customerId}`));
      if (!custSnap.exists || custSnap.data()!.deletedAt != null) throw appError('NOT_FOUND', 'Customer not found.');
      const c = custSnap.data()!;
      customerStateCode = (c.stateCode as string | null) ?? null;
      customerSnapshot = { name: c.name ?? '', gstin: c.gstin ?? '', stateCode: customerStateCode, address: c.address ?? '', phone: c.phone ?? '' };
    }

    const settingsSnap = await tx.get(db.doc(`businesses/${b}/settings/business`));
    const sellerStateCode: string = (settingsSnap.data()?.stateCode as string) ?? '';
    const taxType = taxTypeFor(sellerStateCode, customerStateCode);
    const built = buildLines(input.lines as DraftLine[], products, taxType, true); // quotations always apply GST

    // Quotation lines omit unitCostPaise + skipStockDeduction (no stock/COGS).
    const lines = built.lines.map(({ unitCostPaise: _c, skipStockDeduction: _s, ...rest }) => rest);

    let number: string;
    let fy: string;
    let seq: number;
    if (isEdit) {
      const ex = existingSnap!.data()!;
      number = ex.number; fy = ex.fy; seq = ex.seq;
    } else {
      const reserved = await reserveNumberInTx(tx, db, { businessId: b, seriesKey: 'quotation', dateISO: input.date, actorUid: actor.uid });
      number = reserved.number; fy = reserved.fy; seq = reserved.seq;
    }

    const body = {
      number, fy, seq, date: input.date, locationId: input.locationId,
      customerId: input.customerId, customerSnapshot, taxType, lines,
      subtotalPaise: built.subtotalPaise, taxPaise: built.taxPaise,
      roundOffPaise: built.roundOffPaise, grandTotalPaise: built.grandTotalPaise,
      notes: input.notes,
    };

    if (isEdit) {
      tx.set(ref, { ...body, ...updateAudit(actor.uid) }, { merge: true });
    } else {
      tx.set(ref, { id: ref.id, businessId: b, ...body, status: 'open', convertedInvoiceId: null, ...createAudit(actor.uid) });
    }

    logActivity(db, (r, d) => tx.set(r, d), actor, isEdit ? 'update' : 'create', { type: 'quotation', id: ref.id, label: number }, input.locationId);

    const out = { quotationId: ref.id, number };
    writeIdempotentResult(tx, db, b, input.requestId, 'saveQuotation', out, actor.uid);
    return out;
  });

  return result;
});
