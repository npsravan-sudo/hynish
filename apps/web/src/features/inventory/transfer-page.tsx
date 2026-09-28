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
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useInventoryService } from '@/hooks/use-master-data';
import { mapCallableError, callableErrorCode } from '@/lib/errors';
import { useProductsById } from './use-inventory-refs';

interface Item { key: string; productId: string; variantId: string; qty: number; nameSnapshot: string }
function defaultVariant(p: Product): string {
  const v = p.hasVariants ? (p.variants.find((x) => x.active) ?? p.variants[0]) : p.variants[0];
  return v?.id ?? 'default';
}

export function TransferPage() {
  const navigate = useNavigate();
  const locations = useAuthStore((s) => s.locations);
  const currentLocationId = useAuthStore((s) => s.currentLocationId);
  const service = useInventoryService();
  const { products } = useProductsById();

  const [fromLocationId, setFromLocationId] = useState(currentLocationId ?? locations[0]?.id ?? '');
  const [toLocationId, setToLocationId] = useState(locations.find((l) => l.id !== fromLocationId)?.id ?? '');
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(newRequestId());

  const options: ComboboxOption[] = useMemo(() => products.map((p) => ({ value: p.id, label: p.barcode ? `${p.name} · ${p.barcode}` : p.name })), [products]);

  function addProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const variantId = defaultVariant(p);
    if (items.some((it) => it.productId === p.id && it.variantId === variantId)) return;
    setItems((prev) => [...prev, { key: `${p.id}_${variantId}`, productId: p.id, variantId, qty: 1, nameSnapshot: p.name }]);
  }

  async function submit(confirmNegative = false) {
    if (!fromLocationId || !toLocationId) { toast.error('Choose both locations.'); return; }
    if (fromLocationId === toLocationId) { toast.error('Source and destination must differ.'); return; }
    if (items.length === 0) { toast.error('Add at least one item.'); return; }
    if (items.some((it) => !(it.qty > 0))) { toast.error('Every item needs a quantity greater than zero.'); return; }
    setBusy(true);
    try {
      await service.transfer({
        date: todayISO(), fromLocationId, toLocationId,
        items: items.map((it) => ({ productId: it.productId, variantId: it.variantId, qty: it.qty, nameSnapshot: it.nameSnapshot })),
        notes, requestId: requestId.current, confirmations: confirmNegative ? ['NEGATIVE_STOCK'] : [],
      });
      toast.success('Stock transferred');
      requestId.current = newRequestId();
      navigate('/inventory/stock');
    } catch (e) {
      if (callableErrorCode(e) === 'NEGATIVE_STOCK') {
        const ok = await confirm({ title: 'Not enough stock at source', description: 'The source location does not have enough stock. Transfer anyway (allows negative)?', confirmLabel: 'Transfer anyway', danger: true });
        if (ok) { setBusy(false); return void submit(true); }
      } else {
        toast.error(mapCallableError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Stock Transfer" description="Move stock between locations. Posts a transfer-out and a transfer-in atomically." actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>} />
      <SectionCard title="Locations">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="From" htmlFor="from">
            <Select value={fromLocationId} onValueChange={setFromLocationId}>
              <SelectTrigger id="from"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="To" htmlFor="to">
            <Select value={toLocationId} onValueChange={setToLocationId}>
              <SelectTrigger id="to"><SelectValue placeholder="Destination" /></SelectTrigger>
              <SelectContent>{locations.filter((l) => l.id !== fromLocationId).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>
      <SectionCard title="Items">
        <div className="flex flex-col gap-3">
          <Combobox options={options} value="" onChange={addProduct} placeholder="Add a product…" searchPlaceholder="Search products…" emptyText="No products" />
          {items.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
          {items.map((it, i) => (
            <div key={it.key} className="flex items-end gap-2 rounded-lg border border-border p-3">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{it.nameSnapshot}</p>{it.variantId !== 'default' && <p className="text-xs text-muted-foreground">{it.variantId}</p>}</div>
              <Field label="Qty" htmlFor={`t-${it.key}`}>
                <Input id={`t-${it.key}`} type="number" inputMode="decimal" min={0} step="0.001" value={it.qty}
                  onChange={(e) => setItems((prev) => prev.map((x, idx) => idx === i ? { ...x, qty: Number(e.target.value) || 0 } : x))} />
              </Field>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" /></SectionCard>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={() => void submit(false)} loading={busy}>Transfer stock</Button>
      </div>
    </div>
  );
}
