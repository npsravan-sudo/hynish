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

import { todayISO, monthKey, isWithinRange, compareDateISO } from './dates.js';
describe('dates (§52/§53)', () => {
  it('formats today in a timezone as YYYY-MM-DD', () => {
    const d = todayISO('Asia/Kolkata', new Date('2026-04-05T20:00:00Z'));
    expect(/^\d{4}-\d{2}-\d{2}$/.test(d)).toBe(true);
    // 20:00 UTC on Apr 5 is 01:30 Apr 6 IST
    expect(d).toBe('2026-04-06');
  });
  it('derives month key and range checks', () => {
    expect(monthKey('2026-04-05')).toBe('2026-04');
    expect(isWithinRange('2026-04-05', '2026-04-01', '2026-04-30')).toBe(true);
    expect(isWithinRange('2026-05-05', '2026-04-01', '2026-04-30')).toBe(false);
    expect(compareDateISO('2026-04-01', '2026-04-02')).toBe(-1);
  });
});
