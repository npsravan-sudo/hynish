/**
 * finalizeInvoice (§8–§10, §22–§30, §59). The server-authoritative billing transaction. In ONE
 * Firestore transaction it: recomputes every tax/total from master data (never trusts client money),
 * snapshots customer/seller/product line values, reserves a number from the correct series on create
 * (INV for GST, NGST for Without-GST — BR-NUM-04), writes the invoice, posts the invoice + COGS
 * journals through the accounting gateway, sets the receivable state, flips a source quotation/DN,
 * audits, and is idempotent by requestId (§27). Editing is undo-then-reapply (BR-INV-11): the old
 * invoice + COGS journals are voided and re-posted; the number and the amount already received are
 * preserved (BR-INV-12); later payments keep their own entries (BR-ACC-09).
 *
 * Sales → Inventory (Phase 6, §33, BR-INV-07/11): each non-`skipStockDeduction` line writes a `sale`
 * movement (base units) at the invoice location in this same transaction. Editing is undo-then-reapply
 * — old lines are reversed (`sale_reversal`, added back before the shortage check, BR-INV-05) then the
 * new lines are deducted. A shortage is a warning (STOCK_SHORTAGE confirmation), and going negative on
 * a confirmed sale is the source-supported override (BR-STK-06). The COGS accounting entry
 * (Dr COGS / Cr Inventory) uses the purchasePrice snapshot (BR-COGS-01/02).
 */
import {
  taxTypeFor,
  derivePaymentStatus,
  outstandingOf,
  journalLinesForInvoice,
  journalLinesForInvoiceCogs,
  monthKey,
  todayISO,
} from '@hynish/domain';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { createAudit, updateAudit, logActivity } from '../masterdata/common.js';
import { reserveNumberInTx } from '../numbering/reserve-core.js';
import { postJournalTx, readPostedJournalsForRef, voidEntries } from '../accounting/post-core.js';
import { applyMovementTx, readLevelTx } from '../inventory/stock-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { buildLines, type DraftLine, type ProductData } from './build-lines.js';
import { finalizeInvoiceRequest } from '../schemas/sales.js';

