/**
 * recordPayment (§31–§35, §59). Server-authoritative, idempotent payment recording against an
 * invoice (customer receipt). In one transaction it validates the amount (>0; over-outstanding needs
 * an explicit confirmation, BR-PAY-01), increases the parent's paidAmount, re-derives payment status
 * (BR-PAY-02), writes the payment doc, posts the payment_in journal respecting the real mode
 * (BR-PAY-03/04), optionally writes a Cash Book entry (BR-PAY-05), audits, and dedupes by requestId.
 *
 * Supplier payments (direction 'out', targetType 'purchase') share the same shape and are handled
 * here for forward-compatibility, but the Purchases module lands in a later phase; only 'invoice'
 * targets exist to pay against in Phase 5.
 */
import { FieldValue } from 'firebase-admin/firestore';
import {
  derivePaymentStatus,
  outstandingOf,
  journalLinesForPaymentIn,
  journalLinesForPaymentOut,
  OUTSTANDING_THRESHOLD_PAISE,
} from '@hynish/domain';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { createAudit, logActivity } from '../masterdata/common.js';
import { postJournalTx } from '../accounting/post-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { recordPaymentRequest } from '../schemas/sales.js';

export const recordPayment = defineCallable(recordPaymentRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'payments.record');
  if (input.targetType !== 'invoice') throw appError('VALIDATION_FAILED', 'Only invoice payments are supported in this phase.');

  const b = input.businessId;
  const amount = Math.trunc(input.amountPaise);
  if (!(amount > 0)) throw appError('VALIDATION_FAILED', 'Payment must be greater than zero.'); // BR-PAY-01

  const result = await db.runTransaction(async (tx) => {
    // ---- READ PHASE ----
    const cached = await readIdempotentResult<{ paymentId: string }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const targetRef = db.doc(`businesses/${b}/invoices/${input.targetId}`);
    const targetSnap = await tx.get(targetRef);
    if (!targetSnap.exists || targetSnap.data()!.deletedAt != null) throw appError('NOT_FOUND', 'Invoice not found.');
    const inv = targetSnap.data()!;
    assertLocationAccess(actor.member, inv.locationId);

    const prevPaid = Math.trunc((inv.paidPaise as number) ?? 0);
    const grand = Math.trunc((inv.grandTotalPaise as number) ?? 0);
    const outstanding = outstandingOf(grand, prevPaid);

    // Over-payment is a warning, not a block (BR-PAY-01): needs OVER_PAYMENT confirmation.
    if (amount > outstanding + OUTSTANDING_THRESHOLD_PAISE && !input.confirmations.includes('OVER_PAYMENT')) {
      throw appError('OVER_PAYMENT', 'This payment is more than the outstanding balance.');
    }

    // ---- WRITE PHASE ----
    const newPaid = prevPaid + amount;
    const newOutstanding = outstandingOf(grand, newPaid);
    const status = derivePaymentStatus(grand, newPaid);

    const paymentRef = db.collection(`businesses/${b}/payments`).doc();
    const journalLines = input.direction === 'in'
      ? journalLinesForPaymentIn(amount, input.mode)
      : journalLinesForPaymentOut(amount, input.mode);
    const journalEntryId = postJournalTx(tx, db, {
      businessId: b, date: input.date, locationId: inv.locationId,
      refType: input.direction === 'in' ? 'payment_in' : 'payment_out',
      refId: paymentRef.id, refLabel: `${inv.number} · ${input.mode}`,
      lines: journalLines, actorUid: actor.uid,
    })!;

    // Optional informal Cash Book entry (BR-PAY-05).
    let cashEntryId: string | null = null;
    if (input.alsoLogCashBook) {
      const cashRef = db.collection(`businesses/${b}/cashEntries`).doc();
      cashEntryId = cashRef.id;
      tx.set(cashRef, {
        id: cashRef.id, businessId: b, date: input.date, locationId: inv.locationId,
        type: input.direction === 'in' ? 'in' : 'out',
        category: input.direction === 'in' ? 'Customer Payment Received' : 'Supplier Payment',
        amountPaise: amount, mode: input.mode, reference: input.reference, notes: input.notes,
        source: { type: 'payment', id: paymentRef.id }, ...createAudit(actor.uid),
      });
    }

    tx.set(paymentRef, {
      id: paymentRef.id, businessId: b,
      direction: input.direction, targetType: input.targetType, targetId: input.targetId,
      targetNumber: inv.number, partyId: inv.customerId ?? null,
      date: input.date, amountPaise: amount, mode: input.mode,
      reference: input.reference, notes: input.notes, locationId: inv.locationId,
      cashEntryId, journalEntryId, ...createAudit(actor.uid),
    });

    // Update the parent invoice's receivable state (BR-PAY-05). Does not change the invoice journal.
    tx.set(targetRef, {
      paidPaise: newPaid, outstandingPaise: newOutstanding, paymentStatus: status,
      updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid,
    }, { merge: true });

    logActivity(db, (r, d) => tx.set(r, d), actor, 'payment', { type: 'payment', id: paymentRef.id, label: inv.number }, inv.locationId);

    const out = { paymentId: paymentRef.id };
    writeIdempotentResult(tx, db, b, input.requestId, 'recordPayment', out, actor.uid);
    return out;
  });

  return result;
});
