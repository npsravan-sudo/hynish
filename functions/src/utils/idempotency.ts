/**
 * Transaction-scoped idempotency (§27, §35). Critical financial operations (invoice finalization,
 * payment recording) carry a client-generated requestId. The first successful run stores its result
 * under `businesses/{b}/idempotency/{requestId}` inside the SAME transaction as the write, so a
 * retry (timeout, double-tap, refresh) returns the stored result instead of creating a duplicate.
 * Client writes to this collection are denied by Firestore rules.
 */
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';

/** READ PHASE: return the stored result for a requestId, or undefined if this is the first run. */
export async function readIdempotentResult<T>(
  tx: Transaction,
  db: Firestore,
  businessId: string,
  requestId: string | undefined,
): Promise<T | undefined> {
  if (!requestId) return undefined;
  const snap = await tx.get(db.doc(`businesses/${businessId}/idempotency/${requestId}`));
  if (!snap.exists) return undefined;
  return snap.data()?.result as T;
}

/** WRITE PHASE: persist the result so a later retry with the same requestId is a no-op. */
export function writeIdempotentResult(
  tx: Transaction,
  db: Firestore,
  businessId: string,
  requestId: string | undefined,
  op: string,
  result: unknown,
  actorUid: string,
): void {
  if (!requestId) return;
  tx.set(db.doc(`businesses/${businessId}/idempotency/${requestId}`), {
    requestId,
    op,
    result,
    at: FieldValue.serverTimestamp(),
    by: actorUid,
  });
}
