import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { formatINR, newRequestId } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, useAccountingService } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { mapCallableError } from '@/lib/errors';
import { DetailRow } from '@/features/_shared/detail-row';

export function ExpenseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useAccountingService();
  const canManage = useAuthStore((s) => s.hasPermission('expenses.manage'));
  const canViewAccounting = useAuthStore((s) => s.hasPermission('accounting.view'));
  const locations = useAuthStore((s) => s.locations);
  const { data: e, loading, error, notFound } = useEntity(repos.expenses, id);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !e) return <ErrorState title="Expense not found" message={error ?? 'It may have been removed.'} />;

  const locName = locations.find((l) => l.id === e.locationId)?.name ?? e.locationId;

  async function onDelete() {
    if (!e) return;
    const ok = await confirm({ title: 'Delete this expense?', description: 'This reverses its journal entry. This cannot be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await service.expenses.remove(e.id, newRequestId());
      toast.success('Expense deleted');
      navigate('/accounting/expenses');
    } catch (err) {
      toast.error(mapCallableError(err));
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={e.categoryNameSnapshot}
        description={<span className="text-muted-foreground">{e.date}</span>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/accounting/expenses')}><ArrowLeft /> Back</Button>
            {canManage && <Button variant="outline" onClick={() => navigate(`/accounting/expenses/${e.id}/edit`)}><Pencil /> Edit</Button>}
            {canManage && <Button variant="outline" onClick={() => void onDelete()}><Trash2 /> Delete</Button>}
          </div>
        }
      />
      <SectionCard title="Details">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <DetailRow label="Category" value={e.categoryNameSnapshot} />
          <DetailRow label="Location" value={locName} />
          <DetailRow label="Amount" value={formatINR(e.amountPaise)} />
          <DetailRow label="Payment mode" value={e.mode} />
          <DetailRow label="Notes" value={e.notes || '—'} />
        </div>
      </SectionCard>
      <SectionCard title="Accounting">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Dr {e.categoryNameSnapshot} · Cr {e.mode === 'Cash' ? 'Cash in Hand' : 'Bank Account'}</p>
          {canViewAccounting && e.journalEntryId && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/accounting/journal/${e.journalEntryId}`)}>View journal entry</Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
