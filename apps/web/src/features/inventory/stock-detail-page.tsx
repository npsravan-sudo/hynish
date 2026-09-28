import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { stockStatus, lowStockThreshold, type StockLevel, type StockMovement, type StockStatus } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { DetailRow } from '@/features/_shared/detail-row';

const STATUS_VARIANT: Record<StockStatus, 'danger' | 'warning' | 'success'> = { out: 'danger', low: 'warning', healthy: 'success' };

export function StockDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const repos = useRepositories();
  const locations = useAuthStore((s) => s.locations);
  const { data: product, loading, error, notFound } = useEntity(repos.products, productId);
  const [levels, setLevels] = useState<StockLevel[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    void repos.stockLevels.list({ filters: [{ field: 'productId', op: '==', value: productId }], orderByField: 'locationId', direction: 'asc', limit: 100 })
      .then((p) => !cancelled && setLevels(p.items)).catch(() => undefined);
    void repos.stockMovements.list({ filters: [{ field: 'productId', op: '==', value: productId }], orderByField: 'date', direction: 'desc', limit: 25 })
      .then((p) => !cancelled && setMovements(p.items)).catch(() => undefined);
    return () => { cancelled = true; };
  }, [productId, repos]);

  if (loading) return <PageSkeleton />;
  if (error || notFound || !product) return <ErrorState title="Product not found" message={error ?? 'It may have been removed.'} />;

  const threshold = lowStockThreshold(product.lowStockThreshold);
  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={product.name}
        description={`Low-stock threshold ${threshold} · unit ${product.unit}`}
        actions={<Button variant="ghost" onClick={() => navigate('/inventory/stock')}><ArrowLeft /> Back</Button>}
      />
      <SectionCard title="Stock by location">
        {levels.length === 0 ? <p className="text-sm text-muted-foreground">No stock recorded yet.</p> : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {levels.map((l) => (
              <DetailRow key={`${l.locationId}_${l.variantId}`} label={locName(l.locationId) + (l.variantId !== 'default' ? ` · ${l.variantId}` : '')}
                value={<span className="flex items-center gap-2"><span className="num">{l.qty}</span><Badge variant={STATUS_VARIANT[stockStatus(l.qty, product.lowStockThreshold)]} className="capitalize">{stockStatus(l.qty, product.lowStockThreshold)}</Badge></span>} />
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard title="Recent movements">
        {movements.length === 0 ? <p className="text-sm text-muted-foreground">No movements yet.</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Location</TableHead>
                <TableHead className="text-right">Change</TableHead><TableHead className="text-right">Balance</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.date}</TableCell>
                    <TableCell>{m.type.replace(/_/g, ' ')}</TableCell>
                    <TableCell>{locName(m.locationId)}</TableCell>
                    <TableCell className={`num text-right ${m.qtyChange < 0 ? 'text-danger' : 'text-success'}`}>{m.qtyChange > 0 ? '+' : ''}{m.qtyChange}</TableCell>
                    <TableCell className="num text-right">{m.qtyAfter}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
