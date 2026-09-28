import { useEffect, useMemo, useState } from 'react';
import { Plus, Banknote } from 'lucide-react';
import { formatINR, type Location } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories } from '@/hooks/use-master-data';
import { useLedgerAggregate } from './use-ledger-aggregate';
import { LogCashEntryDialog } from './log-cash-entry-dialog';

/** Cash Book (BR-CASH-01..04, TD §6.3): a separate, informal ledger — never posts to the journal.
 * Balance at a location = that location's own openingCashBalance + all-time net of its entries;
 * there is no combined all-locations cash balance (BR-CASH-03). */
export function CashBookPage() {
  const repos = useRepositories();
  const currentLocationId = useAuthStore((s) => s.currentLocationId);
  const canManage = useAuthStore((s) => s.hasPermission('cashbook.manage'));
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<string>('');
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void repos.locations.list({ orderByField: 'sortOrder', direction: 'asc', limit: 100, filters: [{ field: 'deletedAt', op: '==', value: null }] })
      .then((p) => {
        if (cancelled) return;
        setLocations(p.items);
        setLocationId((prev) => prev || currentLocationId || p.items[0]?.id || '');
      }).catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos]);

  const params = useMemo(() => ({
    filters: locationId ? [{ field: 'locationId', op: '==' as const, value: locationId }] : [],
    orderByField: 'date' as const,
    direction: 'desc' as const,
    limit: 500,
  }), [locationId]);
  const { items: entries, loading, error, truncated, refresh } = useLedgerAggregate(repos.cashEntries, params);

  const location = locations.find((l) => l.id === locationId) ?? null;
  const net = entries.reduce((s, e) => s + (e.type === 'in' ? e.amountPaise : -e.amountPaise), 0);
  const balance = (location?.openingCashBalancePaise ?? 0) + net;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cash Book"
        description="A separate, informal cash ledger — entries here never post to the journal (BR-CASH-02)."
        actions={canManage && locationId && <Button onClick={() => setLogOpen(true)}><Plus /> Log entry</Button>}
        filters={
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-48" aria-label="Location"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SectionCard title="Opening balance"><p className="num text-2xl font-bold">{formatINR(location?.openingCashBalancePaise ?? 0)}</p></SectionCard>
        <SectionCard title="Net (all-time)"><p className={`num text-2xl font-bold ${net >= 0 ? 'text-success' : 'text-danger'}`}>{formatINR(net)}</p></SectionCard>
        <SectionCard title="Balance"><p className="num text-2xl font-bold">{formatINR(balance)}</p></SectionCard>
      </div>

      {loading ? <TableSkeleton rows={6} cols={5} /> : error ? <ErrorState message={error} onRetry={refresh} /> : entries.length === 0 ? (
        <EmptyState icon={Banknote} title="No entries yet" description="Log a Cash Book entry to start tracking cash at this location." />
      ) : (
        <SectionCard title="Entries" {...(truncated ? { description: 'The ledger is large — showing the most recent activity only.' } : {})}>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead>
                <TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell><Badge variant={e.type === 'in' ? 'success' : 'secondary'} className="capitalize">{e.type}</Badge></TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell>{e.mode}</TableCell>
                    <TableCell className={`num text-right font-medium ${e.type === 'in' ? 'text-success' : 'text-danger'}`}>{e.type === 'in' ? '+' : '−'}{formatINR(e.amountPaise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 md:hidden">
            {entries.map((e) => (
              <Card key={e.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div><p className="font-medium">{e.category}</p><p className="text-xs text-muted-foreground">{e.date} · {e.mode}</p></div>
                  <div className="text-right">
                    <p className={`num font-semibold ${e.type === 'in' ? 'text-success' : 'text-danger'}`}>{e.type === 'in' ? '+' : '−'}{formatINR(e.amountPaise)}</p>
                    <Badge variant={e.type === 'in' ? 'success' : 'secondary'} className="capitalize">{e.type}</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </SectionCard>
      )}

      {logOpen && locationId && <LogCashEntryDialog locationId={locationId} open={logOpen} onOpenChange={setLogOpen} onDone={refresh} />}
    </div>
  );
}
