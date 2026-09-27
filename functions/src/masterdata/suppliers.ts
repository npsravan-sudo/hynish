/**
 * Supplier master callables (Phase 4 §19–§20). Requires suppliers.manage. Same GSTIN normalization
 * and state-derivation as customers (BR-GST-15/16) using the shared domain utilities. Archive is
 * soft-delete; admin-only delete permission preserved (BR-CUS-03).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { lower, buildSearchTokens, stateCodeFromGstin } from '@hynish/domain';
import { createAudit, updateAudit, logActivity } from './common.js';
import { saveSupplierRequest, setActiveRequest } from '../schemas/masterdata.js';

export const saveSupplier = defineCallable(saveSupplierRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'suppliers.manage');

  const gstinValue = input.gstin.trim().toUpperCase();
  const stateCode = input.stateCode ?? stateCodeFromGstin(gstinValue);

  const col = db.collection(`businesses/${input.businessId}/suppliers`);
  const ref = input.id ? col.doc(input.id) : col.doc();
  const isUpdate = Boolean(input.id);
  if (isUpdate && !(await ref.get()).exists) throw appError('NOT_FOUND', 'Supplier not found.');

  const base = {
    businessId: input.businessId,
    name: input.name.trim(),
    nameLower: lower(input.name),
    contactPerson: input.contactPerson.trim(),
    gstin: gstinValue,
    stateCode,
    city: input.city.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    searchTokens: buildSearchTokens(input.name, input.phone, input.city, gstinValue),
  };

  const batch = db.batch();
  if (isUpdate) {
    batch.set(ref, { ...base, ...updateAudit(actor.uid) }, { merge: true });
  } else {
    batch.set(ref, { id: ref.id, ...base, stats: { payablePaise: 0 }, ...createAudit(actor.uid) });
  }
  logActivity(db, (r, d) => batch.set(r, d), actor, isUpdate ? 'update' : 'create', { type: 'supplier', id: ref.id, label: input.name });
  await batch.commit();
  return { supplierId: ref.id };
});

export const setSupplierActive = defineCallable(setActiveRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, input.active ? 'suppliers.manage' : 'suppliers.delete');

  const ref = db.doc(`businesses/${input.businessId}/suppliers/${input.id}`);
  const snap = await ref.get();
  if (!snap.exists) throw appError('NOT_FOUND', 'Supplier not found.');

  const batch = db.batch();
  batch.update(ref, {
    deletedAt: input.active ? null : FieldValue.serverTimestamp(),
    deletedBy: input.active ? null : actor.uid,
    ...updateAudit(actor.uid),
  });
  logActivity(db, (r, d) => batch.set(r, d), actor, input.active ? 'activate' : 'deactivate', {
    type: 'supplier',
    id: input.id,
    label: (snap.data()?.name as string) ?? input.id,
  });
  await batch.commit();
  return { ok: true };
});
