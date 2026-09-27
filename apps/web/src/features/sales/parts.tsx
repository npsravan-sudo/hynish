/**
 * Shared Sales form parts (Phase 5 §12, §16, §20, §50). One line-editor + tax-breakdown used by both
 * the invoice and quotation forms so calculation logic is never duplicated. All money math flows
 * through the domain GST engine (computeCart) — the client preview is not authoritative; the server
 * recomputes on save.
 */
import { useMemo } from 'react';
import { Trash2, Plus } from 'lucide-react';
import {
  formatINR, computeCart, GST_RATES_BP, newId,
  type Customer, type Product, type TaxType, type GstRateBp, type ComputedCart,
} from '@hynish/domain';

import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MoneyInput } from '@/components/forms/money-input';
import { Field } from '@/components/forms/field';

export interface DraftRow {
  key: string;
  productId: string;
  variantId: string;
  unit: string;
  qty: number;
  ratePaise: number;
  discountBp: number;
  /** Allowed GST rate in basis points; server validates against GST_RATES_BP. */
  gstRateBp: number;
}

const GST_RATE_OPTIONS = (GST_RATES_BP as readonly number[]).map((bp) => ({ value: String(bp), label: `${bp / 100}%` }));

/** Build a draft row from a product (prefills unit, rate, gst rate, default variant). BR-INV-04 handled by caller. */
export function rowFromProduct(p: Product): DraftRow {
  const variant = p.hasVariants ? (p.variants.find((v) => v.active) ?? p.variants[0]) : p.variants[0];
  return {
    key: newId(),
    productId: p.id,
    variantId: variant?.id ?? 'default',
    unit: p.unit,
    qty: 1,
    ratePaise: p.wholesalePricePaise,
    discountBp: 0,
    gstRateBp: p.gstRateBp,
  };
}

/** Compute the cart from rows (per-line results + totals) via the domain engine. */
export function useComputedCart(rows: DraftRow[], taxType: TaxType, gstApplicable: boolean): ComputedCart {
  return useMemo(
    () => computeCart(rows.map((r) => ({ qty: r.qty, ratePaise: r.ratePaise, discountBp: r.discountBp, gstRateBp: r.gstRateBp as GstRateBp })), taxType, gstApplicable),
    [rows, taxType, gstApplicable],
  );
}

export function CustomerPicker({
  customers, value, onChange, id,
}: { customers: Customer[]; value: string | null; onChange: (id: string | null) => void; id?: string }) {
  const options: ComboboxOption[] = customers.map((c) => ({ value: c.id, label: c.gstin ? `${c.name} · ${c.gstin}` : c.name }));
  return (
    <Combobox
      id={id}
      options={options}
      value={value ?? ''}
      onChange={(v) => onChange(v || null)}
      placeholder="Walk-in / cash customer"
      searchPlaceholder="Search customers…"
      emptyText="No customers found"
    />
  );
}

function ProductAdder({ products, onAdd }: { products: Product[]; onAdd: (p: Product) => void }) {
  const options: ComboboxOption[] = products.map((p) => ({ value: p.id, label: p.barcode ? `${p.name} · ${p.barcode}` : p.name }));
  return (
    <Combobox
      options={options}
      value=""
      onChange={(id) => {
        const p = products.find((x) => x.id === id);
        if (p) onAdd(p);
      }}
      placeholder="Add a product…"
      searchPlaceholder="Search products by name or code…"
      emptyText="No products found"
    />
  );
}

