import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { formatINR, newRequestId, todayISO, type CreateDeliveryNote, type Customer, type Product } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MoneyInput } from '@/components/forms/money-input';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, useSalesService } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { useProductsById } from '@/features/inventory/use-inventory-refs';
import { mapCallableError, callableErrorCode } from '@/lib/errors';
import { confirm } from '@/components/feedback/confirm';
import { CustomerPicker } from './parts';

interface Row { key: string; productId: string; name: string; unit: string; qty: number; referenceRatePaise: number; units: string[] }

/** Create/edit a Delivery Note (BR-DN-01..03/07). Only a pending DN can be edited. Stock is
 * deducted immediately on save — undo-then-reapply on edit, same pattern as an invoice. */
export function DeliveryNoteFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useSalesService();
  const locations = useAuthStore((s) => s.locations);
  const currentLocationId = useAuthStore((s) => s.currentLocationId);
  const { products } = useProductsById();
  const { data: existing, loading: loadingExisting, error: loadError, notFound } = useEntity(repos.deliveryNotes, id);

  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    let cancelled = false;
    void repos.customers.list({ orderByField: 'nameLower', direction: 'asc', limit: 500, filters: [{ field: 'deletedAt', op: '==', value: null }] })
      .then((p) => !cancelled && setCustomers(p.items)).catch(() => undefined);
    return () => { cancelled = true; };
  }, [repos]);

  const [locationId, setLocationId] = useState(currentLocationId ?? locations[0]?.id ?? '');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(newRequestId());

  useEffect(() => {
    if (existing) {
      if (existing.status !== 'pending') { toast.error('Only a pending delivery note can be edited.'); navigate(`/sales/delivery-notes/${existing.id}`); return; }
      setLocationId(existing.locationId);
      setCustomerId(existing.customerId);
      setDate(existing.date);
      setNotes(existing.notes);
      setRows(existing.lines.map((l) => {
        const p = products.find((x) => x.id === l.productId);
        return { key: l.lineId, productId: l.productId, name: l.nameSnapshot, unit: l.unit, qty: l.qty, referenceRatePaise: l.referenceRatePaise, units: p ? [p.unit, ...(p.altUnits ?? []).map((a) => a.name)] : [l.unit] };
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  const productOptions: ComboboxOption[] = useMemo(() => products.map((p) => ({ value: p.id, label: p.barcode ? `${p.name} · ${p.barcode}` : p.name })), [products]);

  function addProduct(id: string) {
    const p: Product | undefined = products.find((x) => x.id === id);
    if (!p) return;
    const units = [p.unit, ...(p.altUnits ?? []).map((a) => a.name)];
    setRows((prev) => [...prev, { key: `${p.id}_${prev.length}`, productId: p.id, name: p.name, unit: p.unit, qty: 1, referenceRatePaise: p.wholesalePricePaise, units }]);
  }

  const referenceValuePaise = rows.reduce((s, r) => s + Math.round(r.referenceRatePaise * r.qty), 0);

  async function submit(confirmations: ('STOCK_SHORTAGE')[] = []) {
    if (!locationId) { toast.error('Choose a location.'); return; }
    if (rows.length === 0) { toast.error('Add at least one item.'); return; }
    if (rows.some((r) => !(r.qty > 0))) { toast.error('Every item needs a quantity greater than zero.'); return; }
    const payload: CreateDeliveryNote & { id?: string; requestId: string } = {
      date, locationId, customerId,
      lines: rows.map((r) => ({ productId: r.productId, variantId: 'default', unit: r.unit, qty: r.qty, referenceRatePaise: r.referenceRatePaise })),
      notes, confirmations,
      ...(isEdit ? { id: id! } : {}),
      requestId: requestId.current,
    };
    setBusy(true);
    try {
      const res = await service.deliveryNotes.save(payload);
      toast.success(isEdit ? 'Delivery note updated' : 'Delivery note created');
      requestId.current = newRequestId();
      navigate(`/sales/delivery-notes/${res.deliveryNoteId}`);
    } catch (e) {
      if (callableErrorCode(e) === 'STOCK_SHORTAGE') {
        const ok = await confirm({ title: 'Not enough stock', description: 'One or more items do not have enough stock at this location. Continue anyway?', confirmLabel: 'Continue', danger: true });
        if (ok) return void submit(['STOCK_SHORTAGE']);
      } else {
        toast.error(mapCallableError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  if (isEdit && loadingExisting) return <PageSkeleton />;
  if (isEdit && (loadError || notFound)) return <ErrorState title="Delivery note not found" message={loadError ?? 'It may have been removed.'} />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-24">
      <PageHeader
        title={isEdit ? 'Edit Delivery Note' : 'New Delivery Note'}
        description="Goods leaving before a tax invoice. Stock is deducted now; rates are reference values only (BR-DN-02)."
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>}
      />
      <SectionCard title="Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer (optional)" htmlFor="cust" className="sm:col-span-2">
            <CustomerPicker id="cust" customers={customers} value={customerId} onChange={setCustomerId} />
          </Field>
          <Field label="Location" htmlFor="loc">
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="loc"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Date" htmlFor="date"><Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
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
                  <Select value={r.unit} onValueChange={(v) => setRows((prev) => prev.map((x, idx) => idx === i ? { ...x, unit: v } : x))}>
                    <SelectTrigger id={`u-${r.key}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{r.units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Qty" htmlFor={`q-${r.key}`}>
                  <Input id={`q-${r.key}`} type="number" inputMode="decimal" min={0} step="0.001" value={r.qty} onChange={(e) => setRows((prev) => prev.map((x, idx) => idx === i ? { ...x, qty: Number(e.target.value) || 0 } : x))} />
                </Field>
                <Field label="Reference rate" htmlFor={`r-${r.key}`}>
                  <MoneyInput id={`r-${r.key}`} valuePaise={r.referenceRatePaise} onChangePaise={(v) => setRows((prev) => prev.map((x, idx) => idx === i ? { ...x, referenceRatePaise: v } : x))} />
                </Field>
                <Field label="Value" htmlFor={`a-${r.key}`}>
                  <Input id={`a-${r.key}`} readOnly className="num" value={formatINR(Math.round(r.referenceRatePaise * r.qty), { withSymbol: false })} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Notes & total">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Notes" htmlFor="notes"><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="flex items-end justify-end text-base font-semibold"><span className="num">{formatINR(referenceValuePaise)}</span></div>
        </div>
      </SectionCard>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={() => void submit()} loading={busy}>{isEdit ? 'Save changes' : 'Create delivery note'}</Button>
      </div>
    </div>
  );
}
