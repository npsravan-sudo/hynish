/**
 * Shared Receivables data source (BR-DUE-01..04/08). ONE bounded fetch, reused by the Dues report
 * and the Dashboard's Outstanding Dues card, so the two never disagree (§60/§61). Bounded by date
 * (most recent first) rather than a full scan — the same accepted convention as every other list
 * in this app (§44); an invoice older than the window that's still unpaid is a known limitation,
 * not a silent bug (documented in docs/PHASE-9-COMPLETION.md).
 */
import { useEffect, useState } from 'react';
import type { Invoice } from '@hynish/domain';
import { useRepositories } from '@/hooks/use-master-data';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';

const PARAMS: ListParams = { orderByField: 'date', direction: 'desc', limit: 300, filters: [{ field: 'deletedAt', op: '==', value: null }] };

export function useOutstandingInvoiceSource(): { invoices: Invoice[]; loading: boolean; error: string | null; refresh: () => void } {
  const repos = useRepositories();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    repos.invoices.list(PARAMS)
      .then((p) => !cancelled && setInvoices(p.items))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load invoices'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [repos, tick]);

  return { invoices, loading, error, refresh: () => setTick((t) => t + 1) };
}
