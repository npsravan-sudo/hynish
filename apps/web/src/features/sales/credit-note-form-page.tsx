import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatINR, newRequestId, todayISO, type CreateCreditNote, type Invoice, type CreditNote } from '@hynish/domain';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/premium';
import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { toast } from '@/components/ui/sonner';
import { useRepositories, useSalesService } from '@/hooks/use-master-data';
import { mapCallableError } from '@/lib/errors';

interface Row { invoiceLineId: string; name: string; originalQty: number; unit: string; eligibleQty: number; creditQty: number }

/** Issue a Credit Note against an invoice (BR-CN-01..04) — the sales-return mechanism. Quantity is
 * clamped server-side; the eligible amount shown here (original − already credited) is a UX
 * convenience only, never authoritative. */
export function CreditNoteFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const repos = useRepositories();
  const service = useSalesService();

  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(todayISO());
  const [restock, setRestock] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void repos.invoices.list({ orderByField: 'date', direction: 'desc', limit: 100, filters: [{ field: 'deletedAt', op: '==', value: null }] })
      .then((p) => setRecentInvoices(p.items)).catch(() => undefined);
  }, [repos]);

  async function loadInvoice(invoiceId: string) {
    setLoadingInvoice(true);
    try {
      const inv = await repos.invoices.get(invoiceId);
      if (!inv) { toast.error('Invoice not found.'); return; }
      const priorSnap = await repos.creditNotes.list({ filters: [{ field: 'deletedAt', op: '==', value: null }, { field: 'invoiceId', op: '==', value: invoiceId }], orderByField: 'date', direction: 'desc', limit: 200 });
      const alreadyCredited = new Map<string, number>();
      for (const c of priorSnap.items as CreditNote[]) {
        for (const l of c.lines) alreadyCredited.set(l.invoiceLineId, (alreadyCredited.get(l.invoiceLineId) ?? 0) + l.qty);
      }
      setInvoice(inv);
      setRows(inv.lines.map((l) => {
        const already = alreadyCredited.get(l.lineId) ?? 0;
        const eligibleQty = Math.max(0, l.qty - already);
        return { invoiceLineId: l.lineId, name: l.nameSnapshot, originalQty: l.qty, unit: l.unit, eligibleQty, creditQty: 0 };
      }));
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setLoadingInvoice(false);
    }
  }

  useEffect(() => {
    const fromParam = searchParams.get('invoiceId');
    if (fromParam) void loadInvoice(fromParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const invoiceOptions: ComboboxOption[] = useMemo(
    () => recentInvoices.map((i) => ({ value: i.id, label: `${i.number} · ${i.customerSnapshot?.name ?? 'Walk-in'}` })),
    [recentInvoices],
  );

  function updateQty(invoiceLineId: string, qty: number) {
    setRows((prev) => prev.map((r) => r.invoiceLineId === invoiceLineId ? { ...r, creditQty: Math.max(0, Math.min(qty, r.eligibleQty)) } : r));
  }

  async function submit() {
    if (!invoice) { toast.error('Choose an invoice.'); return; }
    const lines = rows.filter((r) => r.creditQty > 0).map((r) => ({ invoiceLineId: r.invoiceLineId, qty: r.creditQty }));
    if (lines.length === 0) { toast.error('Enter a quantity to credit on at least one line.'); return; }
    const payload: CreateCreditNote & { requestId: string } = {
      invoiceId: invoice.id, locationId: invoice.locationId, date, restock, lines, reason,
      requestId: newRequestId(),
    };
    setBusy(true);
    try {
      const res = await service.creditNotes.save(payload);
      toast.success('Credit note issued');
      navigate(`/sales/credit-notes/${res.creditNoteId}`);
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-24">
      <PageHeader
        title="New Credit Note"
        description="Issued against an invoice. Reverses revenue/tax/AR; restock also reverses stock and COGS (BR-CN-03/04)."
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>}
      />
      <SectionCard title="Invoice">
        {invoice ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="num font-medium">{invoice.number}</p>
              <p className="text-sm text-muted-foreground">{invoice.customerSnapshot?.name ?? 'Walk-in'} · {formatINR(invoice.grandTotalPaise)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setInvoice(null); setRows([]); }}>Change</Button>
          </div>
        ) : (
          <Combobox
            options={invoiceOptions}
            value=""
            onChange={(v) => { setInvoiceQuery(v); void loadInvoice(v); }}
            placeholder="Search invoices…"
            searchPlaceholder="Search by number or customer…"
            emptyText={invoiceQuery ? 'No invoice found' : 'Start typing to search'}
          />
        )}
      </SectionCard>

      {loadingInvoice && <PageSkeleton />}

      {invoice && !loadingInvoice && (
        <>
          <SectionCard title="Lines to credit" description="Quantity is capped to what's still eligible on each line (BR-CN-01).">
            <div className="flex flex-col gap-3">
              {rows.map((r) => (
                <div key={r.invoiceLineId} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">Billed {r.originalQty} {r.unit} · eligible {r.eligibleQty} {r.unit}</p>
                  </div>
                  <Input
                    type="number" inputMode="decimal" min={0} max={r.eligibleQty} step="0.001"
                    className="w-28" value={r.creditQty}
                    disabled={r.eligibleQty <= 0}
                    onChange={(e) => updateQty(r.invoiceLineId, Number(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Date" htmlFor="date"><Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={restock} onCheckedChange={(v) => setRestock(Boolean(v))} />
                  Restock these items (also reverses COGS)
                </label>
              </div>
              <Field label="Reason" htmlFor="reason" className="sm:col-span-2"><Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            </div>
          </SectionCard>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button onClick={() => void submit()} loading={busy}>Issue credit note</Button>
          </div>
        </>
      )}
    </div>
  );
}
