import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { stateName } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
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

export function SupplierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useMasterDataService();
  const can = useAuthStore((s) => s.hasPermission);
  const { data: s, loading, error, notFound, reload } = useEntity(repos.suppliers, id);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !s) return <ErrorState title="Supplier not found" message={error ?? 'It may have been removed.'} />;

  async function toggleActive() {
    if (!s) return;
    const activate = isArchived(s);
    if (!activate) {
      const ok = await confirm({ title: `Archive ${s.name}?`, description: 'Purchases keep their details.', confirmLabel: 'Archive', danger: true });
      if (!ok) return;
    }
    try {
      await service.suppliers.setActive(s.id, activate);
      toast.success(activate ? 'Supplier restored' : 'Supplier archived');
      reload();
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={s.name}
        description={s.gstin ? `GSTIN ${s.gstin}` : 'No GSTIN'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/inventory/suppliers')}><ArrowLeft /> Back</Button>
            {can('suppliers.manage') && <Button variant="outline" onClick={() => navigate(`/inventory/suppliers/${s.id}/edit`)}><Pencil /> Edit</Button>}
            {!isArchived(s) && can('suppliers.delete') && <Button variant="outline" onClick={() => void toggleActive()}><Archive /> Archive</Button>}
            {isArchived(s) && can('suppliers.manage') && <Button variant="outline" onClick={() => void toggleActive()}><ArchiveRestore /> Restore</Button>}
          </div>
        }
      />
      <SectionCard title="Overview" action={<ActiveBadge deletedAt={s.deletedAt} />}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <DetailRow label="Contact person" value={s.contactPerson} />
          <DetailRow label="Phone" value={s.phone} />
          <DetailRow label="GSTIN" value={s.gstin} />
          <DetailRow label="State" value={stateName(s.stateCode)} />
          <DetailRow label="City" value={s.city} />
          <DetailRow label="Address" value={s.address} className="sm:col-span-2" />
        </div>
      </SectionCard>
    </div>
  );
}
