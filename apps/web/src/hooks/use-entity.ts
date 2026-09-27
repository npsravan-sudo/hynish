/** Fetch a single entity by id through a repository (Phase 4 §45, §47 deep-linking). */
import { useEffect, useState } from 'react';
import type { ReadRepository } from '@/infrastructure/repositories/firestore-repository';
import { mapCallableError } from '@/lib/errors';

export interface EntityState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  reload: () => void;
}

export function useEntity<T>(repo: ReadRepository<T>, id: string | undefined): EntityState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    repo
      .get(id)
      .then((r) => active && setData(r))
      .catch((e) => active && setError(mapCallableError(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [repo, id, tick]);

  return { data, loading, error, notFound: !loading && !error && data === null, reload: () => setTick((t) => t + 1) };
}
