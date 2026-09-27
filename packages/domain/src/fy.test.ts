import { describe, it, expect } from 'vitest';
import { fyLabel, isValidBusinessDate } from './fy.js';

describe('fy — BR-DAT', () => {
  it('labels the financial year starting in April', () => {
    expect(fyLabel('2026-04-01')).toBe('2627');
    expect(fyLabel('2026-03-31')).toBe('2526');
    expect(fyLabel('2025-12-15')).toBe('2526');
  });

  it('validates strict business dates within range', () => {
    expect(isValidBusinessDate('2026-04-01')).toBe(true);
    expect(isValidBusinessDate('1989-12-31')).toBe(false);
    expect(isValidBusinessDate('2201-01-01')).toBe(false);
    expect(isValidBusinessDate('0002-09-15')).toBe(false);
    expect(isValidBusinessDate('2026-13-01')).toBe(false);
    expect(isValidBusinessDate('2026-02-30')).toBe(false);
    expect(isValidBusinessDate('26-4-1')).toBe(false);
  });
});
