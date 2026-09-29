/**
 * saveCreditNote (BR-CN-01..05, TD §5.5, §6.1.5). This is the source's ONLY sales-return mechanism —
 * there is no separate "Sales Return" document (§68, do not invent). Issued against an existing
 * invoice; each line's credited quantity is clamped server-side to what's still eligible
 * (`[0, originalQty − alreadyCreditedQty]`, BR-CN-01) — never trusting a client-computed cap. Uses
 * the ORIGINAL invoice line's rate/discount/GST-rate and the invoice's own taxType (never re-derived,
 * BR-CN-02); tax is zero if the original invoice was Without-GST. Reverses Dr Sales Revenue / Dr GST
 * Output (if taxed) / Cr Accounts Receivable (BR-CN-03) and, ONLY if `restock` is checked, also
 * Dr Inventory / Cr COGS (`credit_note_cogs`) plus a `sale_return` stock movement (BR-CN-04). A price
 * -correction note (restock unchecked) never touches stock/COGS. No edit/delete exists for a Credit
 * Note in the source — once issued it stands, same as the legacy app.
 */
import { computeGstLine, journalLinesForCreditNote, journalLinesForCreditNoteCogs, clampEligibleQty, type GstRateBp } from '@hynish/domain';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { createAudit, logActivity } from '../masterdata/common.js';
import { reserveNumberInTx } from '../numbering/reserve-core.js';
import { postJournalTx } from '../accounting/post-core.js';
import { applyMovementTx, readLevelTx } from '../inventory/stock-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { saveCreditNoteRequest } from '../schemas/sales.js';

interface InvoiceLineData {
  lineId: string;
  productId: string;
  variantId: string;
  nameSnapshot: string;
  codeSnapshot: string;
  hsnSnapshot: string;
  unit: string;
  qty: number;
  baseQty: number;
  ratePaise: number;
  discountBp: number;
  gstRateBp: GstRateBp;
  unitCostPaise: number;
}

