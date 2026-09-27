/**
 * GST calculation service (§43). A thin, PURE wrapper over the domain GST engine that computes a
 * whole draft (lines + totals) for live billing preview. Deterministic; no Firestore, no writes.
 * The server recomputes authoritatively at save time — this is preview only.
 */
import {
  taxTypeFor,
  computeGstLine,
  totalsForCart,
  type GstLineInput,
  type GstLineResult,
  type GstTotals,
  type TaxType,
} from '@hynish/domain';

export interface DraftGstInput {
  sellerStateCode: string | null | undefined;
  customerStateCode: string | null | undefined;
  gstApplicable: boolean;
  lines: GstLineInput[];
}

export interface DraftGstResult {
  taxType: TaxType;
  lines: GstLineResult[];
  totals: GstTotals;
}

export const GstCalculationService = {
  computeDraft(input: DraftGstInput): DraftGstResult {
    const taxType = taxTypeFor(input.sellerStateCode, input.customerStateCode);
    const lines = input.lines.map((l) => computeGstLine(l, taxType, input.gstApplicable));
    return { taxType, lines, totals: totalsForCart(lines) };
  },
} as const;
