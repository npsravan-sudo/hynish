/** Typed reader for a single Firestore document (e.g. settings/business). Read + realtime only. */
import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import type { z, ZodTypeAny } from 'zod';
import { getDb } from '@/lib/firebase/firestore';
import { timestampsToMillis } from '../firestore/converter';

export interface DocumentReader<T> {
  get(): Promise<T | null>;
  watch(cb: (data: T | null) => void, onError?: (e: Error) => void): Unsubscribe;
}

export function createDocumentReader<S extends ZodTypeAny>(
  docPath: string,
  schema: S,
): DocumentReader<z.output<S>> {
  type T = z.output<S>;
  const ref = () => doc(getDb(), docPath);
  function parse(exists: boolean, raw: unknown, id: string): T | null {
    if (!exists) return null;
    const withId = { id, ...(timestampsToMillis(raw) as Record<string, unknown>) };
    const parsed = schema.safeParse(withId);
    if (!parsed.success) {
      if (import.meta.env.DEV) throw new Error(`Invalid ${docPath}: ${parsed.error.message}`);
      console.error(`Invalid ${docPath}`);
      return null;
    }
    return parsed.data;
  }
  return {
    async get() {
      const snap = await getDoc(ref());
      return parse(snap.exists(), snap.data(), snap.id);
    },
    watch(cb, onError) {
      return onSnapshot(
        ref(),
        (snap) => cb(parse(snap.exists(), snap.data(), snap.id)),
        (err) => onError?.(err),
      );
    },
  };
}
