import { describe, it, expect } from 'vitest';
import { productSchema, createProductSchema } from './catalog.js';
import { journalLineSchema } from './finance.js';
import { businessSettingsSchema } from './org.js';
import { productFixture } from '../fixtures/index.js';

describe('schemas — validation (§39, §58)', () => {
  it('accepts valid data and rejects an unsupported GST rate', () => {
    expect(productSchema.safeParse(productFixture()).success).toBe(true);
    expect(productSchema.safeParse(productFixture({ gstRateBp: 999 })).success).toBe(false);
  });

  it('enforces required fields (name) on create DTO', () => {
    const good = createProductSchema.safeParse({
      name: 'Tee', category: 'Shirts', hsn: '6109', wholesalePricePaise: 20000,
      purchasePricePaise: 12000, gstRateBp: 500, unit: 'Pcs', altUnits: [], barcode: '',
      lowStockThreshold: null, hasVariants: true,
      variants: [{ id: 'default', size: '', color: '', barcodeOverride: null, active: true }],
      imagePath: null,
    });
    expect(good.success).toBe(true);
    const bad = createProductSchema.safeParse({ category: 'Shirts' });
    expect(bad.success).toBe(false);
  });

  it('rejects a product with zero variants', () => {
    expect(productSchema.safeParse(productFixture({ variants: [] })).success).toBe(false);
  });

  it('rejects a journal line with both a debit and a credit', () => {
    expect(journalLineSchema.safeParse({ accountId: 'a', debitPaise: 10, creditPaise: 0 }).success).toBe(true);
    expect(journalLineSchema.safeParse({ accountId: 'a', debitPaise: 10, creditPaise: 10 }).success).toBe(false);
  });

  it('applies settings defaults, preserving the six prefixes', () => {
    const parsed = businessSettingsSchema.parse({});
    expect(parsed.prefixes.invoice_gst).toBe('INV');
    expect(parsed.prefixes.invoice_nogst).toBe('NGST');
    expect(parsed.businessName).toBe('');
  });
});
