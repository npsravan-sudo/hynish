/**
 * Member-management callables (Phase 2 §29, §30, §55). This is the authorized administrative
 * workflow: members are NEVER writable by clients directly (Firestore rules deny it). All role,
 * permission, location and active changes flow through here, with owner protection, self-guard,
 * validation and audit logging.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import {
  assertPermission,
  assertStepUp,
  assertCanManageTargetRole,
  assertNotSelf,
} from '../auth/authorize.js';
import { appError } from '../utils/errors.js';
import { logAudit } from '../utils/logger.js';
import {
  createMemberSchema,
  updateMemberSchema,
  setMemberActiveSchema,
} from '../schemas/members.js';
import type { Role } from '@hynish/domain';

const memberRef = (businessId: string, uid: string) =>
  db.doc(`businesses/${businessId}/members/${uid}`);

export const createMember = defineCallable(createMemberSchema, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'members.manage');
  assertStepUp(actor.token, Math.floor(Date.now() / 1000));
  assertCanManageTargetRole(actor, null, input.role);

  const ref = memberRef(input.businessId, input.uid);
  if ((await ref.get()).exists) {
    throw appError('CONFLICT', 'This member already exists.');
  }

  await ref.set({
    uid: input.uid,
    businessId: input.businessId,
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    active: true,
    locationIds: input.locationIds,
    permissionOverrides: input.permissionOverrides ?? null,
    lastInteractiveSignInAt: null,
    schemaVersion: 1,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
  });

  logAudit('member.create', { businessId: input.businessId, actor: actor.uid, target: input.uid, role: input.role });
  return { ok: true };
});

export const updateMember = defineCallable(updateMemberSchema, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'members.manage');
  assertStepUp(actor.token, Math.floor(Date.now() / 1000));
  assertNotSelf(actor, input.uid); // cannot change your own role/permissions (BR-PRM-07)

  const ref = memberRef(input.businessId, input.uid);
  const snap = await ref.get();
  if (!snap.exists) throw appError('NOT_FOUND', 'Member not found.');
  const currentRole = (snap.data()?.role ?? null) as Role | null;
  const nextRole = input.role ?? currentRole ?? 'staff';
  assertCanManageTargetRole(actor, currentRole, nextRole);

  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
  };
  if (input.role !== undefined) patch.role = input.role;
  if (input.locationIds !== undefined) patch.locationIds = input.locationIds;
  if (input.permissionOverrides !== undefined) patch.permissionOverrides = input.permissionOverrides;
  if (input.displayName !== undefined) patch.displayName = input.displayName;

  await ref.update(patch);
  logAudit('member.update', {
    businessId: input.businessId,
    actor: actor.uid,
    target: input.uid,
    role: input.role ?? null,
  });
  return { ok: true };
});

export const setMemberActive = defineCallable(setMemberActiveSchema, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'members.manage');
  assertStepUp(actor.token, Math.floor(Date.now() / 1000));
  assertNotSelf(actor, input.uid);

  const ref = memberRef(input.businessId, input.uid);
  const snap = await ref.get();
  if (!snap.exists) throw appError('NOT_FOUND', 'Member not found.');
  const currentRole = (snap.data()?.role ?? null) as Role | null;
  // Deactivating/altering an owner requires owner (Phase 2 §30).
  assertCanManageTargetRole(actor, currentRole, currentRole ?? 'staff');

  await ref.update({
    active: input.active,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
  });

  // Revoke refresh tokens so a deactivated member loses access at the next request (§31, §33).
  if (input.active === false) {
    const { adminAuth } = await import('../config/app.js');
    await adminAuth.revokeRefreshTokens(input.uid).catch(() => undefined);
  }

  logAudit('member.setActive', {
    businessId: input.businessId,
    actor: actor.uid,
    target: input.uid,
    active: input.active,
  });
  return { ok: true };
});
