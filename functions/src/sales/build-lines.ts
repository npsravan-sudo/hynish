/**
 * Build authoritative invoice/quotation lines from draft inputs + product master data (§12, §13).
 * The server snapshots the historical values (name, code, HSN, unit, cost) so a document survives
 * later product edits, and recomputes every tax/total via the shared domain GST engine (§16, §23).
 * Client-provided money is never trusted; only business inputs (qty, rate, discount, gst rate) are.
 */
import { computeCart, newId, toBaseQty, type TaxType, type GstRateBp } from '@hynish/domain';
import { appError } from '../utils/errors.js';

export interface DraftLine {
  productId: string;
  variantId: string;
  unit: string;
  qty: number;
  ratePaise: number;
  discountBp: number;
  gstRateBp: GstRateBp;
}

export interface ProductData {
  name: string;
  barcode?: string;
  hsn?: string;
  unit: string;
  purchasePricePaise?: number;
  altUnits?: { name: string; factor: number }[];
  variants?: { id: string; size?: string; color?: string; active?: boolean }[];
  hasVariants?: boolean;
  deletedAt?: unknown;
}

export interface BuiltLine {
  lineId: string;
  productId: string;
  variantId: string;
  nameSnapshot: string;
  codeSnapshot: string;
  hsnSnapshot: string;
  unit: string;
  qty: number;
  baseQty: number;
  ratePaise: number;
  discountBp: number;
  gstRateBp: GstRateBp;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  unitCostPaise: number;
  skipStockDeduction: boolean;
}

export interface BuildResult {
  lines: BuiltLine[];
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  grandTotalPaise: number;
  cogsTotalPaise: number;
}

function variantLabel(name: string, v?: { size?: string; color?: string }): string {
  const extra = [v?.size, v?.color].filter((s) => s && s.trim()).join(' / ');
  return extra ? `${name} (${extra})` : name;
}

/**
 * Compute the authoritative lines + totals. `products` maps productId → product doc data. Throws
 * NOT_FOUND for a missing/archived product or unknown variant, VALIDATION_FAILED for a bad quantity.
 */
export function buildLines(
  drafts: readonly DraftLine[],
  products: Map<string, ProductData>,
  taxType: TaxType,
  gstApplicable: boolean,
): BuildResult {
  if (drafts.length === 0) throw appError('VALIDATION_FAILED', 'An invoice needs at least one line.');

  const meta = drafts.map((d) => {
    const p = products.get(d.productId);
    if (!p || p.deletedAt != null) throw appError('NOT_FOUND', `Product not found: ${d.productId}`);
    const variant = (p.variants ?? []).find((v) => v.id === d.variantId);
    if (!variant) throw appError('NOT_FOUND', `Product variant not found: ${d.variantId}`);
    if (!(d.qty > 0)) throw appError('VALIDATION_FAILED', 'Quantity must be greater than zero.'); // BR-INV-03
    const factor = (p.altUnits ?? []).find((a) => a.name === d.unit)?.factor;
    const baseQty = toBaseQty(d.qty, factor);
    return { d, p, variant, baseQty };
  });

  const { lines: computed, totals } = computeCart(
    meta.map(({ d }) => ({ qty: d.qty, ratePaise: d.ratePaise, discountBp: d.discountBp, gstRateBp: d.gstRateBp })),
    taxType,
    gstApplicable,
  );

  let cogsTotalPaise = 0;
  const lines: BuiltLine[] = meta.map(({ d, p, variant, baseQty }, i) => {
    const c = computed[i]!;
    const unitCostPaise = Math.max(0, Math.trunc(p.purchasePricePaise ?? 0));
    cogsTotalPaise += unitCostPaise * baseQty;
    return {
      lineId: newId(),
      productId: d.productId,
      variantId: d.variantId,
      nameSnapshot: variantLabel(p.name, variant),
      codeSnapshot: p.barcode ?? '',
      hsnSnapshot: p.hsn ?? '',
      unit: d.unit,
      qty: d.qty,
      baseQty,
      ratePaise: d.ratePaise,
      discountBp: d.discountBp,
      gstRateBp: d.gstRateBp,
      taxablePaise: c.taxablePaise,
      cgstPaise: c.cgstPaise,
      sgstPaise: c.sgstPaise,
      igstPaise: c.igstPaise,
      totalPaise: c.totalPaise,
      unitCostPaise,
      skipStockDeduction: false,
    };
  });

  return {
    lines,
    subtotalPaise: totals.subtotalPaise,
    cgstPaise: totals.cgstPaise,
    sgstPaise: totals.sgstPaise,
    igstPaise: totals.igstPaise,
    taxPaise: totals.taxPaise,
    roundOffPaise: totals.roundOffPaise,
    grandTotalPaise: totals.grandTotalPaise,
    cogsTotalPaise: Math.round(cogsTotalPaise),
  };
}
