import { describe, it, expect } from 'vitest';
import { taxTypeFor, computeGstLine, totalsForCart, suggestGstRateBp } from './gst.js';

const line = (over = {}) => ({ qty: 2, ratePaise: 45000, discountBp: 0, gstRateBp: 500 as const, ...over });

describe('gst — taxTypeFor (BR-GST-01/02)', () => {
  it('same state is intra', () => expect(taxTypeFor('29', '29')).toBe('intra'));
  it('different state is inter', () => expect(taxTypeFor('29', '27')).toBe('inter'));
  it('blank seller or customer state is intra', () => {
    expect(taxTypeFor('', '27')).toBe('intra');
    expect(taxTypeFor('29', '')).toBe('intra');
    expect(taxTypeFor(null, null)).toBe('intra');
  });
});

describe('gst — computeGstLine (BR-GST-03..06)', () => {
  it('intra splits CGST=SGST', () => {
    const r = computeGstLine(line(), 'intra', true);
    expect(r.taxablePaise).toBe(90000);
    expect(r.cgstPaise).toBe(2250);
    expect(r.sgstPaise).toBe(2250);
    expect(r.igstPaise).toBe(0);
    expect(r.taxPaise).toBe(4500);
    expect(r.totalPaise).toBe(94500);
  });
  it('inter uses IGST only', () => {
    const r = computeGstLine(line(), 'inter', true);
    expect(r.igstPaise).toBe(4500);
    expect(r.cgstPaise).toBe(0);
    expect(r.totalPaise).toBe(94500);
  });
  it('applies percentage discount before tax', () => {
    const r = computeGstLine(line({ discountBp: 1000 }), 'intra', true); // 10% off
    expect(r.discountPaise).toBe(9000);
    expect(r.taxablePaise).toBe(81000);
    expect(r.cgstPaise).toBe(2025);
  });
  it('Without GST zeroes all tax and total = taxable (BR-GST-06)', () => {
    const r = computeGstLine(line(), 'intra', false);
    expect(r.taxPaise).toBe(0);
    expect(r.cgstPaise).toBe(0);
    expect(r.totalPaise).toBe(90000);
  });
});

describe('gst — totalsForCart (BR-MNY-03 round off)', () => {
  it('rounds the grand total to the nearest rupee and books roundOff', () => {
    // Build a taxable that produces a non-round grand total.
    const l = computeGstLine({ qty: 1, ratePaise: 10011, discountBp: 0, gstRateBp: 500 }, 'inter', true);
    const t = totalsForCart([l]);
    expect(t.grandTotalPaise % 100).toBe(0);
    expect(t.grandTotalPaise).toBe(t.subtotalPaise + t.taxPaise + t.roundOffPaise);
    expect(Math.abs(t.roundOffPaise)).toBeLessThanOrEqual(50);
  });
});

describe('gst — suggestGstRateBp (BR-GST-18)', () => {
  it('> ₹2500 suggests 18%, else 5%', () => {
    expect(suggestGstRateBp(3000_00)).toBe(1800);
    expect(suggestGstRateBp(2500_00)).toBe(500); // boundary: not > 2500
    expect(suggestGstRateBp(100_00)).toBe(500);
  });
});
