import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { newRequestId, todayISO, type CreateDebitNote, type Purchase, type DebitNote } from '@hynish/domain';
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
import { confirm } from '@/components/feedback/confirm';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositories, usePurchasesService } from '@/hooks/use-master-data';
import { mapCallableError, callableErrorCode } from '@/lib/errors';

interface Row { purchaseLineId: string; name: string; originalQty: number; eligibleQty: number; debitQty: number }

/** Issue a Debit Note against a purchase (BR-DBN-01..04) — the purchase-return mechanism. */
export function DebitNoteFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const repos = useRepositories();
  const service = usePurchasesService();
  const canOverride = useAuthStore((s) => s.hasPermission('stock.overrideNegative'));

  const [purchaseQuery, setPurchaseQuery] = useState('');
  const [recentPurchases, setRecentPurchases] = useState<Purchase[]>([]);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(todayISO());
  const [restock, setRestock] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void repos.purchases.list({ orderByField: 'date', direction: 'desc', limit: 100, filters: [{ field: 'deletedAt', op: '==', value: null }] })
      .then((p) => setRecentPurchases(p.items)).catch(() => undefined);
  }, [repos]);

  async function loadPurchase(purchaseId: string) {
    setLoadingPurchase(true);
    try {
      const pur = await repos.purchases.get(purchaseId);
      if (!pur) { toast.error('Purchase not found.'); return; }
      const priorSnap = await repos.debitNotes.list({ filters: [{ field: 'deletedAt', op: '==', value: null }, { field: 'purchaseId', op: '==', value: purchaseId }], orderByField: 'date', direction: 'desc', limit: 200 });
      const alreadyDebited = new Map<string, number>();
      for (const d of priorSnap.items as DebitNote[]) {
        for (const l of d.lines) alreadyDebited.set(l.purchaseLineId, (alreadyDebited.get(l.purchaseLineId) ?? 0) + l.qty);
      }
      setPurchase(pur);
      setRows(pur.lines.map((l) => {
        const already = alreadyDebited.get(l.lineId) ?? 0;
        const eligibleQty = Math.max(0, l.enteredQty - already);
        return { purchaseLineId: l.lineId, name: l.nameSnapshot, originalQty: l.enteredQty, eligibleQty, debitQty: 0 };
      }));
    } catch (e) {
      toast.error(mapCallableError(e));
    } finally {
      setLoadingPurchase(false);
    }
  }

  useEffect(() => {
    const fromParam = searchParams.get('purchaseId');
    if (fromParam) void loadPurchase(fromParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const purchaseOptions: ComboboxOption[] = useMemo(
    () => recentPurchases.map((p) => ({ value: p.id, label: `${p.supplierSnapshot?.name ?? '—'} · ${p.supplierBillNo || p.date}` })),
    [recentPurchases],
  );

  function updateQty(purchaseLineId: string, qty: number) {
    setRows((prev) => prev.map((r) => r.purchaseLineId === purchaseLineId ? { ...r, debitQty: Math.max(0, Math.min(qty, r.eligibleQty)) } : r));
  }

  async function submit(confirmations: ('NEGATIVE_STOCK')[] = []) {
    if (!purchase) { toast.error('Choose a purchase.'); return; }
    const lines = rows.filter((r) => r.debitQty > 0).map((r) => ({ purchaseLineId: r.purchaseLineId, qty: r.debitQty }));
    if (lines.length === 0) { toast.error('Enter a quantity to debit-note on at least one line.'); return; }
    const payload: CreateDebitNote & { requestId: string } = {
      purchaseId: purchase.id, locationId: purchase.locationId, date, restock, lines, reason, confirmations,
      requestId: newRequestId(),
    };
    setBusy(true);
    try {
      const res = await service.debitNotes.save(payload);
      toast.success('Debit note issued');
      navigate(`/inventory/debit-notes/${res.debitNoteId}`);
    } catch (e) {
      if (callableErrorCode(e) === 'NEGATIVE_STOCK') {
        if (!canOverride) { toast.error('This restock would take stock negative, which you cannot override.'); return; }
        const ok = await confirm({ title: 'Allow negative stock?', description: 'Removing these units takes stock below zero. Continue?', confirmLabel: 'Continue', danger: true });
        if (ok) return void submit(['NEGATIVE_STOCK']);
      } else {
        toast.error(mapCallableError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-24">
      <PageHeader
        title="New Debit Note"
        description="Issued against a purchase. Dr Accounts Payable / Cr Inventory; restock also removes the units returned to the supplier (BR-DBN-03/04)."
        actions={<Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>}
      />
      <SectionCard title="Purchase">
        {purchase ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{purchase.supplierSnapshot?.name ?? '—'}</p>
              <p className="text-sm text-muted-foreground">{purchase.supplierBillNo || purchase.date}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setPurchase(null); setRows([]); }}>Change</Button>
          </div>
        ) : (
          <Combobox
            options={purchaseOptions}
            value=""
            onChange={(v) => { setPurchaseQuery(v); void loadPurchase(v); }}
            placeholder="Search purchases…"
            searchPlaceholder="Search by supplier or bill no…"
            emptyText={purchaseQuery ? 'No purchase found' : 'Start typing to search'}
          />
        )}
      </SectionCard>

      {loadingPurchase && <PageSkeleton />}

      {purchase && !loadingPurchase && (
        <>
          <SectionCard title="Lines to debit-note" description="Quantity is capped to what's still eligible on each line (BR-DBN-01).">
            <div className="flex flex-col gap-3">
              {rows.map((r) => (
                <div key={r.purchaseLineId} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">Purchased {r.originalQty} · eligible {r.eligibleQty}</p>
                  </div>
                  <Input
                    type="number" inputMode="decimal" min={0} max={r.eligibleQty} step="0.001"
                    className="w-28" value={r.debitQty}
                    disabled={r.eligibleQty <= 0}
                    onChange={(e) => updateQty(r.purchaseLineId, Number(e.target.value) || 0)}
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
                  Return these units to the supplier (removes stock)
                </label>
              </div>
              <Field label="Reason" htmlFor="reason" className="sm:col-span-2"><Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            </div>
          </SectionCard>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button onClick={() => void submit()} loading={busy}>Issue debit note</Button>
          </div>
        </>
      )}
    </div>
  );
}
