/**
 * Server-authoritative document numbering (BR-NUM-05/07, §16, §44). Runs inside a Firestore
 * transaction that atomically increments the per-series counter AND writes a uniqueness
 * reservation, so concurrent users/devices/locations can NEVER collide (fixes legacy KL-01).
 *
 * This core takes an Admin Firestore instance so it is testable against the emulator. The
 * callable (reserve.ts) wraps it with auth + permission.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  formatDocumentNumber,
  fyLabel,
  DEFAULT_PREFIXES,
  DEFAULT_INITIAL_SEQ,
  type SeriesKey,
  type ReserveNumberResult,
} from '@hynish/domain';

export interface ReserveCoreInput {
  businessId: string;
  seriesKey: SeriesKey;
  dateISO: string;
  actorUid: string;
}

const numberKey = (n: string) => n.replace(/\//g, '_');

export async function reserveNumber(db: Firestore, input: ReserveCoreInput): Promise<ReserveNumberResult> {
  const { businessId, seriesKey, dateISO, actorUid } = input;
  const fy = fyLabel(dateISO);
  const counterRef = db.doc(`businesses/${businessId}/counters/${seriesKey}`);
  const settingsRef = db.doc(`businesses/${businessId}/settings/business`);

  return db.runTransaction(async (tx) => {
    const [counterSnap, settingsSnap] = await Promise.all([tx.get(counterRef), tx.get(settingsRef)]);
    const counter = counterSnap.data() ?? {};
    const fyScoped = counter.fyScoped === true;

    // FY-scoped reset (only if enabled; default is a single continuous sequence — OQ-03).
    let nextSeq: number = typeof counter.nextSeq === 'number' ? counter.nextSeq : DEFAULT_INITIAL_SEQ;
    if (fyScoped && counter.fy && counter.fy !== fy) nextSeq = DEFAULT_INITIAL_SEQ;

    const prefix =
      (settingsSnap.data()?.prefixes?.[seriesKey] as string | undefined)?.trim() ||
      DEFAULT_PREFIXES[seriesKey];
    const number = formatDocumentNumber(prefix, fy, nextSeq);

    const reservationRef = db.doc(`businesses/${businessId}/documentNumbers/${numberKey(number)}`);
    const existing = await tx.get(reservationRef);
    if (existing.exists) {
      // Should not happen while the counter is authoritative; guards against manual counter edits.
      throw new Error(`NUMBER_TAKEN:${number}`);
    }

    tx.set(reservationRef, {
      seriesKey, number, fy, seq: nextSeq, issuedAt: FieldValue.serverTimestamp(), issuedBy: actorUid,
    });
    tx.set(
      counterRef,
      { seriesKey, nextSeq: nextSeq + 1, fyScoped, fy, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid },
      { merge: true },
    );

    return { number, seriesKey, fy, seq: nextSeq };
  });
}
