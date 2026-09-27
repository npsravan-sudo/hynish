import { describe, it, expect } from 'vitest';
import { LEGACY_DEFAULTS, migrateThemeValue } from './legacy-defaults.js';

describe('legacy defaults registry (§54, §55)', () => {
  it('preserves numbering prefixes and initial sequence', () => {
    expect(LEGACY_DEFAULTS.numberingPrefixes.invoice_gst).toBe('INV');
    expect(LEGACY_DEFAULTS.numberingPrefixes.invoice_nogst).toBe('NGST');
    expect(LEGACY_DEFAULTS.numberingInitialSeq).toBe(1);
  });
  it('preserves the low-stock default of 5', () => {
    expect(LEGACY_DEFAULTS.lowStockThreshold).toBe(5);
  });
  it('preserves New Bill defaulting to Without GST (false)', () => {
    expect(LEGACY_DEFAULTS.newBillGstApplicable).toBe(false);
  });
  it('preserves the sync interval default of 2 minutes', () => {
    expect(LEGACY_DEFAULTS.syncIntervalMinutes).toBe(2);
  });
  it('preserves the GST suggestion boundary and outstanding threshold', () => {
    expect(LEGACY_DEFAULTS.gstSuggestionThresholdPaise).toBe(250000);
    expect(LEGACY_DEFAULTS.outstandingThresholdPaise).toBe(50);
  });
  it('preserves the business timezone and FY start month', () => {
    expect(LEGACY_DEFAULTS.timezone).toBe('Asia/Kolkata');
    expect(LEGACY_DEFAULTS.financialYearStartMonth).toBe(4);
  });
});

describe('theme migration (§33, LC-2.4)', () => {
  it('preserves legacy light/dark and defaults unknown to system', () => {
    expect(migrateThemeValue('light')).toBe('light');
    expect(migrateThemeValue('dark')).toBe('dark');
    expect(migrateThemeValue(null)).toBe('system');
    expect(migrateThemeValue('teal')).toBe('system');
    expect(migrateThemeValue(undefined)).toBe('system');
  });
});
