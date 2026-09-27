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

import { Money } from './money.js';
describe('Money ops (BR-MNY)', () => {
  it('adds, subtracts, sums as integers', () => {
    expect(Money.add(150, 250)).toBe(400);
    expect(Money.subtract(500, 200)).toBe(300);
    expect(Money.sum([100, 200, 300])).toBe(600);
  });
  it('percentage uses basis points, half-up', () => {
    expect(Money.percentage(90000, 500)).toBe(4500); // 5%
    expect(Money.percentage(81000, 250)).toBe(2025); // 2.5%
  });
  it('multiply/divide round to whole paise', () => {
    expect(Money.multiply(45000, 2)).toBe(90000);
    expect(Money.multiply(10011, 1)).toBe(10011);
    expect(Money.divide(100, 3)).toBe(33);
  });
  it('compares and clamps', () => {
    expect(Money.compare(100, 200)).toBe(-1);
    expect(Money.compare(200, 200)).toBe(0);
    expect(Money.clampNonNegative(-50)).toBe(0);
    expect(Money.max(10, 20)).toBe(20);
  });
  it('rounds to the nearest rupee with roundOff', () => {
    expect(Money.roundToRupee(94512)).toEqual({ rounded: 94500, roundOff: -12 });
    expect(Money.roundToRupee(94550)).toEqual({ rounded: 94600, roundOff: 50 });
  });
});
