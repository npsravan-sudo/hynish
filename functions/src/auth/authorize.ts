/**
 * Pure server-side authorization guards (SECURITY-ARCHITECTURE §11, Phase 2 §24).
 * These never touch Firestore, so they are fully unit-testable. They operate on an already
 * loaded MemberRecord + trusted token facts. Composed by the callable pipeline in context.ts.
 *
 * The permission logic is the SAME domain `can()` used by the client and mirrored by the
 * Firestore rules — one source of truth (BR-PRM-09).
 */
import { can, isAdminRole, type Permission, type Role } from '@hynish/domain';
import { appError } from '../utils/errors.js';
import { REAUTH_MAX_AGE_SECONDS, STEP_UP_MAX_AGE_SECONDS } from '../config/constants.js';
import type { Actor, MemberRecord, TokenFacts } from './types.js';

/** The account is a member and active (Phase 2 §31). */
export function assertActiveMember(member: MemberRecord | null | undefined): asserts member is MemberRecord {
  if (!member) throw appError('NOT_A_MEMBER', 'You are not a member of this business.');
  if (member.active !== true) {
    throw appError('MEMBER_INACTIVE', 'Your account is inactive. Please contact your administrator.');
  }
}

/** Interactive sign-in is within the 30-day window (BR-PRM-08). */
export function assertReauthFresh(token: TokenFacts, nowSeconds: number): void {
  if (token.authTimeSeconds <= nowSeconds - REAUTH_MAX_AGE_SECONDS) {
    throw appError('REAUTH_REQUIRED', 'Your sign-in has expired. Please sign in again.');
  }
}

/** Sensitive operations require a recent (5-minute) re-authentication (SECURITY §3). */
export function assertStepUp(token: TokenFacts, nowSeconds: number): void {
  if (token.authTimeSeconds <= nowSeconds - STEP_UP_MAX_AGE_SECONDS) {
    throw appError('STEP_UP_REQUIRED', 'Please re-enter your password to continue.');
  }
}

export function hasPermission(member: MemberRecord, permission: Permission): boolean {
  return can({ role: member.role, overrides: member.permissionOverrides ?? null }, permission);
}

export function assertPermission(member: MemberRecord, permission: Permission): void {
  if (!hasPermission(member, permission)) {
    throw appError('PERMISSION_DENIED', `You don't have permission to perform this action.`, {
      permission,
    });
  }
}

export function assertRole(member: MemberRecord, roles: Role[]): void {
  if (!roles.includes(member.role)) {
    throw appError('PERMISSION_DENIED', 'Your role cannot perform this action.');
  }
}

export function canAccessAllLocations(member: MemberRecord): boolean {
  return isAdminRole(member.role) || member.locationIds === null;
}

/** The member may act at the given location (Phase 2 §26). Fails closed. */
export function assertLocationAccess(member: MemberRecord, locationId: string): void {
  if (canAccessAllLocations(member)) return;
  const allowed = member.locationIds ?? [];
  if (!allowed.includes(locationId)) {
    throw appError('LOCATION_DENIED', 'You are not authorized for this location.', { locationId });
  }
}

/**
 * Owner protection (Phase 2 §30). Only an owner may create/modify an owner, change the owner
 * role, or deactivate an owner. Admins cannot escalate to or alter owner-level accounts.
 */
export function assertCanManageTargetRole(actor: Actor, targetCurrentRole: Role | null, nextRole: Role): void {
  const actorIsOwner = actor.member.role === 'owner';
  if ((nextRole === 'owner' || targetCurrentRole === 'owner') && !actorIsOwner) {
    throw appError('OWNER_PROTECTED', 'Only the owner can manage owner-level accounts.');
  }
}

/** A member can never modify their own membership (BR-PRM-07, §29). */
export function assertNotSelf(actor: Actor, targetUid: string): void {
  if (actor.uid === targetUid) {
    throw appError('PERMISSION_DENIED', 'You cannot modify your own membership.');
  }
}
