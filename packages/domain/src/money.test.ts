import { describe, it, expect } from 'vitest';
import { toPaise, toRupees, formatINR, formatINRCompact, roundHalfUp } from './money.js';

describe('money — BR-MNY (integer paise)', () => {
  it('toPaise rounds half away from zero', () => {
    expect(toPaise(123.45)).toBe(12345);
    expect(toPaise(0.005)).toBe(1);
    expect(toPaise(0)).toBe(0);
    expect(toPaise(-1.5)).toBe(-150);
  });

  it('toRupees is the inverse for whole paise', () => {
    expect(toRupees(12345)).toBeCloseTo(123.45, 5);
  });

  it('formatINR uses Indian grouping and 2 decimals', () => {
    expect(formatINR(12345678)).toBe('₹1,23,456.78');
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(5000, { withSymbol: false })).toBe('50.00');
  });

  it('formatINRCompact abbreviates lakh and crore', () => {
    expect(formatINRCompact(1_00_000 * 100)).toBe('₹1L');
    expect(formatINRCompact(1_20_000 * 100)).toBe('₹1.2L');
    expect(formatINRCompact(1_00_00_000 * 100)).toBe('₹1Cr');
  });

  it('roundHalfUp does integer half-up rounding', () => {
    expect(roundHalfUp(500 * 5, 100)).toBe(25); // 5% of 500 = 25
    expect(roundHalfUp(3, 2)).toBe(2); // 1.5 -> 2
    expect(roundHalfUp(1, 2)).toBe(1); // 0.5 -> 1
    expect(roundHalfUp(-3, 2)).toBe(-2);
  });
});
