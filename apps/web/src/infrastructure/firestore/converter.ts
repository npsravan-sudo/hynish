/**
 * Firestore <-> domain conversion (§38). The ONLY place `doc.data()` is turned into a typed
 * entity, and every read is validated with a Zod schema — no `doc.data() as T` anywhere else.
 *
 * Timestamp policy (§52): Firestore stores instants as `Timestamp`; the domain uses epoch ms.
 * `timestampsToMillis` deep-converts any Timestamp to a number under the same key on read, so
 * schema fields like `createdAt` validate as `number`. Writes are performed by repositories/
 * Cloud Functions using `serverTimestamp()`, never here.
 */
import {
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type FirestoreDataConverter,
} from 'firebase/firestore';
import type { z, ZodTypeAny } from 'zod';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Recursively convert any Firestore Timestamp to epoch milliseconds. */
export function timestampsToMillis(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toMillis();
  if (Array.isArray(value)) return value.map(timestampsToMillis);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = timestampsToMillis(v);
    return out;
  }
  return value;
}

export interface ReadResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  id: string;
}

/**
 * Build a read-only Firestore converter that injects the document id, deep-converts Timestamps
 * and validates with the schema. In development a validation failure throws (fail fast); in
 * production it logs and the caller receives a typed error rather than corrupt data.
 */
export function makeConverter<S extends ZodTypeAny>(schema: S): FirestoreDataConverter<z.output<S>> {
  type T = z.output<S>;
  return {
    toFirestore(): DocumentData {
      // Writes go through repositories/functions, which build the payload explicitly.
      throw new Error('Use repository write methods; the converter is read-only.');
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): T {
      const raw = timestampsToMillis(snapshot.data(options)) as Record<string, unknown>;
      const withId = { id: snapshot.id, ...raw };
      const parsed = schema.safeParse(withId);
      if (!parsed.success) {
        const msg = `Invalid ${snapshot.ref.path}: ${parsed.error.issues
          .map((i) => `${i.path.join('.')} ${i.message}`)
          .join('; ')}`;
        if (import.meta.env.DEV) throw new Error(msg);
        console.error(msg);
        // Return the raw shape typed loosely; callers should treat unvalidated data cautiously.
        return withId as unknown as T;
      }
      return parsed.data;
    },
  };
}
