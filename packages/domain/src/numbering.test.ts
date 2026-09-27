import { describe, it, expect } from 'vitest';
import {
  formatDocumentNumber, parseDocumentNumber, normalizeSeriesConfig, formatFromConfig,
} from './numbering.js';
import { DEFAULT_PREFIXES } from './constants.js';

describe('numbering — format & parse (BR-NUM-02)', () => {
  it('formats PREFIX/FY/seq padded to 4', () => {
    expect(formatDocumentNumber('INV', '2627', 1)).toBe('INV/2627/0001');
    expect(formatDocumentNumber('NGST', '2627', 42)).toBe('NGST/2627/0042');
    expect(formatDocumentNumber('INV', '2627', 12345)).toBe('INV/2627/12345');
  });
  it('parses a document number', () => {
    expect(parseDocumentNumber('INV/2627/0001')).toEqual({ prefix: 'INV', fy: '2627', seq: 1 });
    expect(parseDocumentNumber('not a number')).toBeNull();
  });
  it('formats from a config using the document date FY', () => {
    const cfg = normalizeSeriesConfig('invoice_gst', 'INV', 1);
    expect(formatFromConfig(cfg, '2026-04-05', 7)).toBe('INV/2627/0007');
  });
});

describe('numbering — defaults & separation (BR-NUM-01/09, DEF-001..012)', () => {
  it('preserves the six legacy prefixes', () => {
    expect(DEFAULT_PREFIXES.invoice_gst).toBe('INV');
    expect(DEFAULT_PREFIXES.invoice_nogst).toBe('NGST');
    expect(DEFAULT_PREFIXES.quotation).toBe('QUO');
    expect(DEFAULT_PREFIXES.delivery_note).toBe('DN');
    expect(DEFAULT_PREFIXES.credit_note).toBe('CN');
    expect(DEFAULT_PREFIXES.debit_note).toBe('DBN');
  });
  it('keeps GST and Non-GST series independent', () => {
    const gst = normalizeSeriesConfig('invoice_gst', 'INV', 10);
    const nogst = normalizeSeriesConfig('invoice_nogst', 'NGST', 3);
    expect(gst.prefix).toBe('INV');
    expect(nogst.prefix).toBe('NGST');
    expect(gst.nextSeq).not.toBe(nogst.nextSeq);
  });
  it('falls back to the default prefix and sequence 1 on invalid input (DEF-013)', () => {
    const cfg = normalizeSeriesConfig('quotation', '   ', 0);
    expect(cfg.prefix).toBe('QUO');
    expect(cfg.nextSeq).toBe(1);
    expect(normalizeSeriesConfig('credit_note', undefined, -5).nextSeq).toBe(1);
  });
});
