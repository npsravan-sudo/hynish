import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  taxTypeFor, formatINR, newRequestId, NEW_BILL_GST_APPLICABLE_DEFAULT,
  type CreateInvoice,
} from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MoneyInput } from '@/components/forms/money-input';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, useSalesService } from '@/hooks/use-master-data';
import { useEntity } from '@/hooks/use-entity';
import { mapCallableError, callableErrorCode } from '@/lib/errors';
import { todayISO } from '@hynish/domain';
import { useActiveCustomers, useActiveProducts, useBusinessSettings } from './use-sales-refs';
import { CustomerPicker, LineEditor, TotalsPanel, useComputedCart, type DraftRow } from './parts';

export function InvoiceFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const repos = useRepositories();
  const service = useSalesService();
  const locations = useAuthStore((s) => s.locations);
  const currentLocationId = useAuthStore((s) => s.currentLocationId);

  const { customers } = useActiveCustomers();
  const { products } = useActiveProducts();
  const settings = useBusinessSettings();
  const { data: existing, loading, error, notFound } = useEntity(repos.invoices, id);

  const [locationId, setLocationId] = useState<string>(currentLocationId ?? locations[0]?.id ?? '');
  const [date, setDate] = useState<string>(todayISO());
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [gstApplicable, setGstApplicable] = useState<boolean>(NEW_BILL_GST_APPLICABLE_DEFAULT); // DEF-016 / BR-INV-01
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [initialPaidPaise, setInitialPaidPaise] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const requestId = useRef(newRequestId());

  // Prefill from an existing invoice (edit) — location is locked (BR-INV-10).
  useEffect(() => {
    if (existing) {
      setLocationId(existing.locationId);
      setDate(existing.date);
      setCustomerId(existing.customerId);
      setGstApplicable(existing.gstApplicable);
      setNotes(existing.notes);
      setDueDate(existing.dueDate ?? '');
      setRows(existing.lines.map((l) => ({
        key: l.lineId, productId: l.productId, variantId: l.variantId, unit: l.unit,
        qty: l.qty, ratePaise: l.ratePaise, discountBp: l.discountBp, gstRateBp: l.gstRateBp,
      })));
    }
  }, [existing]);

  // Prefill from a quotation conversion (?fromQuotation=<id>) (BR-INV-15, §43).
  const fromQuotation = searchParams.get('fromQuotation');
  useEffect(() => {
    if (!fromQuotation || isEdit) return;
    let cancelled = false;
    void repos.quotations.get(fromQuotation).then((q) => {
      if (cancelled || !q) return;
      setCustomerId(q.customerId);
      setGstApplicable(true);
      setRows(q.lines.map((l) => ({
        key: l.lineId, productId: l.productId, variantId: l.variantId, unit: l.unit,
        qty: l.qty, ratePaise: l.ratePaise, discountBp: l.discountBp, gstRateBp: l.gstRateBp,
      })));
    });
    return () => { cancelled = true; };
  }, [fromQuotation, isEdit, repos]);

  // Prefill from a Delivery Note conversion (?fromDeliveryNote=<id>) (BR-DN-04). The DN's reference
  // rate becomes the invoice line's rate; GST is computed fresh from the product's current rate,
  // since a DN never carries a GST rate at all (BR-DN-02). Converted lines skip stock deduction —
  // the goods already left via the DN (server-enforced regardless of what the client sends).
  const fromDeliveryNote = searchParams.get('fromDeliveryNote');
  useEffect(() => {
    if (!fromDeliveryNote || isEdit) return;
    let cancelled = false;
    void repos.deliveryNotes.get(fromDeliveryNote).then((dn) => {
      if (cancelled || !dn) return;
      setCustomerId(dn.customerId);
      setGstApplicable(true);
      setRows(dn.lines.map((l) => {
        const p = products.find((x) => x.id === l.productId);
        return {
          key: l.lineId, productId: l.productId, variantId: l.variantId, unit: l.unit,
          qty: l.qty, ratePaise: l.referenceRatePaise, discountBp: 0, gstRateBp: p?.gstRateBp ?? 0,
        };
      }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDeliveryNote, isEdit, repos]);

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const sellerState = settings?.stateCode ?? '';
  const taxType = taxTypeFor(sellerState, customer?.stateCode ?? null);
  const computed = useComputedCart(rows, taxType, gstApplicable);

  async function submit(acknowledgePastMonth = false) {
    if (!locationId) { toast.error('Choose a location for this bill.'); return; }
    if (rows.length === 0) { toast.error('Add at least one item.'); return; }
    if (rows.some((r) => !(r.qty > 0))) { toast.error('Every line needs a quantity greater than zero.'); return; }

    const lines: CreateInvoice['lines'] = rows.map((r) => ({
      productId: r.productId, variantId: r.variantId, unit: r.unit,
      qty: r.qty, ratePaise: r.ratePaise, discountBp: r.discountBp, gstRateBp: r.gstRateBp,
    }));
    const payload: CreateInvoice & { id?: string; acknowledgePastMonth?: boolean; requestId: string } = {
      locationId, date, customerId, gstApplicable, lines,
      initialPaidPaise: isEdit ? 0 : initialPaidPaise, // edit never changes amount received (BR-INV-12)
      notes,
      dueDate: dueDate || null,
      source: !isEdit && fromQuotation ? { type: 'quotation', id: fromQuotation }
        : !isEdit && fromDeliveryNote ? { type: 'delivery_note', id: fromDeliveryNote }
        : null,
      confirmations: [],
      requestId: requestId.current,
      acknowledgePastMonth,
      ...(id ? { id } : {}),
    };

    setSubmitting(true);
    try {
      const res = await service.invoices.finalize(payload);
      toast.success(isEdit ? `Invoice ${res.number} updated` : `Invoice ${res.number} created`);
      requestId.current = newRequestId();
      navigate(`/sales/invoices/${res.invoiceId}`);
    } catch (e) {
      if (callableErrorCode(e) === 'PAST_MONTH_EDIT') {
        const ok = await confirm({
          title: 'Editing a past-month bill',
          description: 'This bill is from a previous month and may already have been filed for GST. Continue?',
          confirmLabel: 'Edit anyway',
          danger: true,
        });
        if (ok) { setSubmitting(false); return void submit(true); }
      } else {
        toast.error(mapCallableError(e));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (isEdit && loading) return <PageSkeleton />;
  if (isEdit && (error || notFound)) return <ErrorState title="Invoice not found" message={error ?? 'It may have been removed.'} />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-28">
      <PageHeader
        title={isEdit ? `Edit ${existing?.number ?? 'Invoice'}` : 'New Bill'}
        description={
          <span className="flex items-center gap-2">
            <Badge variant={gstApplicable ? 'info' : 'secondary'}>{gstApplicable ? 'GST' : 'Without GST'}</Badge>
            <span className="text-muted-foreground">{gstApplicable ? (taxType === 'intra' ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)') : 'No tax'}</span>
          </span>
        }
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>}
      />

      <SectionCard title="Bill details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Location" htmlFor="loc" hint={isEdit ? 'Locked to the bill’s location' : undefined}>
            <Select value={locationId} onValueChange={setLocationId} disabled={isEdit}>
              <SelectTrigger id="loc"><SelectValue placeholder="Choose location" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Date" htmlFor="date">
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Customer" htmlFor="cust" className="sm:col-span-2" hint="Leave blank for a walk-in / cash sale">
            <CustomerPicker id="cust" customers={customers} value={customerId} onChange={setCustomerId} />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:col-span-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Apply GST</span>
              <span className="text-xs text-muted-foreground">New bills open Without GST by default (legacy behaviour).</span>
            </div>
            <Switch checked={gstApplicable} onCheckedChange={setGstApplicable} aria-label="Apply GST" />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Items">
        <LineEditor products={products} rows={rows} computed={computed} onChange={setRows} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Notes & due date">
          <div className="flex flex-col gap-4">
            <Field label="Due date" htmlFor="due" hint="Optional; used for overdue tracking">
              <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Notes" htmlFor="notes">
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {!isEdit && (
              <Field label="Paid now" htmlFor="paid" hint="Amount received at billing (books to Cash — BR-PAY-06)">
                <MoneyInput id="paid" valuePaise={initialPaidPaise} onChangePaise={setInitialPaidPaise} />
              </Field>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Totals">
          <TotalsPanel computed={computed} gstApplicable={gstApplicable} taxType={taxType} />
          {!isEdit && initialPaidPaise > 0 && (
            <p className="mt-3 text-right text-xs text-muted-foreground">
              Balance due <span className="num text-foreground">{formatINR(Math.max(0, computed.totals.grandTotalPaise - initialPaidPaise))}</span>
            </p>
          )}
        </SectionCard>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Grand total <span className="num font-semibold text-foreground">{formatINR(computed.totals.grandTotalPaise)}</span></span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button onClick={() => void submit(false)} loading={submitting}>{isEdit ? 'Save changes' : 'Create bill'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
