/** All accounts for a business — a Chart of Accounts is a handful of documents, so a single
 * bounded fetch (no pagination) is fine and is reused by every statement/ledger page. */
import { useEffect, useState } from 'react';
import type { Account } from '@hynish/domain';
import { useRepositories } from '@/hooks/use-master-data';

export function useAllAccounts(): { accounts: Account[]; loading: boolean } {
  const repos = useRepositories();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repos.accounts
      .list({ orderByField: 'code', direction: 'asc', limit: 200, filters: [] })
      .then((p) => !cancelled && setAccounts(p.items))
      .catch(() => !cancelled && setAccounts([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [repos]);
  return { accounts, loading };
}
