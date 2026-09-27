/**
 * Product master callables (Phase 4 §7–§13). Server-authoritative: validates business rules
 * (BR-PRD-01), enforces case-insensitive barcode uniqueness via a transactional index (fixes the
 * legacy client-only uniqueness check), derives nameLower/searchTokens, and audits. Requires
 * products.manage (owner/admin). Archive/restore is soft-delete (§24/§25) — history stays valid.
 */
import { getStorage } from 'firebase-admin/storage';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission } from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { FieldValue } from 'firebase-admin/firestore';
import { normalizeBarcode, lower, buildSearchTokens } from '@hynish/domain';
import { createAudit, updateAudit, logActivity } from './common.js';
import { assertProductBusinessRules } from './validation.js';
import {
  saveProductRequest,
  setProductImageRequest,
  setActiveRequest,
} from '../schemas/masterdata.js';

export const saveProduct = defineCallable(saveProductRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'products.manage');

  const barcode = normalizeBarcode(input.barcode);
  assertProductBusinessRules({ ...input, barcode });

  const productsCol = db.collection(`businesses/${input.businessId}/products`);
  const ref = input.id ? productsCol.doc(input.id) : productsCol.doc();
  const isUpdate = Boolean(input.id);

  const productId = await db.runTransaction(async (tx) => {
    const existing = isUpdate ? await tx.get(ref) : null;
    if (isUpdate && !existing?.exists) throw appError('NOT_FOUND', 'Product not found.');
    const oldBarcode: string = existing?.data()?.barcode ?? '';

    // Barcode uniqueness (case-insensitive) via a transactional index (BR-PRD-01).
    if (barcode) {
      const idxRef = db.doc(`businesses/${input.businessId}/barcodes/${barcode}`);
      const idxSnap = await tx.get(idxRef);
      if (idxSnap.exists && idxSnap.data()?.productId !== ref.id) {
        throw appError('CONFLICT', 'Another product already uses this barcode.');
      }
      tx.set(idxRef, { productId: ref.id, barcode });
    }
    if (oldBarcode && oldBarcode !== barcode) {
      tx.delete(db.doc(`businesses/${input.businessId}/barcodes/${oldBarcode}`));
    }

    const base = {
      businessId: input.businessId,
      name: input.name.trim(),
      nameLower: lower(input.name),
      category: input.category.trim(),
      hsn: input.hsn.trim(),
      wholesalePricePaise: input.wholesalePricePaise,
      purchasePricePaise: input.purchasePricePaise,
      gstRateBp: input.gstRateBp,
      unit: input.unit,
      altUnits: input.altUnits,
      barcode,
      lowStockThreshold: input.lowStockThreshold,
      hasVariants: input.hasVariants,
      variants: input.variants,
      imagePath: input.imagePath ?? existing?.data()?.imagePath ?? null,
      searchTokens: buildSearchTokens(input.name, input.category, input.hsn, barcode),
    };

    if (isUpdate) {
      tx.set(ref, { ...base, ...updateAudit(actor.uid) }, { merge: true });
    } else {
      tx.set(ref, { id: ref.id, ...base, ...createAudit(actor.uid) });
    }
    logActivity(db, (r, d) => tx.set(r, d), actor, isUpdate ? 'update' : 'create', { type: 'product', id: ref.id, label: input.name });
    return ref.id;
  });

  return { productId };
});

export const setProductActive = defineCallable(setActiveRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  // Archiving (deactivate) is delete-class -> products.delete (admin/owner). Restore -> products.manage.
  assertPermission(actor.member, input.active ? 'products.manage' : 'products.delete');

  const ref = db.doc(`businesses/${input.businessId}/products/${input.id}`);
  const snap = await ref.get();
  if (!snap.exists) throw appError('NOT_FOUND', 'Product not found.');

  await ref.update({
    deletedAt: input.active ? null : FieldValue.serverTimestamp(),
    deletedBy: input.active ? null : actor.uid,
    ...updateAudit(actor.uid),
  });
  const batch = db.batch();
  logActivity(db, (r, d) => batch.set(r, d), actor, input.active ? 'activate' : 'deactivate', {
    type: 'product',
    id: input.id,
    label: (snap.data()?.name as string) ?? input.id,
  });
  await batch.commit();
  return { ok: true };
});

export const setProductImage = defineCallable(setProductImageRequest, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'products.manage');

  const ref = db.doc(`businesses/${input.businessId}/products/${input.id}`);
  const snap = await ref.get();
  if (!snap.exists) throw appError('NOT_FOUND', 'Product not found.');
  const oldPath: string | null = snap.data()?.imagePath ?? null;

  await ref.update({ imagePath: input.imagePath, ...updateAudit(actor.uid) });

  // Delete the previous Storage object so images are never orphaned (fixes legacy KL-03).
  if (oldPath && oldPath !== input.imagePath) {
    await getStorage().bucket().file(oldPath).delete({ ignoreNotFound: true }).catch(() => undefined);
  }
  return { ok: true };
});
