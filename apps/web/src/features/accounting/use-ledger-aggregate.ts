/**
 * Bounded full-ledger aggregation (Phase 7 §35, TD §6.1.7/§6.2). Trial Balance, P&L and Balance
 * Sheet are — exactly as in the source — "computed live from the journal, nothing cached" (never a
 * separately stored statement). That means summing every non-voided journal line, which the source
 * itself does over the full in-memory journal array. We preserve that behaviour but avoid an
 * unbounded read: pages are fetched via the cursor-paginated repository up to a documented cap
 * (`LEDGER_FETCH_CAP`), and the result reports whether it was truncated so the UI can say so rather
 * than silently understating the books. This is a scaling caveat carried over honestly from the
 * source's own "recomputed from the full array" design, not a new limitation invented here.
 */
import { useEffect, useRef, useState } from 'react';
import type { ListParams, ReadRepository } from '@/infrastructure/repositories/firestore-repository';
import { mapCallableError } from '@/lib/errors';

/** Generous enough for a wholesale shop's lifetime ledger while keeping reads bounded (§35, §56). */
export const LEDGER_FETCH_CAP = 5000;

export async function fetchAllPages<T>(
  repo: ReadRepository<T>,
  params: ListParams,
  cap: number = LEDGER_FETCH_CAP,
): Promise<{ items: T[]; truncated: boolean }> {
  const pageSize = params.limit ?? 500;
  let cursor: string | null = params.cursor ?? null;
  let items: T[] = [];
  let truncated = false;
  for (;;) {
    const page = await repo.list({ ...params, limit: pageSize, cursor });
    items = items.concat(page.items);
    if (items.length >= cap) {
      truncated = page.hasMore || items.length > cap;
      items = items.slice(0, cap);
      break;
    }
    if (!page.hasMore) break;
    cursor = page.nextCursor;
  }
  return { items, truncated };
}

export interface LedgerAggregateState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
  refresh: () => void;
}

/** Fetch-all-pages hook with loading/error state, re-fetching when `params` changes (by JSON identity). */
export function useLedgerAggregate<T>(repo: ReadRepository<T>, params: ListParams, cap = LEDGER_FETCH_CAP): LedgerAggregateState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const key = JSON.stringify(params);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    fetchAllPages(repo, params, cap)
      .then((res) => {
        if (reqId !== reqIdRef.current) return;
        setItems(res.items);
        setTruncated(res.truncated);
      })
      .catch((e) => {
        if (reqId === reqIdRef.current) setError(mapCallableError(e));
      })
      .finally(() => {
        if (reqId === reqIdRef.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, key, cap]);

  function refresh() {
    reqIdRef.current += 1; // invalidate any in-flight fetch tied to the old key
    const reqId = reqIdRef.current;
    setLoading(true);
    setError(null);
    fetchAllPages(repo, params, cap)
      .then((res) => {
        if (reqId !== reqIdRef.current) return;
        setItems(res.items);
        setTruncated(res.truncated);
      })
      .catch((e) => {
        if (reqId === reqIdRef.current) setError(mapCallableError(e));
      })
      .finally(() => {
        if (reqId === reqIdRef.current) setLoading(false);
      });
  }

  return { items, loading, error, truncated, refresh };
}
