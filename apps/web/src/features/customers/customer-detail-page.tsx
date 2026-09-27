import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { formatINR, stateName } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, useMasterDataService } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { mapCallableError } from '@/lib/errors';
import { ActiveBadge, isArchived } from '@/features/_shared/master-data';
import { DetailRow } from '@/features/_shared/detail-row';

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useMasterDataService();
  const can = useAuthStore((s) => s.hasPermission);
  const { data: c, loading, error, notFound, reload } = useEntity(repos.customers, id);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !c) return <ErrorState title="Customer not found" message={error ?? 'It may have been removed.'} />;

  async function toggleActive() {
    if (!c) return;
    const activate = isArchived(c);
    if (!activate) {
      const ok = await confirm({ title: `Archive ${c.name}?`, description: 'Invoices keep their details.', confirmLabel: 'Archive', danger: true });
      if (!ok) return;
    }
    try {
      await service.customers.setActive(c.id, activate);
      toast.success(activate ? 'Customer restored' : 'Customer archived');
      reload();
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={c.name}
        description={c.gstin ? `GSTIN ${c.gstin}` : 'B2C / cash buyer'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/customers')}>
              <ArrowLeft /> Back
            </Button>
            {can('customers.manage') && (
              <Button variant="outline" onClick={() => navigate(`/customers/${c.id}/edit`)}>
                <Pencil /> Edit
              </Button>
            )}
            {!isArchived(c) && can('customers.delete') && (
              <Button variant="outline" onClick={() => void toggleActive()}>
                <Archive /> Archive
              </Button>
            )}
            {isArchived(c) && can('customers.manage') && (
              <Button variant="outline" onClick={() => void toggleActive()}>
                <ArchiveRestore /> Restore
              </Button>
            )}
          </div>
        }
      />

      <SectionCard title="Overview" action={<ActiveBadge deletedAt={c.deletedAt} />}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <DetailRow label="Contact person" value={c.contactPerson} />
          <DetailRow label="Phone" value={c.phone} />
          <DetailRow label="GSTIN" value={c.gstin || 'B2C'} />
          <DetailRow label="State" value={stateName(c.stateCode)} />
          <DetailRow label="City" value={c.city} />
          <DetailRow
            label="Credit limit"
            value={c.creditLimitPaise ? formatINR(c.creditLimitPaise) : <Badge variant="secondary">No limit</Badge>}
          />
          <DetailRow label="Address" value={c.address} className="sm:col-span-2" />
        </div>
      </SectionCard>
    </div>
  );
}
