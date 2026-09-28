/**
 * Inventory reference-data hooks (Phase 6 §40, §41). Load products (for name/threshold lookup) and
 * stock levels for a location through the repositories — never Firestore directly. Location-scoped
 * reads keep queries bounded and honour location isolation.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Product, StockLevel } from '@hynish/domain';
import { useRepositories } from '@/hooks/use-master-data';

const SCAN = 500;

export function useProductsById(): { byId: Map<string, Product>; products: Product[]; loading: boolean } {
  const repos = useRepositories();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repos.products.list({ orderByField: 'nameLower', direction: 'asc', limit: SCAN, filters: [{ field: 'deletedAt', op: '==', value: null }] })
      .then((p) => !cancelled && setProducts(p.items))
      .catch(() => !cancelled && setProducts([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [repos]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  return { byId, products, loading };
}

export function useStockLevels(locationId: string | null, refreshKey = 0): { levels: StockLevel[]; loading: boolean; error: string | null } {
  const repos = useRepositories();
  const [levels, setLevels] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!locationId) { setLevels([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    repos.stockLevels.list({ filters: [{ field: 'locationId', op: '==', value: locationId }], orderByField: 'qty', direction: 'asc', limit: SCAN })
      .then((p) => !cancelled && setLevels(p.items))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load stock'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [repos, locationId, refreshKey]);
  return { levels, loading, error };
}
