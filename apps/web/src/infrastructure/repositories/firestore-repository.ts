/**
 * Generic typed READ repository over a Firestore collection (§40, §49, §65). Repositories are
 * the ONLY client code that talks to Firestore. They expose domain-oriented reads — get / list
 * (cursor-paginated) / watch (realtime) — never a generic saveAnything(). Writes for critical
 * collections are server-authoritative (Cloud Functions), so this phase provides reads + realtime;
 * write methods arrive with their modules and always go through services -> callables.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fbLimit,
  startAfter,
  documentId,
  type QueryConstraint,
  type WhereFilterOp,
  type Unsubscribe,
} from 'firebase/firestore';
import type { z, ZodTypeAny } from 'zod';
import type { Page } from '@hynish/domain';
import { getDb } from '@/lib/firebase/firestore';
import { makeConverter } from '../firestore/converter';

export interface WhereClause {
  field: string;
  op: WhereFilterOp;
  value: unknown;
}

export interface ListParams {
  filters?: WhereClause[];
  orderByField?: string;
  direction?: 'asc' | 'desc';
  limit?: number;
  /** Opaque cursor from a previous page's `nextCursor`. */
  cursor?: string | null;
}

export interface ReadRepository<T> {
  get(id: string): Promise<T | null>;
  list(params?: ListParams): Promise<Page<T>>;
  watch(params: ListParams | undefined, cb: (page: T[]) => void, onError?: (e: Error) => void): Unsubscribe;
}

interface CursorPayload {
  o?: unknown; // order field value (when ordering by a field)
  id: string;
}

function encodeCursor(p: CursorPayload): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(p))));
}
function decodeCursor(cursor: string): CursorPayload | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(cursor)))) as CursorPayload;
  } catch {
    return null;
  }
}

export function createReadRepository<S extends ZodTypeAny>(
  collectionPath: string,
  schema: S,
): ReadRepository<z.output<S>> {
  const converter = makeConverter(schema);
  const col = () => collection(getDb(), collectionPath).withConverter(converter);

  function buildConstraints(params: ListParams | undefined, forQuery: boolean): QueryConstraint[] {
    const c: QueryConstraint[] = [];
    for (const f of params?.filters ?? []) c.push(where(f.field, f.op, f.value));
    const dir = params?.direction ?? 'asc';
    if (params?.orderByField) c.push(orderBy(params.orderByField, dir));
    c.push(orderBy(documentId(), dir)); // stable tiebreak for cursoring
    if (forQuery) {
      if (params?.cursor) {
        const cur = decodeCursor(params.cursor);
        if (cur) {
          c.push(params?.orderByField ? startAfter(cur.o, cur.id) : startAfter(cur.id));
        }
      }
      c.push(fbLimit((params?.limit ?? 25) + 1)); // +1 to detect hasMore
    }
    return c;
  }

  return {
    async get(id) {
      const snap = await getDoc(doc(getDb(), collectionPath, id).withConverter(converter));
      return snap.exists() ? snap.data() : null;
    },

    async list(params) {
      const limit = params?.limit ?? 25;
      const snap = await getDocs(query(col(), ...buildConstraints(params, true)));
      const docs = snap.docs;
      const hasMore = docs.length > limit;
      const pageDocs = hasMore ? docs.slice(0, limit) : docs;
      const items = pageDocs.map((d) => d.data());
      const last = pageDocs.at(-1);
      const nextCursor =
        hasMore && last
          ? encodeCursor({
              id: last.id,
              o: params?.orderByField ? (last.data() as Record<string, unknown>)[params.orderByField] : undefined,
            })
          : null;
      return { items, nextCursor, hasMore };
    },

    watch(params, cb, onError) {
      const constraints = buildConstraints(params, false);
      if (params?.limit) constraints.push(fbLimit(params.limit));
      return onSnapshot(
        query(col(), ...constraints),
        (snap) => cb(snap.docs.map((d) => d.data())),
        (err) => onError?.(err),
      ) as Unsubscribe;
    },
  };
}