export const finalizeInvoice = defineCallable(finalizeInvoiceRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  const isEdit = Boolean(input.id);
  assertPermission(actor.member, isEdit ? 'sales.edit' : 'sales.create');
  assertLocationAccess(actor.member, input.locationId);

  const b = input.businessId;
  const invoicesCol = db.collection(`businesses/${b}/invoices`);
  const actorName = actor.member.displayName ?? actor.member.email ?? actor.uid;

  const result = await db.runTransaction(async (tx) => {
    // ---- READ PHASE ----------------------------------------------------------------
    const cached = await readIdempotentResult<{ invoiceId: string; number: string }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const invoiceRef = isEdit ? invoicesCol.doc(input.id!) : invoicesCol.doc();
    const existingSnap = isEdit ? await tx.get(invoiceRef) : null;
    if (isEdit) {
      if (!existingSnap!.exists) throw appError('NOT_FOUND', 'Invoice not found.');
      const ex = existingSnap!.data()!;
      if (ex.deletedAt != null) throw appError('CONFLICT', 'This invoice was deleted.');
      // Location lock (BR-INV-10/37): an invoice is edited only from its own location.
      if (ex.locationId !== input.locationId) {
        throw appError('LOCATION_DENIED', 'Switch to the invoice’s location to edit it.');
      }
      assertLocationAccess(actor.member, ex.locationId);
      // Past-month edit warning (BR-INV-10/38): non-blocking — requires an explicit acknowledgement.
      if (monthKey(ex.date) < monthKey(todayISO()) && !input.acknowledgePastMonth) {
        throw appError('PAST_MONTH_EDIT', 'This bill is from a past month and may already have been filed for GST.');
      }
    }

    const uniqueProductIds = [...new Set(input.lines.map((l) => l.productId))];
    const productSnaps = await Promise.all(
      uniqueProductIds.map((pid) => tx.get(db.doc(`businesses/${b}/products/${pid}`))),
    );
    const products = new Map(
      productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as ProductData] as const),
    );

    const settingsSnap = await tx.get(db.doc(`businesses/${b}/settings/business`));
    const settings = settingsSnap.data() ?? {};
    const sellerStateCode: string = (settings.stateCode as string) ?? '';

    let customerSnapshot: {
      name: string; gstin: string; stateCode: string | null; address: string; phone: string;
    } | null = null;
    let customerStateCode: string | null = null;
    if (input.customerId) {
      const custSnap = await tx.get(db.doc(`businesses/${b}/customers/${input.customerId}`));
      if (!custSnap.exists || custSnap.data()!.deletedAt != null) throw appError('NOT_FOUND', 'Customer not found.');
      const c = custSnap.data()!;
      customerStateCode = (c.stateCode as string | null) ?? null;
      customerSnapshot = {
        name: c.name ?? '',
        gstin: c.gstin ?? '',
        stateCode: customerStateCode,
        address: c.address ?? '',
        phone: c.phone ?? '',
      };
    }

    // Source document (quotation / delivery note) to flip on a successful CREATE (BR-INV-15).
    let sourceRef = null as null | FirebaseFirestore.DocumentReference;
    if (!isEdit && input.source) {
      const col = input.source.type === 'quotation' ? 'quotations' : 'deliveryNotes';
      sourceRef = db.doc(`businesses/${b}/${col}/${input.source.id}`);
      const sSnap = await tx.get(sourceRef);
      if (!sSnap.exists) throw appError('NOT_FOUND', 'Source document not found.');
    }

    // Old journals to void on edit (READ before any write) (BR-INV-11).
    const oldJournalRefs = isEdit
      ? [
          ...(await readPostedJournalsForRef(tx, db, b, 'invoice', invoiceRef.id)),
          ...(await readPostedJournalsForRef(tx, db, b, 'invoice_cogs', invoiceRef.id)),
        ]
      : [];

    // Stock: current levels for every cell touched by the new lines and (on edit) the old lines,
    // all at this invoice's location (BR-INV-09/10 lock the location). Read before any write.
    const oldLines: { productId: string; variantId: string; baseQty: number; skipStockDeduction?: boolean }[] =
      isEdit ? (existingSnap!.data()!.lines ?? []) : [];
    const stockCells = new Map<string, number>();
    async function ensureCell(productId: string, variantId: string): Promise<void> {
      const key = `${productId}_${variantId}`;
      if (!stockCells.has(key)) stockCells.set(key, await readLevelTx(tx, db, b, productId, variantId, input.locationId));
    }
    for (const l of input.lines) await ensureCell(l.productId, l.variantId);
    for (const l of oldLines) if (!l.skipStockDeduction) await ensureCell(l.productId, l.variantId);

    // ---- COMPUTE -------------------------------------------------------------------
    const gstApplicable = input.gstApplicable; // BR-INV-02: default handled client-side (DEF-016)
    const taxType = taxTypeFor(sellerStateCode, customerStateCode);
    const built = buildLines(input.lines as DraftLine[], products, taxType, gstApplicable);

    const initialPaidPaise = isEdit
      ? Math.trunc((existingSnap!.data()!.initialPaidPaise as number) ?? 0) // BR-INV-12 / BR-ACC-09
      : Math.max(0, Math.min(Math.trunc(input.initialPaidPaise), built.grandTotalPaise));
    const paidPaise = isEdit ? Math.trunc((existingSnap!.data()!.paidPaise as number) ?? 0) : initialPaidPaise;
    const outstandingPaise = outstandingOf(built.grandTotalPaise, paidPaise);
    const paymentStatus = derivePaymentStatus(built.grandTotalPaise, paidPaise);

    // Stock shortage check (BR-INV-05): reverse the OLD lines back first, then test the new lines.
    // A shortage is a non-blocking warning the client re-submits with STOCK_SHORTAGE to confirm.
    const sim = new Map(stockCells);
    for (const l of oldLines) if (!l.skipStockDeduction) sim.set(`${l.productId}_${l.variantId}`, (sim.get(`${l.productId}_${l.variantId}`) ?? 0) + l.baseQty);
    let shortage = false;
    for (const l of built.lines) {
      if (l.skipStockDeduction) continue;
      const key = `${l.productId}_${l.variantId}`;
      const next = (sim.get(key) ?? 0) - l.baseQty;
      sim.set(key, next);
      if (next < 0) shortage = true;
    }
    const stockConfirmed = input.confirmations.includes('STOCK_SHORTAGE');
    if (shortage && !stockConfirmed) {
      throw appError('STOCK_SHORTAGE', 'One or more items do not have enough stock at this location.');
    }

    // ---- WRITE PHASE ---------------------------------------------------------------
    let number: string;
    let seriesKey: 'invoice_gst' | 'invoice_nogst';
    let fy: string;
    let seq: number;
    if (isEdit) {
      const ex = existingSnap!.data()!;
      number = ex.number;
      seriesKey = ex.seriesKey;
      fy = ex.fy;
      seq = ex.seq;
      voidEntries(tx, oldJournalRefs, actor.uid, 'edit');
    } else {
      seriesKey = gstApplicable ? 'invoice_gst' : 'invoice_nogst'; // BR-NUM-04
      const reserved = await reserveNumberInTx(tx, db, { businessId: b, seriesKey, dateISO: input.date, actorUid: actor.uid });
      number = reserved.number;
      fy = reserved.fy;
      seq = reserved.seq;
    }

    const sellerSnapshot = {
      businessName: (settings.businessName as string) ?? '',
      gstin: (settings.gstin as string) ?? '',
      stateCode: sellerStateCode || null,
    };

    const docBody = {
      number,
      seriesKey,
      fy,
      seq,
      date: input.date,
      dueDate: input.dueDate ?? null,
      locationId: input.locationId,
      customerId: input.customerId,
      customerSnapshot,
      sellerSnapshot,
      gstApplicable,
      taxType,
      lines: built.lines,
      subtotalPaise: built.subtotalPaise,
      cgstPaise: built.cgstPaise,
      sgstPaise: built.sgstPaise,
      igstPaise: built.igstPaise,
      taxPaise: built.taxPaise,
      roundOffPaise: built.roundOffPaise,
      grandTotalPaise: built.grandTotalPaise,
      initialPaidPaise,
      paidPaise,
      outstandingPaise,
      paymentStatus,
      notes: input.notes,
      source: input.source ?? null,
    };

    if (isEdit) {
      const ex = existingSnap!.data()!;
      tx.set(
        invoiceRef,
        { ...docBody, createdByName: ex.createdByName ?? actorName, revision: (Number(ex.revision) || 0) + 1, ...updateAudit(actor.uid) },
        { merge: true },
      );
    } else {
      tx.set(invoiceRef, {
        id: invoiceRef.id,
        businessId: b,
        ...docBody,
        createdByName: actorName,
        revision: 0,
        ...createAudit(actor.uid),
      });
    }

    // Accounting: invoice revenue/AR/tax + COGS (BR-ACC-08, BR-COGS-01), posted atomically.
    postJournalTx(tx, db, {
      businessId: b, date: input.date, locationId: input.locationId,
      refType: 'invoice', refId: invoiceRef.id, refLabel: number,
      lines: journalLinesForInvoice({
        subtotalPaise: built.subtotalPaise, taxPaise: built.taxPaise,
        roundOffPaise: built.roundOffPaise, grandTotalPaise: built.grandTotalPaise,
        atBillingPaidPaise: initialPaidPaise,
      }),
      actorUid: actor.uid,
    });
    postJournalTx(tx, db, {
      businessId: b, date: input.date, locationId: input.locationId,
      refType: 'invoice_cogs', refId: invoiceRef.id, refLabel: number,
      lines: journalLinesForInvoiceCogs(built.cogsTotalPaise),
      actorUid: actor.uid,
    });

    // Stock movements (BR-INV-07/11): reverse old lines, then deduct the new ones. Same transaction.
    const run = new Map(stockCells);
    const allowNegativeSale = stockConfirmed; // the shortage confirmation IS the sale's negative override (BR-STK-06)
    if (isEdit) {
      for (const l of oldLines) {
        if (l.skipStockDeduction) continue;
        const key = `${l.productId}_${l.variantId}`;
        const res = applyMovementTx(tx, db, {
          businessId: b, date: input.date, productId: l.productId, variantId: l.variantId,
          locationId: input.locationId, type: 'sale_reversal', qtyChange: l.baseQty,
          refType: 'invoice', refId: invoiceRef.id, note: 'Invoice edit — reverse', actorUid: actor.uid,
        }, run.get(key)!);
        run.set(key, res.qtyAfter);
      }
    }
    for (const l of built.lines) {
      if (l.skipStockDeduction) continue;
      const key = `${l.productId}_${l.variantId}`;
      const res = applyMovementTx(tx, db, {
        businessId: b, date: input.date, productId: l.productId, variantId: l.variantId,
        locationId: input.locationId, type: 'sale', qtyChange: -l.baseQty,
        refType: 'invoice', refId: invoiceRef.id, unitCostPaise: l.unitCostPaise, actorUid: actor.uid,
        allowNegative: allowNegativeSale,
      }, run.get(key)!);
      run.set(key, res.qtyAfter);
    }

    // Flip the source document on create (BR-INV-15).
    if (sourceRef && input.source) {
      if (input.source.type === 'quotation') {
        tx.set(sourceRef, { status: 'converted', convertedInvoiceId: invoiceRef.id, ...updateAudit(actor.uid) }, { merge: true });
      } else {
        tx.set(sourceRef, { status: 'invoiced', invoiceId: invoiceRef.id, ...updateAudit(actor.uid) }, { merge: true });
      }
    }

    logActivity(db, (r, d) => tx.set(r, d), actor, isEdit ? 'edit' : 'finalize', { type: 'invoice', id: invoiceRef.id, label: number }, input.locationId);

    const out = { invoiceId: invoiceRef.id, number };
    writeIdempotentResult(tx, db, b, input.requestId, 'finalizeInvoice', out, actor.uid);
    return out;
  });

  return result;
});
