import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { formatINR, newRequestId, todayISO, type CreatePurchase, type Product, type Supplier } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { MoneyInput } from '@/components/forms/money-input';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, usePurchasesService } from '@/hooks/use-master-data';
import { mapCallableError } from '@/lib/errors';
import { useProductsById } from '@/features/inventory/use-inventory-refs';

interface Row { key: string; productId: string; name: string; unit: string; enteredUnit: string; enteredQty: number; ratePaise: number; units: string[] }

export function PurchaseFormPage() {
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = usePurchasesService();
  const locations = useAuthStore((s) => s.locations);
  const currentLocationId = useAuthStore((s) => s.currentLocationId);
  const { products } = useProductsById();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  useEffect(() => {
    let cancelled = false;
    void repos.suppliers.list({ orderByField: 'nameLower', direction: 'asc', limit: 500, filters: [{ field: 'deletedAt', op: '==', value: null }] })
      .then((p) => !cancelled && setSuppliers(p.items)).catch(() => undefined);
    return () => { cancelled = true; };
  }, [repos]);

  const [locationId, setLocationId] = useState(currentLocationId ?? locations[0]?.id ?? '');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierBillNo, setSupplierBillNo] = useState('');
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [initialPaidPaise, setInitialPaidPaise] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(newRequestId());

  const supplierOptions: ComboboxOption[] = suppliers.map((s) => ({ value: s.id, label: s.gstin ? `${s.name} · ${s.gstin}` : s.name }));
  const productOptions: ComboboxOption[] = useMemo(() => products.map((p) => ({ value: p.id, label: p.barcode ? `${p.name} · ${p.barcode}` : p.name })), [products]);

  function addProduct(id: string) {
    const p: Product | undefined = products.find((x) => x.id === id);
    if (!p) return;
    const units = [p.unit, ...(p.altUnits ?? []).map((a) => a.name)];
    setRows((prev) => [...prev, { key: `${p.id}_${prev.length}`, productId: p.id, name: p.name, unit: p.unit, enteredUnit: p.unit, enteredQty: 1, ratePaise: p.purchasePricePaise, units }]);
  }

  const total = rows.reduce((s, r) => s + Math.round(r.ratePaise * r.enteredQty), 0);

  async function submit() {
    if (!supplierId) { toast.error('Choose a supplier.'); return; }
    if (!locationId) { toast.error('Choose a location.'); return; }
    if (rows.length === 0) { toast.error('Add at least one item.'); return; }
    if (rows.some((r) => !(r.enteredQty > 0))) { toast.error('Every item needs a quantity greater than zero.'); return; }
    const payload: CreatePurchase & { requestId: string } = {
      date, locationId, supplierId, supplierBillNo,
      lines: rows.map((r) => ({ productId: r.productId, variantId: 'default', enteredUnit: r.enteredUnit, enteredQty: r.enteredQty, ratePaise: r.ratePaise })),
      initialPaidPaise, dueDate: dueDate || null, notes, confirmations: [], requestId: requestId.current,
    };
    setBusy(true);
    try {
      const res = await service.finalize(payload);
      toast.success('Purchase recorded');
      requestId.current = newRequestId();
      navigate(`/inventory/purchases/${res.purchaseId}`);
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-24">
      <PageHeader title="New Purchase" description="Record a supplier purchase. Adds stock at the location. Purchases carry no GST (legacy behaviour)." actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>} />
      <SectionCard title="Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier" htmlFor="sup" className="sm:col-span-2">
            <Combobox id="sup" options={supplierOptions} value={supplierId ?? ''} onChange={(v) => setSupplierId(v || null)} placeholder="Choose supplier" searchPlaceholder="Search suppliers…" emptyText="No suppliers" />
          </Field>
          <Field label="Location" htmlFor="loc">
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="loc"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Date" htmlFor="date"><Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Supplier bill no." htmlFor="bill" hint="The supplier's own invoice number"><Input id="bill" value={supplierBillNo} onChange={(e) => setSupplierBillNo(e.target.value)} /></Field>
        </div>
      </SectionCard>
      <SectionCard title="Items">
        <div className="flex flex-col gap-3">
          <Combobox options={productOptions} value="" onChange={addProduct} placeholder="Add a product…" searchPlaceholder="Search products…" emptyText="No products" />
          {rows.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
          {rows.map((r, i) => (
            <div key={r.key} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-medium">{r.name}</p>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 className="size-4" /></Button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Unit" htmlFor={`u-${r.key}`}>
                  <Select value={r.enteredUnit} onValueChange={(v) => setRows((prev) => prev.map((x, idx) => idx === i ? { ...x, enteredUnit: v } : x))}>
                    <SelectTrigger id={`u-${r.key}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{r.units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Qty" htmlFor={`q-${r.key}`}>
                  <Input id={`q-${r.key}`} type="number" inputMode="decimal" min={0} step="0.001" value={r.enteredQty} onChange={(e) => setRows((prev) => prev.map((x, idx) => idx === i ? { ...x, enteredQty: Number(e.target.value) || 0 } : x))} />
                </Field>
                <Field label="Rate" htmlFor={`r-${r.key}`}>
                  <MoneyInput id={`r-${r.key}`} valuePaise={r.ratePaise} onChangePaise={(v) => setRows((prev) => prev.map((x, idx) => idx === i ? { ...x, ratePaise: v } : x))} />
                </Field>
                <Field label="Amount" htmlFor={`a-${r.key}`}>
                  <Input id={`a-${r.key}`} readOnly className="num" value={formatINR(Math.round(r.ratePaise * r.enteredQty), { withSymbol: false })} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Payment & due">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Paid now" htmlFor="paid"><MoneyInput id="paid" valuePaise={initialPaidPaise} onChangePaise={setInitialPaidPaise} /></Field>
            <Field label="Due date" htmlFor="due"><Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
            <Field label="Notes" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>
        </SectionCard>
        <SectionCard title="Total">
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between font-semibold text-base"><span>Total</span><span className="num">{formatINR(total)}</span></div>
            {initialPaidPaise > 0 && <div className="flex justify-between text-muted-foreground"><span>Balance payable</span><span className="num">{formatINR(Math.max(0, total - initialPaidPaise))}</span></div>}
          </div>
        </SectionCard>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={() => void submit()} loading={busy}>Record purchase</Button>
      </div>
    </div>
  );
}
