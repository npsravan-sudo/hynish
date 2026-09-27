/**
 * Customer master callables (Phase 4 §14–§18). Requires customers.manage (shop and up). Preserves
 * legacy GSTIN behavior: uppercased, and the state code derived from the GSTIN when not set
 * (BR-GST-15/16). No hard uniqueness (legacy permits duplicate customers). Archive is soft-delete
 * so invoices keep their frozen snapshot (BR-CUS-02).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { lower, buildSearchTokens, stateCodeFromGstin } from '@hynish/domain';
import { createAudit, updateAudit, logActivity } from './common.js';
import { saveCustomerRequest, setActiveRequest } from '../schemas/masterdata.js';

export const saveCustomer = defineCallable(saveCustomerRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'customers.manage');

  const gstinValue = input.gstin.trim().toUpperCase();
  const stateCode = input.stateCode ?? stateCodeFromGstin(gstinValue);

  const col = db.collection(`businesses/${input.businessId}/customers`);
  const ref = input.id ? col.doc(input.id) : col.doc();
  const isUpdate = Boolean(input.id);
  if (isUpdate && !(await ref.get()).exists) throw appError('NOT_FOUND', 'Customer not found.');

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
    creditLimitPaise: input.creditLimitPaise,
    searchTokens: buildSearchTokens(input.name, input.phone, input.city, gstinValue),
  };

  const batch = db.batch();
  if (isUpdate) {
    batch.set(ref, { ...base, ...updateAudit(actor.uid) }, { merge: true });
  } else {
    batch.set(ref, {
      id: ref.id,
      ...base,
      stats: { outstandingPaise: 0, overdueInvoiceCount: 0, lastInvoiceDate: null },
      ...createAudit(actor.uid),
    });
  }
  logActivity(db, (r, d) => batch.set(r, d), actor, isUpdate ? 'update' : 'create', { type: 'customer', id: ref.id, label: input.name });
  await batch.commit();
  return { customerId: ref.id };
});

export const setCustomerActive = defineCallable(setActiveRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, input.active ? 'customers.manage' : 'customers.delete');

  const ref = db.doc(`businesses/${input.businessId}/customers/${input.id}`);
  const snap = await ref.get();
  if (!snap.exists) throw appError('NOT_FOUND', 'Customer not found.');

  const batch = db.batch();
  batch.update(ref, {
    deletedAt: input.active ? null : FieldValue.serverTimestamp(),
    deletedBy: input.active ? null : actor.uid,
    ...updateAudit(actor.uid),
  });
  logActivity(db, (r, d) => batch.set(r, d), actor, input.active ? 'activate' : 'deactivate', {
    type: 'customer',
    id: input.id,
    label: (snap.data()?.name as string) ?? input.id,
  });
  await batch.commit();
  return { ok: true };
});
