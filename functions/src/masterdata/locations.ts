/**
 * Location master callables (Phase 4 §21–§23). Requires locations.manage (owner/admin — an
 * unrestricted role), so no per-location authorization is needed to manage the list itself.
 * Business isolation is enforced by resolveActor + Firestore rules. At least one active location
 * must always exist (BR-LOC-01); archiving the last one is refused. Archive is soft-delete so
 * stock/journal references stay valid (BR-LOC-02) — no resurrection bug.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { createAudit, updateAudit, logActivity } from './common.js';
import { saveLocationRequest, setActiveRequest } from '../schemas/masterdata.js';

export const saveLocation = defineCallable(saveLocationRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'locations.manage');

  const col = db.collection(`businesses/${input.businessId}/locations`);
  const ref = input.id ? col.doc(input.id) : col.doc();
  const isUpdate = Boolean(input.id);
  if (isUpdate && !(await ref.get()).exists) throw appError('NOT_FOUND', 'Location not found.');

  const base = {
    businessId: input.businessId,
    name: input.name.trim(),
    type: input.type,
    address: input.address.trim(),
    openingCashBalancePaise: input.openingCashBalancePaise,
    isDefault: input.isDefault,
    sortOrder: input.sortOrder,
  };

  const batch = db.batch();
  if (isUpdate) {
    batch.set(ref, { ...base, ...updateAudit(actor.uid) }, { merge: true });
  } else {
    batch.set(ref, { id: ref.id, ...base, ...createAudit(actor.uid) });
  }
  logActivity(db, (r, d) => batch.set(r, d), actor, isUpdate ? 'update' : 'create', { type: 'location', id: ref.id, label: input.name });
  await batch.commit();
  return { locationId: ref.id };
});

export const setLocationActive = defineCallable(setActiveRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'locations.manage');

  const col = db.collection(`businesses/${input.businessId}/locations`);
  const ref = col.doc(input.id);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError('NOT_FOUND', 'Location not found.');

    if (!input.active) {
      // Refuse to archive the last active location (BR-LOC-01).
      const activeSnap = await tx.get(col.where('deletedAt', '==', null));
      if (activeSnap.size <= 1) throw appError('CONFLICT', 'At least one active location must remain.');
    }

    tx.update(ref, {
      deletedAt: input.active ? null : FieldValue.serverTimestamp(),
      deletedBy: input.active ? null : actor.uid,
      ...updateAudit(actor.uid),
    });
    logActivity(db, (r, d) => tx.set(r, d), actor, input.active ? 'activate' : 'deactivate', {
      type: 'location',
      id: input.id,
      label: (snap.data()?.name as string) ?? input.id,
    });
  });
  return { ok: true };
});
