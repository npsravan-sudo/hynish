import { describe, it, expect } from 'vitest';
import { GstCalculationService } from './gst.service';

const lines = [{ qty: 2, ratePaise: 45000, discountBp: 0, gstRateBp: 500 as const }];

describe('GstCalculationService.computeDraft', () => {
  it('picks intra for same state and splits CGST/SGST', () => {
    const r = GstCalculationService.computeDraft({ sellerStateCode: '29', customerStateCode: '29', gstApplicable: true, lines });
    expect(r.taxType).toBe('intra');
    expect(r.lines[0]!.cgstPaise).toBe(2250);
    expect(r.lines[0]!.sgstPaise).toBe(2250);
    expect(r.totals.grandTotalPaise).toBe(94500);
  });
  it('picks inter for different states (IGST)', () => {
    const r = GstCalculationService.computeDraft({ sellerStateCode: '29', customerStateCode: '27', gstApplicable: true, lines });
    expect(r.taxType).toBe('inter');
    expect(r.lines[0]!.igstPaise).toBe(4500);
  });
  it('zeroes tax when GST is not applicable (Without GST)', () => {
    const r = GstCalculationService.computeDraft({ sellerStateCode: '29', customerStateCode: '29', gstApplicable: false, lines });
    expect(r.totals.taxPaise).toBe(0);
    expect(r.totals.grandTotalPaise).toBe(90000);
  });
});
