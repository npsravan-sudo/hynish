import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { newRequestId, todayISO, type Product } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useInventoryService } from '@/hooks/use-master-data';
import { mapCallableError } from '@/lib/errors';
import { useProductsById, useStockLevels } from './use-inventory-refs';

interface Line { key: string; productId: string; variantId: string; countedQty: number; systemQty: number; name: string }
function defaultVariant(p: Product): string {
  const v = p.hasVariants ? (p.variants.find((x) => x.active) ?? p.variants[0]) : p.variants[0];
  return v?.id ?? 'default';
}

export function StockCountPage() {
  const navigate = useNavigate();
  const locations = useAuthStore((s) => s.locations);
  const currentLocationId = useAuthStore((s) => s.currentLocationId);
  const service = useInventoryService();
  const { products } = useProductsById();
  const [locationId, setLocationId] = useState(currentLocationId ?? locations[0]?.id ?? '');
  const { levels } = useStockLevels(locationId);
  const levelMap = useMemo(() => new Map(levels.map((l) => [`${l.productId}_${l.variantId}`, l.qty])), [levels]);

  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(newRequestId());
  const options: ComboboxOption[] = useMemo(() => products.map((p) => ({ value: p.id, label: p.barcode ? `${p.name} · ${p.barcode}` : p.name })), [products]);

  function addProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const variantId = defaultVariant(p);
    const key = `${p.id}_${variantId}`;
    if (lines.some((l) => l.key === key)) return;
    setLines((prev) => [...prev, { key, productId: p.id, variantId, countedQty: levelMap.get(key) ?? 0, systemQty: levelMap.get(key) ?? 0, name: p.name }]);
  }

  async function submit() {
    if (!locationId) { toast.error('Choose a location.'); return; }
    if (lines.length === 0) { toast.error('Add at least one product to count.'); return; }
    setBusy(true);
    try {
      const res = await service.finalizeCount({
        date: todayISO(), locationId, notes,
        lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, countedQty: l.countedQty })),
        requestId: requestId.current,
      });
      toast.success(`Count finalized — ${res.changedCount} change(s) applied`);
      requestId.current = newRequestId();
      navigate('/inventory/stock');
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Stock Count" description="Enter counted quantities; the system recomputes differences against live stock and posts corrections." actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>} />
      <SectionCard title="Location">
        <Field label="Location" htmlFor="loc">
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger id="loc"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </SectionCard>
      <SectionCard title="Counted items">
        <div className="flex flex-col gap-3">
          <Combobox options={options} value="" onChange={addProduct} placeholder="Add a product…" searchPlaceholder="Search products…" emptyText="No products" />
          {lines.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
          {lines.map((l, i) => {
            const diff = l.countedQty - l.systemQty;
            return (
              <div key={l.key} className="flex items-end gap-2 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{l.name}</p><p className="num text-xs text-muted-foreground">system {l.systemQty}{diff !== 0 ? ` · diff ${diff > 0 ? '+' : ''}${diff}` : ''}</p></div>
                <Field label="Counted" htmlFor={`c-${l.key}`}>
                  <Input id={`c-${l.key}`} type="number" inputMode="decimal" min={0} step="0.001" value={l.countedQty}
                    onChange={(e) => setLines((prev) => prev.map((x, idx) => idx === i ? { ...x, countedQty: Number(e.target.value) || 0 } : x))} />
                </Field>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 className="size-4" /></Button>
              </div>
            );
          })}
        </div>
      </SectionCard>
      <SectionCard title="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" /></SectionCard>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={() => void submit()} loading={busy}>Finalize count</Button>
      </div>
    </div>
  );
}
