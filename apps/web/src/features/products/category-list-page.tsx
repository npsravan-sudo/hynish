import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tags } from 'lucide-react';
import type { Product } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataList, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { useRepositories } from '@/hooks/use-master-data';
import { usePagedList } from '@/hooks/use-paged-list';
import { clientSearch } from '@/features/_shared/master-data';
import { useState } from 'react';

interface CategoryRow {
  name: string;
  count: number;
}

// Categories are legacy free-text strings on products (no separate entity), so this is a DERIVED
// view: distinct categories over active products with a live count. Managed on the product form.
const PARAMS = { orderByField: 'nameLower', direction: 'asc' as const, limit: 500, filters: [{ field: 'deletedAt', op: '==' as const, value: null }] };

export function CategoryListPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const [search, setSearch] = useState('');
  const { items, loading, error, refresh } = usePagedList(repos.products, useMemo(() => PARAMS, []));

  const rows = useMemo<CategoryRow[]>(() => {
    const counts = new Map<string, number>();
    for (const p of items as Product[]) {
      const c = p.category.trim();
      if (!c) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = clientSearch(rows, search, (r) => [r.name]);

  const columns: Column<CategoryRow>[] = [
    { header: 'Category', cell: (r) => <span className="font-medium">{r.name}</span> },
    { header: 'Products', align: 'right', cell: (r) => <Badge variant="secondary">{r.count}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categories"
        description="Product categories, derived from your catalogue. Assign a category on the product form."
        filters={<ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search categories…" />}
      />
      <DataList
        items={filtered}
        getRowId={(r) => r.name}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={refresh}
        onRowClick={(r) => navigate(`/inventory/products?category=${encodeURIComponent(r.name)}`)}
        empty={{
          icon: Tags,
          title: search ? 'No matching categories' : 'No categories yet',
          description: search ? 'Try a different search.' : 'Categories appear here once you assign them to products.',
        }}
        renderCard={(r) => (
          <Card className="flex items-center justify-between p-4" onClick={() => navigate(`/inventory/products?category=${encodeURIComponent(r.name)}`)}>
            <span className="font-semibold">{r.name}</span>
            <Badge variant="secondary">{r.count} products</Badge>
          </Card>
        )}
      />
    </div>
  );
}
