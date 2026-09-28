/**
 * deleteAccount (BR-ACC-17, TD §6.1.8). `deleteCustomAccount()` refuses if the account has any
 * journal entries posted against it (checked via the `accountIds` index written by postJournalTx —
 * both posted AND voided entries count, matching the source: "no account can be deleted once any
 * (non-voided or voided) entry references it"). System accounts can never be deleted. A genuine hard
 * delete (not soft-delete) — Chart of Accounts has no archive concept in the source, only add/delete.
 * accounts.manage only.
 */
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { logActivity } from '../masterdata/common.js';
import { deleteAccountRequest } from '../schemas/accounting.js';

export const deleteAccount = defineCallable(deleteAccountRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'accounts.manage');

  const b = input.businessId;
  const ref = db.doc(`businesses/${b}/accounts/${input.id}`);

  const snap = await ref.get();
  if (!snap.exists) return { ok: true }; // already gone — deleting is naturally idempotent
  const account = snap.data()!;
  if (account.isSystem) throw appError('PERMISSION_DENIED', 'System accounts cannot be deleted.');

  const usage = await db
    .collection(`businesses/${b}/journalEntries`)
    .where('accountIds', 'array-contains', input.id)
    .limit(1)
    .get();
  if (!usage.empty) {
    throw appError('CONFLICT', 'This account has journal entries posted against it and cannot be deleted.');
  }

  const batch = db.batch();
  batch.delete(ref);
  logActivity(db, (r, d) => batch.set(r, d), actor, 'delete', { type: 'account', id: input.id, label: account.name ?? input.id });
  await batch.commit();

  return { ok: true };
});
