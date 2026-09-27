import { describe, it, expect } from 'vitest';
import { computeCart, taxTypeFor, suggestGstRateBp } from './gst.js';
import type { GstLineInput } from './gst.js';

const line = (over: Partial<GstLineInput> = {}): GstLineInput => ({ qty: 2, ratePaise: 10000, discountBp: 0, gstRateBp: 1800, ...over });

describe('computeCart — the one deterministic calculation (§22, §60, §61)', () => {
  it('intra-state splits tax into equal CGST + SGST', () => {
    const { lines, totals } = computeCart([line()], 'intra', true);
    expect(lines[0]!.taxablePaise).toBe(20000);
    expect(lines[0]!.cgstPaise).toBe(1800);
    expect(lines[0]!.sgstPaise).toBe(1800);
    expect(lines[0]!.igstPaise).toBe(0);
    expect(totals.taxPaise).toBe(3600);
    expect(totals.grandTotalPaise).toBe(23600);
    expect(totals.roundOffPaise).toBe(0);
  });

  it('inter-state books a single IGST equal to CGST+SGST', () => {
    const { lines, totals } = computeCart([line()], 'inter', true);
    expect(lines[0]!.igstPaise).toBe(3600);
    expect(lines[0]!.cgstPaise).toBe(0);
    expect(totals.igstPaise).toBe(3600);
    expect(totals.grandTotalPaise).toBe(23600);
  });

  it('Without-GST zeroes all tax (BR-GST-06)', () => {
    const { lines, totals } = computeCart([line()], 'intra', false);
    expect(lines[0]!.taxPaise).toBe(0);
    expect(lines[0]!.totalPaise).toBe(20000);
    expect(totals.taxPaise).toBe(0);
    expect(totals.grandTotalPaise).toBe(20000);
  });

  it('applies a line discount before tax', () => {
    const { lines } = computeCart([line({ discountBp: 1000 })], 'intra', true); // 10% off 20000 = 18000 taxable
    expect(lines[0]!.taxablePaise).toBe(18000);
    expect(lines[0]!.cgstPaise).toBe(1620); // 18000*1800/20000
  });

  it('sums multiple lines and rounds the grand total to the nearest rupee', () => {
    const { totals } = computeCart([line({ qty: 1, ratePaise: 9990, gstRateBp: 0 })], 'intra', true);
    // taxable 9990, no tax, grand rounds 9990 -> 10000, roundOff +10
    expect(totals.subtotalPaise).toBe(9990);
    expect(totals.grandTotalPaise).toBe(10000);
    expect(totals.roundOffPaise).toBe(10);
  });
});

describe('taxTypeFor (BR-GST-01/02) — state edge cases', () => {
  it('equal states → intra; different → inter', () => {
    expect(taxTypeFor('29', '29')).toBe('intra');
    expect(taxTypeFor('29', '27')).toBe('inter');
  });
  it('blank/unknown either side → intra (legacy behaviour)', () => {
    expect(taxTypeFor('', '27')).toBe('intra');
    expect(taxTypeFor('29', '')).toBe('intra');
    expect(taxTypeFor(null, null)).toBe('intra');
    expect(taxTypeFor(undefined, '27')).toBe('intra');
  });
});

describe('suggestGstRateBp (BR-GST-18) — suggestion only', () => {
  it('> ₹2500 → 18%, otherwise 5%', () => {
    expect(suggestGstRateBp(2500 * 100 + 1)).toBe(1800);
    expect(suggestGstRateBp(2500 * 100)).toBe(500);
    expect(suggestGstRateBp(0)).toBe(500);
  });
});
