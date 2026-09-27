import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive, ArchiveRestore, ImageIcon } from 'lucide-react';
import { formatINR } from '@hynish/domain';
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
import { resolveImageUrl } from '@/infrastructure/storage/product-image';
import { ActiveBadge, isArchived } from '@/features/_shared/master-data';
import { DetailRow } from '@/features/_shared/detail-row';

function ProductPhoto({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    resolveImageUrl(path)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setUrl(null));
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        <div className="flex flex-col items-center gap-2 text-sm">
          <ImageIcon className="size-8" aria-hidden />
          No photo
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted">
      {url ? (
        <img src={url} alt="Product" className="max-h-64 w-full object-contain" />
      ) : (
        <div className="h-40" />
      )}
    </div>
  );
}

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useMasterDataService();
  const can = useAuthStore((s) => s.hasPermission);
  const canManage = can('products.manage');
  const { data: p, loading, error, notFound, reload } = useEntity(repos.products, id);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !p) return <ErrorState title="Product not found" message={error ?? 'It may have been removed.'} />;

  async function toggleActive() {
    if (!p) return;
    const activate = isArchived(p);
    if (!activate) {
      const ok = await confirm({ title: `Archive ${p.name}?`, description: 'Stock and invoices keep their details.', confirmLabel: 'Archive', danger: true });
      if (!ok) return;
    }
    try {
      await service.products.setActive(p.id, activate);
      toast.success(activate ? 'Product restored' : 'Product archived');
      reload();
    } catch (e) {
      toast.error(mapCallableError(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={p.name}
        description={p.category || 'Uncategorised'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/inventory/products')}><ArrowLeft /> Back</Button>
            {canManage && <Button variant="outline" onClick={() => navigate(`/inventory/products/${p.id}/edit`)}><Pencil /> Edit</Button>}
            {!isArchived(p) && canManage && <Button variant="outline" onClick={() => void toggleActive()}><Archive /> Archive</Button>}
            {isArchived(p) && canManage && <Button variant="outline" onClick={() => void toggleActive()}><ArchiveRestore /> Restore</Button>}
          </div>
        }
      />

      <SectionCard title="Overview" action={<ActiveBadge deletedAt={p.deletedAt} />}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <DetailRow label="Category" value={p.category} />
          <DetailRow label="Unit" value={p.unit} />
          <DetailRow label="HSN code" value={p.hsn} />
          <DetailRow label="Barcode" value={p.barcode} />
          <DetailRow label="Low-stock threshold" value={p.lowStockThreshold != null ? String(p.lowStockThreshold) : 'Default (5)'} />
        </div>
      </SectionCard>

      <SectionCard title="Pricing & GST">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <DetailRow label="Wholesale price" value={formatINR(p.wholesalePricePaise)} />
          <DetailRow label="Purchase price" value={formatINR(p.purchasePricePaise)} />
          <DetailRow label="GST rate" value={<span className="num">{p.gstRateBp / 100}%</span>} />
        </div>
      </SectionCard>

      {p.altUnits.length > 0 && (
        <SectionCard title="Alternate units">
          <div className="flex flex-col gap-2">
            {p.altUnits.map((a) => (
              <div key={a.name} className="flex items-center justify-between text-sm">
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">1 {a.name} = {a.factor} {p.unit}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Variants" action={p.hasVariants ? <Badge variant="info">{p.variants.length} variants</Badge> : <Badge variant="secondary">Single</Badge>}>
        {p.hasVariants ? (
          <div className="flex flex-wrap gap-2">
            {p.variants.map((v) => (
              <Badge key={v.id} variant="secondary">
                {[v.size, v.color].filter(Boolean).join(' / ') || v.id}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">This product has a single variant.</p>
        )}
      </SectionCard>

      <SectionCard title="Photo">
        <ProductPhoto path={p.imagePath} />
      </SectionCard>
    </div>
  );
}
