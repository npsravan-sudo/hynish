/**
 * Shared helpers for master-data write callables (Phase 4 §33, §34). All master-data documents
 * are server-only writes (Firestore rules deny client writes), so every create/update/archive
 * flows through these functions with audit metadata and an immutable activity-log entry.
 */
import { FieldValue, type Firestore, type DocumentReference, type DocumentData } from 'firebase-admin/firestore';
import type { Actor } from '../auth/types.js';

/** Audit fields for a NEW document. */
export function createAudit(actorUid: string) {
  return {
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actorUid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorUid,
    schemaVersion: 1,
    deletedAt: null,
    deletedBy: null,
  };
}

/** Audit fields for an UPDATE (never touches createdAt/By). */
export function updateAudit(actorUid: string) {
  return { updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid };
}

export type ActivityAction =
  | 'create' | 'update' | 'activate' | 'deactivate';

type SetFn = (ref: DocumentReference, data: DocumentData) => unknown;

/**
 * Append an immutable activity-log entry (BR-ADM-04). Safe identifiers only (§34, §51).
 * Takes a `set` callback so it works with both a WriteBatch and a Transaction.
 */
export function logActivity(
  db: Firestore,
  set: SetFn,
  actor: Actor,
  action: ActivityAction,
  target: { type: string; id: string; label: string },
  locationId: string | null = null,
): void {
  const ref = db.collection(`businesses/${actor.businessId}/activityLog`).doc();
  set(ref, {
    id: ref.id,
    businessId: actor.businessId,
    at: FieldValue.serverTimestamp(),
    actorUid: actor.uid,
    actorName: actor.member.displayName ?? actor.member.email ?? actor.uid,
    locationId,
    action: `${target.type}.${action}`,
    target,
    details: {},
    requestId: null,
    schemaVersion: 1,
  });
}
