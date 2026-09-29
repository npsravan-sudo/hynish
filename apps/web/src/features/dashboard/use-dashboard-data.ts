/**
 * Dashboard data source (BR-RPT-01/02/03/09, TD §3.1). One bounded invoice fetch (last 95 days,
 * covers Today/This-Month/Last-Month/the 90-day trend option) feeds every sales-derived widget —
 * not one query per KPI (§53/§14). Outstanding Dues reuses the separate shared receivables source
 * (`use-receivables.ts`) so its number matches the Dues report exactly (§60/§61). Low Stock reuses
 * the existing Phase 6 inventory hooks. No realtime listeners — a manual refresh re-fetches.
 */
import { useEffect, useMemo, useState } from 'react';
import { addDaysISO, todayISO, type Invoice } from '@hynish/domain';
import { useRepositories } from '@/hooks/use-master-data';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';

const TREND_WINDOW_DAYS = 95;

export function useDashboardInvoices(): { invoices: Invoice[]; loading: boolean; error: string | null; refresh: () => void } {
  const repos = useRepositories();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const params: ListParams = useMemo(() => ({
    orderByField: 'date', direction: 'desc', limit: 2000,
    filters: [
      { field: 'deletedAt', op: '==', value: null },
      { field: 'date', op: '>=', value: addDaysISO(todayISO(), -TREND_WINDOW_DAYS) },
    ],
  }), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    repos.invoices.list(params)
      .then((p) => {
        if (cancelled) return;
        // BR-RPT-09: true date + createdAt sort (newest first), not just the query's date order.
        const sorted = [...p.items].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date < a.date ? -1 : 1));
        setInvoices(sorted);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load sales'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [repos, params, tick]);

  return { invoices, loading, error, refresh: () => setTick((t) => t + 1) };
}
