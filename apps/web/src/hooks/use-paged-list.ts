/**
 * Cursor-paginated list hook (Phase 4 §27, §49). Wraps a repository's `list` — loads a page,
 * supports load-more (append) and refresh (reset). Never downloads the whole collection.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ListParams, ReadRepository } from '@/infrastructure/repositories/firestore-repository';
import { mapCallableError } from '@/lib/errors';

export interface PagedListState<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function usePagedList<T>(repo: ReadRepository<T>, params: ListParams): PagedListState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  // Serialize params so identical filters don't retrigger.
  const key = JSON.stringify(params);
  const reqIdRef = useRef(0);

  const fetchPage = useCallback(
    async (append: boolean) => {
      const reqId = ++reqIdRef.current;
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        cursorRef.current = null;
      }
      setError(null);
      try {
        const page = await repo.list({ ...params, cursor: append ? cursorRef.current : null });
        if (reqId !== reqIdRef.current) return; // a newer request superseded this one
        cursorRef.current = page.nextCursor;
        setHasMore(page.hasMore);
        setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      } catch (e) {
        if (reqId === reqIdRef.current) setError(mapCallableError(e));
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repo, key],
  );

  useEffect(() => {
    void fetchPage(false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) void fetchPage(true);
  }, [fetchPage, hasMore, loadingMore]);
  const refresh = useCallback(() => void fetchPage(false), [fetchPage]);

  return { items, loading, loadingMore, error, hasMore, loadMore, refresh };
}
