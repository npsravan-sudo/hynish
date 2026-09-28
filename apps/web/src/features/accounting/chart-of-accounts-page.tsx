import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, BookOpen, Sparkles } from 'lucide-react';
import { ACCOUNT_TYPES, type Account, type AccountType } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { EmptyState } from '@/components/feedback/empty-state';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, useAccountingService } from '@/hooks/use-master-data';
import { mapCallableError } from '@/lib/errors';
import { AddAccountDialog } from './add-account-dialog';

const TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity', income: 'Income', expense: 'Expense',
};

export function ChartOfAccountsPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useAccountingService();
  const canManage = useAuthStore((s) => s.hasPermission('accounts.manage'));
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setAccounts(null);
    setError(null);
    repos.accounts
      .list({ orderByField: 'code', direction: 'asc', limit: 200, filters: [{ field: 'deletedAt', op: '==', value: null }] })
      .then((p) => !cancelled && setAccounts(p.items))
      .catch((e) => !cancelled && setError(mapCallableError(e)));
    return () => { cancelled = true; };
  }, [repos, refreshKey]);

  async function seed() {
    setSeeding(true);
    try {
      const res = await service.accounts.seedDefaults();
      toast.success(res.created > 0 ? `${res.created} default account(s) created` : 'Default accounts already exist');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setSeeding(false);
    }
  }

  async function onDelete(a: Account) {
    const ok = await confirm({
      title: `Delete ${a.name}?`,
      description: 'This account will be permanently removed. Refused if any journal entry references it.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await service.accounts.remove(a.id);
      toast.success('Account deleted');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  if (accounts === null && !error) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => setRefreshKey((k) => k + 1)} />;

  const grouped = ACCOUNT_TYPES.map((type) => ({
    type,
    items: (accounts ?? []).filter((a) => a.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Chart of Accounts"
        description="The 14 system accounts plus any custom accounts. System accounts cannot be deleted (BR-ACC-17)."
        actions={
          canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => void seed()} loading={seeding}>
                <Sparkles /> Seed default accounts
              </Button>
              <Button onClick={() => setAddOpen(true)}><Plus /> Add account</Button>
            </div>
          )
        }
      />

      {grouped.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No accounts yet"
          description="Seed the default Chart of Accounts to get started."
          action={canManage ? <Button onClick={() => void seed()} loading={seeding}><Sparkles /> Seed default accounts</Button> : undefined}
        />
      ) : (
        grouped.map((g) => (
          <SectionCard key={g.type} title={TYPE_LABEL[g.type]}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Normal side</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.items.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/accounting/general-ledger?accountId=${a.id}`)}>
                      <TableCell className="num">{a.code}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {a.name}
                          {a.isSystem && <Badge variant="secondary">System</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{a.normalSide}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {canManage && !a.isSystem && (
                          <Button variant="ghost" size="icon" aria-label="Delete account" onClick={() => void onDelete(a)}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        ))
      )}

      {addOpen && <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} onDone={() => setRefreshKey((k) => k + 1)} />}
    </div>
  );
}