export function LineEditor({
  products, rows, computed, onChange,
}: {
  products: Product[];
  rows: DraftRow[];
  computed: ComputedCart;
  onChange: (rows: DraftRow[]) => void;
}) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function addProduct(p: Product) {
    // BR-INV-04: adding a product+variant already present increments that line's quantity.
    const draft = rowFromProduct(p);
    const existing = rows.findIndex((r) => r.productId === draft.productId && r.variantId === draft.variantId && r.unit === draft.unit);
    if (existing >= 0) {
      const next = [...rows];
      next[existing] = { ...next[existing]!, qty: next[existing]!.qty + 1 };
      onChange(next);
    } else {
      onChange([...rows, draft]);
    }
  }
  function update(i: number, patch: Partial<DraftRow>) {
    const next = [...rows];
    next[i] = { ...next[i]!, ...patch };
    onChange(next);
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      <ProductAdder products={products} onAdd={addProduct} />
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No items yet. Search above to add products.</p>}
      {rows.map((r, i) => {
        const p = byId.get(r.productId);
        const line = computed.lines[i];
        const unitOptions = p ? [p.unit, ...(p.altUnits ?? []).map((a) => a.name)] : [r.unit];
        const variantOptions = p?.hasVariants ? p.variants.filter((v) => v.active) : [];
        return (
          <div key={r.key} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{p?.name ?? 'Unknown product'}</p>
                {p?.barcode && <p className="num text-xs text-muted-foreground">{p.barcode}</p>}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove line">
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {variantOptions.length > 0 && (
                <Field label="Variant" htmlFor={`v-${r.key}`} className="col-span-2">
                  <Select value={r.variantId} onValueChange={(v) => update(i, { variantId: v })}>
                    <SelectTrigger id={`v-${r.key}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {variantOptions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{[v.size, v.color].filter(Boolean).join(' / ') || v.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Unit" htmlFor={`u-${r.key}`}>
                <Select value={r.unit} onValueChange={(v) => update(i, { unit: v })}>
                  <SelectTrigger id={`u-${r.key}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Qty" htmlFor={`q-${r.key}`}>
                <Input id={`q-${r.key}`} type="number" inputMode="decimal" min={0} step="0.001" value={r.qty}
                  onChange={(e) => update(i, { qty: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Rate" htmlFor={`r-${r.key}`}>
                <MoneyInput id={`r-${r.key}`} valuePaise={r.ratePaise} onChangePaise={(v) => update(i, { ratePaise: v })} />
              </Field>
              <Field label="Disc %" htmlFor={`d-${r.key}`}>
                <Input id={`d-${r.key}`} type="number" inputMode="decimal" min={0} max={100} step="0.01"
                  value={r.discountBp / 100}
                  onChange={(e) => update(i, { discountBp: Math.round((Number(e.target.value) || 0) * 100) })} />
              </Field>
              <Field label="GST" htmlFor={`g-${r.key}`}>
                <Select value={String(r.gstRateBp)} onValueChange={(v) => update(i, { gstRateBp: Number(v) })}>
                  <SelectTrigger id={`g-${r.key}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{GST_RATE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            {line && (
              <div className="mt-2 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Taxable <span className="num text-foreground">{formatINR(line.taxablePaise)}</span></span>
                {line.taxPaise > 0 && <span>Tax <span className="num text-foreground">{formatINR(line.taxPaise)}</span></span>}
                <span>Total <span className="num font-medium text-foreground">{formatINR(line.totalPaise)}</span></span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TotalsPanel({ computed, gstApplicable, taxType }: { computed: ComputedCart; gstApplicable: boolean; taxType: TaxType }) {
  const t = computed.totals;
  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className={`flex items-center justify-between ${strong ? 'text-base font-semibold' : 'text-sm'}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <Row label="Subtotal (taxable)" value={formatINR(t.subtotalPaise)} />
      {gstApplicable && taxType === 'intra' && (
        <>
          <Row label="CGST" value={formatINR(t.cgstPaise)} />
          <Row label="SGST" value={formatINR(t.sgstPaise)} />
        </>
      )}
      {gstApplicable && taxType === 'inter' && <Row label="IGST" value={formatINR(t.igstPaise)} />}
      {!gstApplicable && <Row label="Tax" value={formatINR(0)} />}
      {t.roundOffPaise !== 0 && <Row label="Round off" value={formatINR(t.roundOffPaise)} />}
      <div className="my-1 border-t border-border" />
      <Row label="Grand total" value={formatINR(t.grandTotalPaise)} strong />
    </div>
  );
}

export { Plus };
