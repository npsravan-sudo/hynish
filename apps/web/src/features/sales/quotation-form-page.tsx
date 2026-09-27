import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { taxTypeFor, formatINR, newRequestId, todayISO, type CreateQuotation } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { ErrorState } from '@/components/feedback/error-state';
import { toast } from '@/components/ui/sonner';
import { useRepositories, useSalesService } from '@/hooks/use-master-data';
import { useAuthStore } from '@/stores/auth-store';
import { useEntity } from '@/hooks/use-entity';
import { mapCallableError } from '@/lib/errors';
import { useActiveCustomers, useActiveProducts, useBusinessSettings } from './use-sales-refs';
import { CustomerPicker, LineEditor, TotalsPanel, useComputedCart, type DraftRow } from './parts';

export function QuotationFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const repos = useRepositories();
  const service = useSalesService();
  const locationId = useAuthStore((s) => s.currentLocationId) ?? '';

  const { customers } = useActiveCustomers();
  const { products } = useActiveProducts();
  const settings = useBusinessSettings();
  const { data: existing, loading, error, notFound } = useEntity(repos.quotations, id);

  const [date, setDate] = useState(todayISO());
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requestId = useRef(newRequestId());

  useEffect(() => {
    if (existing) {
      setDate(existing.date);
      setCustomerId(existing.customerId);
      setNotes(existing.notes);
      setRows(existing.lines.map((l) => ({
        key: l.lineId, productId: l.productId, variantId: l.variantId, unit: l.unit,
        qty: l.qty, ratePaise: l.ratePaise, discountBp: l.discountBp, gstRateBp: l.gstRateBp,
      })));
    }
  }, [existing]);

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const taxType = taxTypeFor(settings?.stateCode ?? '', customer?.stateCode ?? null);
  const computed = useComputedCart(rows, taxType, true); // quotations always apply GST (§18)

  async function submit() {
    const effectiveLocation = existing?.locationId ?? locationId;
    if (!effectiveLocation) { toast.error('No working location is set.'); return; }
    if (rows.length === 0) { toast.error('Add at least one item.'); return; }

    const lines: CreateQuotation['lines'] = rows.map((r) => ({
      productId: r.productId, variantId: r.variantId, unit: r.unit,
      qty: r.qty, ratePaise: r.ratePaise, discountBp: r.discountBp, gstRateBp: r.gstRateBp,
    }));
    setSubmitting(true);
    try {
      const res = await service.quotations.save({
        locationId: effectiveLocation, date, customerId, lines, notes,
        requestId: requestId.current, ...(id ? { id } : {}),
      });
      toast.success(isEdit ? `Quotation ${res.number} updated` : `Quotation ${res.number} created`);
      requestId.current = newRequestId();
      navigate(`/sales/quotations/${res.quotationId}`);
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (isEdit && loading) return <PageSkeleton />;
  if (isEdit && (error || notFound)) return <ErrorState title="Quotation not found" message={error ?? 'It may have been removed.'} />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-24">
      <PageHeader
        title={isEdit ? `Edit ${existing?.number ?? 'Quotation'}` : 'New Quotation'}
        description="A priced offer. Quotations never affect stock or accounting."
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>}
      />
      <SectionCard title="Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="q-date"><Input id="q-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Customer" htmlFor="q-cust" className="sm:col-span-2">
            <CustomerPicker id="q-cust" customers={customers} value={customerId} onChange={setCustomerId} />
          </Field>
        </div>
      </SectionCard>
      <SectionCard title="Items">
        <LineEditor products={products} rows={rows} computed={computed} onChange={setRows} />
      </SectionCard>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" /></SectionCard>
        <SectionCard title="Totals"><TotalsPanel computed={computed} gstApplicable taxType={taxType} /></SectionCard>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Grand total <span className="num font-semibold text-foreground">{formatINR(computed.totals.grandTotalPaise)}</span></span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button onClick={() => void submit()} loading={submitting}>{isEdit ? 'Save changes' : 'Create quotation'}</Button>
        </div>
      </div>
    </div>
  );
}
