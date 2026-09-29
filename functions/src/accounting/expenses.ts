/**
 * saveExpense / deleteExpense (BR-EXP-01/02, TD §6.4, §6.1.5). Server-authoritative. A save ALWAYS
 * voids any prior posted journal entry for the expense before posting a fresh one — a no-op on
 * create, and exactly how an edit is reflected in the books (TD §6.4: "always reverses any prior
 * entry for that expense id before re-posting"). Never an in-place accounting adjustment. Delete
 * reverses the journal then soft-deletes. Both are idempotent by requestId and expenses.manage-gated
 * (the source has no separate expense create/edit/delete permission split).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { journalLinesForExpense } from '@hynish/domain';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertLocationAccess } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { createAudit, updateAudit, logActivity } from '../masterdata/common.js';
import { postJournalTx, readPostedJournalsForRef, voidEntries } from '../accounting/post-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../utils/idempotency.js';
import { saveExpenseRequest, deleteExpenseRequest } from '../schemas/accounting.js';

export const saveExpense = defineCallable(saveExpenseRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'expenses.manage');
  assertLocationAccess(actor.member, input.locationId);

  const b = input.businessId;
  const col = db.collection(`businesses/${b}/expenses`);
  const isEdit = Boolean(input.id);

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ expenseId: string }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const ref = isEdit ? col.doc(input.id!) : col.doc();
    const existingSnap = isEdit ? await tx.get(ref) : null;
    if (isEdit) {
      if (!existingSnap!.exists) throw appError('NOT_FOUND', 'Expense not found.');
      const ex = existingSnap!.data()!;
      if (ex.deletedAt != null) throw appError('CONFLICT', 'This expense was deleted.');
      if (ex.locationId !== input.locationId) {
        throw appError('LOCATION_DENIED', 'Switch to the expense’s location to edit it.');
      }
      assertLocationAccess(actor.member, ex.locationId);
    }

    const catSnap = await tx.get(db.doc(`businesses/${b}/expenseCategories/${input.categoryId}`));
    if (!catSnap.exists || catSnap.data()!.deletedAt != null) throw appError('NOT_FOUND', 'Expense category not found.');
    const category = catSnap.data()!;

    // Old journal to void on edit (READ before any write) — a no-op set on create.
    const oldJournalRefs = isEdit ? await readPostedJournalsForRef(tx, db, b, 'expense', ref.id) : [];

    const label = `${category.name as string} · ${input.date}`;
    if (isEdit) voidEntries(tx, oldJournalRefs, actor.uid, 'edit');
    const journalEntryId = postJournalTx(tx, db, {
      businessId: b, date: input.date, locationId: input.locationId,
      refType: 'expense', refId: ref.id, refLabel: label,
      lines: journalLinesForExpense(input.amountPaise, category.accountId as string, input.mode),
      actorUid: actor.uid,
    });

    const body = {
      date: input.date, locationId: input.locationId,
      categoryId: input.categoryId, categoryNameSnapshot: category.name as string,
      amountPaise: input.amountPaise, mode: input.mode, notes: input.notes,
      journalEntryId: journalEntryId ?? '',
    };

    if (isEdit) {
      tx.set(ref, { ...body, ...updateAudit(actor.uid) }, { merge: true });
    } else {
      tx.set(ref, { id: ref.id, businessId: b, ...body, ...createAudit(actor.uid) });
    }

    logActivity(db, (r, d) => tx.set(r, d), actor, isEdit ? 'edit' : 'create', { type: 'expense', id: ref.id, label }, input.locationId);

    const out = { expenseId: ref.id };
    writeIdempotentResult(tx, db, b, input.requestId, 'saveExpense', out, actor.uid);
    return out;
  });

  return result;
});

export const deleteExpense = defineCallable(deleteExpenseRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'expenses.manage');

  const b = input.businessId;
  const ref = db.doc(`businesses/${b}/expenses/${input.id}`);

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotentResult<{ ok: boolean }>(tx, db, b, input.requestId);
    if (cached) return cached;

    const snap = await tx.get(ref);
    if (!snap.exists) throw appError('NOT_FOUND', 'Expense not found.');
    const ex = snap.data()!;
    if (ex.deletedAt != null) return { ok: true };
    assertLocationAccess(actor.member, ex.locationId);

    const refs = await readPostedJournalsForRef(tx, db, b, 'expense', input.id);
    voidEntries(tx, refs, actor.uid, 'delete');
    tx.set(ref, { deletedAt: FieldValue.serverTimestamp(), deletedBy: actor.uid, ...updateAudit(actor.uid) }, { merge: true });

    logActivity(db, (r, d) => tx.set(r, d), actor, 'delete', { type: 'expense', id: input.id, label: ex.categoryNameSnapshot ?? input.id }, ex.locationId);

    const out = { ok: true };
    writeIdempotentResult(tx, db, b, input.requestId, 'deleteExpense', out, actor.uid);
    return out;
  });

  return result;
});
