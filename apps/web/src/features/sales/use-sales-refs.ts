/**
 * Reference-data hooks for Sales forms (Phase 5 §11, §12). Load ACTIVE customers/products and the
 * business settings (for the seller's state) through the repositories — never Firestore directly.
 * Bounded reads (no full-collection scan); the form filters client-side over the loaded page.
 */
import { useEffect, useState } from 'react';
import type { Customer, Product, BusinessSettings } from '@hynish/domain';
import { useRepositories } from '@/hooks/use-master-data';

const SCAN_LIMIT = 500;
const ACTIVE = { orderByField: 'nameLower', direction: 'asc' as const, limit: SCAN_LIMIT, filters: [{ field: 'deletedAt', op: '==' as const, value: null }] };

export function useActiveCustomers(): { customers: Customer[]; loading: boolean } {
  const repos = useRepositories();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repos.customers.list(ACTIVE)
      .then((p) => !cancelled && setCustomers(p.items))
      .catch(() => !cancelled && setCustomers([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [repos]);
  return { customers, loading };
}

export function useActiveProducts(): { products: Product[]; loading: boolean } {
  const repos = useRepositories();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repos.products.list(ACTIVE)
      .then((p) => !cancelled && setProducts(p.items))
      .catch(() => !cancelled && setProducts([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [repos]);
  return { products, loading };
}

export function useBusinessSettings(): BusinessSettings | null {
  const repos = useRepositories();
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  useEffect(() => {
    const unsub = repos.businessSettings.watch((s) => setSettings(s), () => setSettings(null));
    return () => unsub();
  }, [repos]);
  return settings;
}