export const saveCreditNote = defineCallable(saveCreditNoteRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'creditNotes.manage');

  const b = input.businessId;
  const invoiceRef = db.doc(`businesses/${b}/invoices/${input.invoiceId}`);
  const col = db.collection(`businesses/${b}/creditNotes`);

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ creditNoteId: string; number: string }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const invSnap = await tx.get(invoiceRef);
    if (!invSnap.exists) throw appError('NOT_FOUND', 'Invoice not found.');
    const invoice = invSnap.data()!;
    if (invoice.deletedAt != null) throw appError('CONFLICT', 'This invoice was deleted.');
    if (invoice.locationId !== input.locationId) throw appError('LOCATION_DENIED', 'A credit note must be issued from the invoice’s own location.');
    assertLocationAccess(actor.member, invoice.locationId);

    const invoiceLines: InvoiceLineData[] = invoice.lines ?? [];
    const linesByLineId = new Map(invoiceLines.map((l) => [l.lineId, l] as const));

    // READ: every prior (non-voided-by-deletion) credit note against this invoice, to compute what's
    // already been credited per line (BR-CN-01). Credit notes are never soft-deleted in the source.
    const priorSnap = await tx.get(col.where('invoiceId', '==', input.invoiceId));
    const alreadyCredited = new Map<string, number>();
    for (const doc of priorSnap.docs) {
      for (const l of (doc.data().lines ?? []) as { invoiceLineId: string; qty: number }[]) {
        alreadyCredited.set(l.invoiceLineId, (alreadyCredited.get(l.invoiceLineId) ?? 0) + l.qty);
      }
    }

    // Stock levels for restock (read before any write), keyed by product+variant at the invoice's location.
    const stockLevels = new Map<string, number>();
    if (input.restock) {
      for (const draft of input.lines) {
        const invLine = linesByLineId.get(draft.invoiceLineId);
        if (!invLine) continue;
        const key = `${invLine.productId}_${invLine.variantId}`;
        if (!stockLevels.has(key)) stockLevels.set(key, await readLevelTx(tx, db, b, invLine.productId, invLine.variantId, invoice.locationId));
      }
    }

    const taxType = invoice.taxType as 'intra' | 'inter';
    const gstApplicable = Boolean(invoice.gstApplicable); // BR-CN-02: inherited, never re-derived

    // ---- COMPUTE (pure — no writes yet) --------------------------------------------
    let subtotalPaise = 0, cgstPaise = 0, sgstPaise = 0, igstPaise = 0, cogsTotalPaise = 0;
    const lines: Record<string, unknown>[] = [];
    const restocks: { productId: string; variantId: string; baseQty: number }[] = [];
    for (const draft of input.lines) {
      const invLine = linesByLineId.get(draft.invoiceLineId);
      if (!invLine) throw appError('NOT_FOUND', `Invoice line not found: ${draft.invoiceLineId}`);
      const already = alreadyCredited.get(draft.invoiceLineId) ?? 0;
      const creditedQty = clampEligibleQty(invLine.qty, already, draft.qty);
      if (creditedQty <= 0) continue; // nothing eligible left on this line — silently skip

      const baseQtyPerUnit = invLine.baseQty / invLine.qty;
      const creditedBaseQty = Math.round(creditedQty * baseQtyPerUnit);
      const g = computeGstLine({ qty: creditedQty, ratePaise: invLine.ratePaise, discountBp: invLine.discountBp, gstRateBp: invLine.gstRateBp }, taxType, gstApplicable);
      const unitCostPaise = invLine.unitCostPaise ?? 0;

      subtotalPaise += g.taxablePaise; cgstPaise += g.cgstPaise; sgstPaise += g.sgstPaise; igstPaise += g.igstPaise;
      cogsTotalPaise += unitCostPaise * creditedBaseQty;
      lines.push({
        invoiceLineId: draft.invoiceLineId, lineId: invLine.lineId, productId: invLine.productId, variantId: invLine.variantId,
        nameSnapshot: invLine.nameSnapshot, codeSnapshot: invLine.codeSnapshot, hsnSnapshot: invLine.hsnSnapshot, unit: invLine.unit,
        qty: creditedQty, baseQty: creditedBaseQty, ratePaise: invLine.ratePaise, discountBp: invLine.discountBp, gstRateBp: invLine.gstRateBp,
        taxablePaise: g.taxablePaise, cgstPaise: g.cgstPaise, sgstPaise: g.sgstPaise, igstPaise: g.igstPaise, totalPaise: g.totalPaise,
        unitCostPaise,
      });
      if (input.restock) restocks.push({ productId: invLine.productId, variantId: invLine.variantId, baseQty: creditedBaseQty });
    }
    if (lines.length === 0) throw appError('VALIDATION_FAILED', 'Nothing eligible to credit on the selected lines.');

    const taxPaise = cgstPaise + sgstPaise + igstPaise;
    const grandTotalPaise = subtotalPaise + taxPaise; // BR-CN-06 rounding NOT VERIFIED (OQ-11) — no extra round-off invented

    // ---- WRITE PHASE ----------------------------------------------------------------
    const reserved = await reserveNumberInTx(tx, db, { businessId: b, seriesKey: 'credit_note', dateISO: input.date, actorUid: actor.uid });
    const ref = col.doc();

    if (input.restock) {
      for (const r of restocks) {
        const key = `${r.productId}_${r.variantId}`;
        const res = applyMovementTx(tx, db, {
          businessId: b, date: input.date, productId: r.productId, variantId: r.variantId,
          locationId: invoice.locationId, type: 'sale_return', qtyChange: r.baseQty,
          refType: 'credit_note', refId: ref.id, note: 'Credit note restock', actorUid: actor.uid,
        }, stockLevels.get(key)!);
        stockLevels.set(key, res.qtyAfter);
      }
    }

    tx.set(ref, {
      id: ref.id, businessId: b, number: reserved.number, fy: reserved.fy, seq: reserved.seq,
      date: input.date, locationId: invoice.locationId, invoiceId: input.invoiceId, invoiceNumber: invoice.number,
      customerId: invoice.customerId, customerSnapshot: invoice.customerSnapshot, taxType, gstApplicable,
      restock: input.restock, lines,
      subtotalPaise, cgstPaise, sgstPaise, igstPaise, taxPaise, roundOffPaise: 0, grandTotalPaise,
      reason: input.reason,
      ...createAudit(actor.uid),
    });

    // Accounting (BR-CN-03/04) — reverse the credited revenue/tax/AR, and (if restock) the COGS too.
    postJournalTx(tx, db, {
      businessId: b, date: input.date, locationId: invoice.locationId,
      refType: 'credit_note', refId: ref.id, refLabel: reserved.number,
      lines: journalLinesForCreditNote(subtotalPaise, taxPaise, grandTotalPaise),
      actorUid: actor.uid,
    });
    if (input.restock) {
      postJournalTx(tx, db, {
        businessId: b, date: input.date, locationId: invoice.locationId,
        refType: 'credit_note_cogs', refId: ref.id, refLabel: reserved.number,
        lines: journalLinesForCreditNoteCogs(cogsTotalPaise),
        actorUid: actor.uid,
      });
    }

    logActivity(db, (r, d) => tx.set(r, d), actor, 'create', { type: 'credit_note', id: ref.id, label: reserved.number }, invoice.locationId);

    const out = { creditNoteId: ref.id, number: reserved.number };
    writeIdempotentResult(tx, db, b, input.requestId, 'saveCreditNote', out, actor.uid);
    return out;
  });

  return result;
});
