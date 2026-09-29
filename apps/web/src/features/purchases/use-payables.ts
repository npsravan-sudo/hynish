/**
 * Shared Payables data source (BR-DUE-07/08, mirrors receivables exactly — TD §6.7). ONE bounded
 * fetch, so any future Payables-derived widget (e.g. a Dashboard card) matches this report exactly.
 */
import { useEffect, useState } from 'react';
import type { Purchase } from '@hynish/domain';
import { useRepositories } from '@/hooks/use-master-data';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';

const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 300, filters: [{ field: 'deletedAt', op: '==', value: null }] };

export function useOutstandingPurchaseSource(): { purchases: Purchase[]; loading: boolean; error: string | null; refresh: () => void } {
  const repos = useRepositories();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    repos.purchases.list(PARAMS)
      .then((p) => !cancelled && setPurchases(p.items))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load purchases'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [repos, tick]);

  return { purchases, loading, error, refresh: () => setTick((t) => t + 1) };
}
