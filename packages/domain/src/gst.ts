/**
 * GST calculation engine (BR-GST-01..19). Pure and deterministic — NO Firestore, NO side
 * effects. This is the single source of GST math, reused by invoices, quotations and credit
 * notes and mirrored by the (future) server-authoritative billing function. Preserves the exact
 * legacy behavior documented in TECHNICAL-DOCUMENTATION §2.7 / §5.2.
 *
 * All money is integer paise; rates and discounts are integer basis points (500 bp = 5%).
 * Rounding: per line, taxable/CGST/SGST/IGST are rounded to whole paise (OQ-05); CGST and SGST
 * are each round(taxable × rate / 2) so they are always equal and sum to the intra total.
 */
import { roundHalfUp, Money } from './money.js';
import type { GstRateBp, TaxType } from './constants.js';

/** Decide intra- vs inter-state (BR-GST-01/02): intra if states equal OR either is blank. */
export function taxTypeFor(sellerStateCode: string | null | undefined, customerStateCode: string | null | undefined): TaxType {
  const s = (sellerStateCode ?? '').trim();
  const c = (customerStateCode ?? '').trim();
  if (s === '' || c === '') return 'intra';
  return s === c ? 'intra' : 'inter';
}

export interface GstLineInput {
  /** Quantity in the line's unit (may be fractional, up to 3 dp). */
  qty: number;
  /** Rate per unit, in paise. */
  ratePaise: number;
  /** Discount in basis points (1250 = 12.5%). */
  discountBp: number;
  /** GST rate in basis points, snapshotted when the line was added (BR-GST-09). */
  gstRateBp: GstRateBp;
}

export interface GstLineResult {
  grossPaise: number;
  discountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  totalPaise: number;
}

/**
 * Compute a single line under a tax type (BR-GST-03..05). When `gstApplicable` is false
 * (invoice "Without GST" only, BR-GST-06), all tax is zero and total = taxable.
 */
export function computeGstLine(
  input: GstLineInput,
  taxType: TaxType,
  gstApplicable: boolean,
): GstLineResult {
  const gross = Money.multiply(input.ratePaise, input.qty); // round(rate × qty)
  const discount = Money.percentage(gross, input.discountBp);
  const taxable = gross - discount;

  if (!gstApplicable) {
    return { grossPaise: gross, discountPaise: discount, taxablePaise: taxable, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, taxPaise: 0, totalPaise: taxable };
  }

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (taxType === 'intra') {
    cgst = roundHalfUp(taxable * input.gstRateBp, 20000); // taxable × rate / 2
    sgst = cgst;
  } else {
    igst = roundHalfUp(taxable * input.gstRateBp, 10000); // taxable × rate
  }
  const tax = cgst + sgst + igst;
  return { grossPaise: gross, discountPaise: discount, taxablePaise: taxable, cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst, taxPaise: tax, totalPaise: taxable + tax };
}

export interface GstTotals {
  subtotalPaise: number; // Σ taxable
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  roundOffPaise: number; // grand rounded to nearest rupee, in [-50, 50]
  grandTotalPaise: number;
}

/**
 * Total a cart of already-computed lines and round the grand total to the nearest rupee,
 * booking the delta as roundOff (BR-MNY-03). Deterministic.
 */
export function totalsForCart(lines: readonly GstLineResult[]): GstTotals {
  const subtotal = Money.sum(lines.map((l) => l.taxablePaise));
  const cgst = Money.sum(lines.map((l) => l.cgstPaise));
  const sgst = Money.sum(lines.map((l) => l.sgstPaise));
  const igst = Money.sum(lines.map((l) => l.igstPaise));
  const tax = cgst + sgst + igst;
  const unrounded = subtotal + tax;
  const { rounded, roundOff } = Money.roundToRupee(unrounded);
  return { subtotalPaise: subtotal, cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst, taxPaise: tax, roundOffPaise: roundOff, grandTotalPaise: rounded };
}

/**
 * Legacy GST-rate SUGGESTION (BR-GST-18): wholesalePrice > ₹2500 → 18%, else 5%.
 * A suggestion offered in the product form only — never an enforced tax classification.
 */
export function suggestGstRateBp(wholesalePricePaise: number): GstRateBp {
  return wholesalePricePaise > 2500 * 100 ? 1800 : 500;
}
