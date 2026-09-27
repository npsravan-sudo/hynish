import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { formatINR } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { ActiveBadge } from '@/features/_shared/master-data';
import { DetailRow } from '@/features/_shared/detail-row';

export function LocationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const can = useAuthStore((s) => s.hasPermission);
  const { data: l, loading, error, notFound } = useEntity(repos.locations, id);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !l) return <ErrorState title="Location not found" message={error ?? 'It may have been removed.'} />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={l.name}
        description={<span className="capitalize">{l.type}</span>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/inventory/locations')}><ArrowLeft /> Back</Button>
            {can('locations.manage') && <Button variant="outline" onClick={() => navigate(`/inventory/locations/${l.id}/edit`)}><Pencil /> Edit</Button>}
          </div>
        }
      />
      <SectionCard title="Overview" action={<ActiveBadge deletedAt={l.deletedAt} />}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <DetailRow label="Type" value={<span className="capitalize">{l.type}</span>} />
          <DetailRow label="Default" value={l.isDefault ? <Badge variant="info">Yes</Badge> : 'No'} />
          <DetailRow label="Opening cash balance" value={formatINR(l.openingCashBalancePaise)} />
          <DetailRow label="Address" value={l.address} className="sm:col-span-2" />
        </div>
      </SectionCard>
    </div>
  );
}
