/**
 * Firestore-backed resolution of the trusted actor for a callable (Phase 2 §24, §25).
 * The client may only REQUEST an operation on a business; the server independently loads the
 * membership and derives role/permissions/locations. Nothing authorization-relevant is trusted
 * from the client payload.
 */
import type { CallableRequest } from 'firebase-functions/v2/https';
import { db } from '../config/app.js';
import { appError } from '../utils/errors.js';
import { assertActiveMember, assertReauthFresh } from './authorize.js';
import type { Actor, MemberRecord, TokenFacts } from './types.js';

function tokenFactsFrom(request: CallableRequest): TokenFacts {
  const auth = request.auth;
  if (!auth) throw appError('UNAUTHENTICATED', 'You must be signed in.');
  const authTime = typeof auth.token.auth_time === 'number' ? auth.token.auth_time : 0;
  const email = typeof auth.token.email === 'string' ? auth.token.email : undefined;
  return { uid: auth.uid, authTimeSeconds: authTime, email };
}

async function loadMember(businessId: string, uid: string): Promise<MemberRecord | null> {
  const snap = await db.doc(`businesses/${businessId}/members/${uid}`).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    uid,
    businessId,
    role: data.role,
    active: data.active === true,
    locationIds: Array.isArray(data.locationIds) ? data.locationIds : data.locationIds === null ? null : null,
    permissionOverrides: data.permissionOverrides ?? null,
    email: data.email,
    displayName: data.displayName ?? null,
  };
}

/**
 * Resolve the trusted Actor: authenticated, reauth-fresh, active member of `businessId`.
 * Throws typed AppErrors for each failure mode.
 */
export async function resolveActor(request: CallableRequest, businessId: string): Promise<Actor> {
  if (!businessId || typeof businessId !== 'string') {
    throw appError('VALIDATION_FAILED', 'A businessId is required.');
  }
  const token = tokenFactsFrom(request);
  assertReauthFresh(token, Math.floor(Date.now() / 1000));

  const member = await loadMember(businessId, token.uid);
  assertActiveMember(member);

  return { uid: token.uid, businessId, member, token };
}
