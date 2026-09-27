/**
 * Server-authoritative accounting gateway (BR-ACC-04/05, TD §6.1.4). The ONE place journal entries
 * are written. Every posting is validated to balance (Σdebit === Σcredit, exact in paise) and
 * refused otherwise (BR-ACC-01) — nothing partial is ever written. Edits/deletes reverse by VOIDING
 * prior entries for (refType, refId) and re-posting (BR-ACC-05); voided entries are kept for audit.
 *
 * These operate inside a caller-provided Firestore transaction so a document and its journals commit
 * atomically (BR-ACC-04). Reads-before-writes: `readPostedJournalsForRef` must be called during the
 * read phase; `voidEntries`/`postJournalTx` during the write phase.
 */
import { FieldValue, type Firestore, type Transaction, type DocumentReference } from 'firebase-admin/firestore';
import {
  validateJournal,
  pruneZeroLines,
  type JournalLineInput,
  type JournalRefType,
} from '@hynish/domain';
import { appError } from '../utils/errors.js';

export interface PostJournalInput {
  businessId: string;
  date: string;
  locationId: string;
  refType: JournalRefType;
  refId: string;
  refLabel: string;
  lines: JournalLineInput[];
  actorUid: string;
}

/**
 * Post a journal entry within `tx`. Returns the new entry id, or null when there are no non-zero
 * lines (BR-ACC-02 — not an error). Throws VALIDATION_FAILED when the entry does not balance.
 */
export function postJournalTx(tx: Transaction, db: Firestore, input: PostJournalInput): string | null {
  const pruned = pruneZeroLines(input.lines);
  if (pruned.length === 0) return null;

  const v = validateJournal(pruned);
  if (!v.ok) {
    throw appError('VALIDATION_FAILED', 'Accounting entry does not balance and was refused.');
  }

  const ref = db.collection(`businesses/${input.businessId}/journalEntries`).doc();
  tx.set(ref, {
    id: ref.id,
    businessId: input.businessId,
    date: input.date,
    locationId: input.locationId,
    refType: input.refType,
    refId: input.refId,
    refLabel: input.refLabel,
    lines: pruned,
    totalPaise: v.totalDebitPaise,
    status: 'posted',
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: input.actorUid,
    schemaVersion: 1,
  });
  return ref.id;
}

/** READ PHASE: fetch the posted (non-voided) journal entry refs for one (refType, refId). */
export async function readPostedJournalsForRef(
  tx: Transaction,
  db: Firestore,
  businessId: string,
  refType: JournalRefType,
  refId: string,
): Promise<DocumentReference[]> {
  const q = db
    .collection(`businesses/${businessId}/journalEntries`)
    .where('refType', '==', refType)
    .where('refId', '==', refId)
    .where('status', '==', 'posted');
  const snap = await tx.get(q);
  return snap.docs.map((d) => d.ref);
}

/** WRITE PHASE: void the given journal entry refs (BR-ACC-05). Kept for audit; excluded from balances. */
export function voidEntries(
  tx: Transaction,
  refs: DocumentReference[],
  actorUid: string,
  reason: 'edit' | 'delete' | 'restore',
): void {
  for (const ref of refs) {
    tx.update(ref, {
      status: 'voided',
      voidedAt: FieldValue.serverTimestamp(),
      voidedBy: actorUid,
      voidReason: reason,
    });
  }
}
