import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookText } from 'lucide-react';
import { formatINR, accountBalance } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories } from '@/hooks/use-master-data';
import type { ListParams } from '@/infrastructure/repositories/firestore-repository';
import { useLedgerAggregate } from './use-ledger-aggregate';
import { useAllAccounts } from './use-accounts';

/** General Ledger (BR-ACC-16): per-account running balance, sorted by date then createdAt. Every
 * business event already posts a journal line, so this is the authoritative "why did this account
 * change" view — no separate ledger table is maintained (TD §6.2). */
export function GeneralLedgerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const repos = useRepositories();
  const locations = useAuthStore((s) => s.locations);
  const { accounts } = useAllAccounts();
  const accountId = searchParams.get('accountId') ?? '';
  const [locationId, setLocationId] = useState<'all' | string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const account = accounts.find((a) => a.id === accountId) ?? null;

  const params: ListParams = useMemo(() => {
    const filters: ListParams['filters'] = accountId ? [{ field: 'accountIds', op: 'array-contains', value: accountId }] : [];
    if (from) filters!.push({ field: 'date', op: '>=', value: from });
    if (to) filters!.push({ field: 'date', op: '<=', value: to });
    return { filters, orderByField: 'date', direction: 'asc', limit: 500 };
  }, [accountId, from, to]);

  const { items, loading, error, truncated, refresh } = useLedgerAggregate(repos.journalEntries, params);

  const rows = useMemo(() => {
    if (!account) return [];
    let running = 0;
    return items
      .filter((e) => e.status === 'posted')
      .filter((e) => locationId === 'all' || e.locationId === locationId)
      .flatMap((e) =>
        e.lines
          .filter((l) => l.accountId === accountId)
          .map((l) => {
            running += accountBalance(account.type, l.debitPaise, l.creditPaise);
            return { entry: e, line: l, running };
          }),
      );
  }, [items, account, accountId, locationId]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="General Ledger"
        description="Pick an account to see every posted line and its running balance, sorted by date."
      />
      <SectionCard title="Filters">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="Account" htmlFor="gl-account" className="sm:col-span-2">
            <Select value={accountId} onValueChange={(v) => setSearchParams(v ? { accountId: v } : {})}>
              <SelectTrigger id="gl-account"><SelectValue placeholder="Choose an account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Location" htmlFor="gl-loc">
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="gl-loc"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="From" htmlFor="gl-from"><Input id="gl-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" htmlFor="gl-to"><Input id="gl-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      </SectionCard>

      {!accountId ? (
        <EmptyState icon={BookText} title="Choose an account" description="Select an account above to view its ledger." />
      ) : loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState icon={BookText} title="No activity" description="No posted lines match these filters." />
      ) : (
        <SectionCard title={account ? `${account.code} — ${account.name}` : ''} {...(truncated ? { description: 'Showing the most recent activity — the ledger is large, so results are capped.' } : {})}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Reference</TableHead>
                <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.entry.id}-${i}`}>
                    <TableCell>{r.entry.date}</TableCell>
                    <TableCell><span className="num">{r.entry.refLabel || r.entry.refId}</span> <span className="text-xs capitalize text-muted-foreground">{r.entry.refType.replace(/_/g, ' ')}</span></TableCell>
                    <TableCell className="num text-right">{r.line.debitPaise > 0 ? formatINR(r.line.debitPaise) : '—'}</TableCell>
                    <TableCell className="num text-right">{r.line.creditPaise > 0 ? formatINR(r.line.creditPaise) : '—'}</TableCell>
                    <TableCell className="num text-right font-medium">{formatINR(r.running)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
