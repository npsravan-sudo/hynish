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
 * Phase-6 boundary (§15, §29): physical stock movement (stockLevels/stockMovements) is NOT written
 * here yet — each line already carries baseQty, unitCostPaise and skipStockDeduction so the Inventory
 * phase can add the movement writes inside this same transaction. The COGS *accounting* entry is
 * posted now (value = purchasePrice snapshot, BR-COGS-01/02).
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
        throw appError('VALIDATION_FAILED', 'PAST_MONTH_EDIT');
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
