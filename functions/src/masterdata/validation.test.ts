import { describe, it, expect } from 'vitest';
import { assertProductBusinessRules, type ProductRulesInput } from './validation.js';

const base = (over: Partial<ProductRulesInput> = {}): ProductRulesInput => ({
  hasVariants: false,
  variants: [{ size: '', color: '' }],
  altUnits: [],
  unit: 'Pcs',
  barcode: '',
  ...over,
});

function code(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as { details?: { code?: string } }).details?.code ?? 'ERR';
  }
}

describe('assertProductBusinessRules (BR-PRD-01)', () => {
  it('accepts a valid single-variant product', () => {
    expect(code(() => assertProductBusinessRules(base()))).toBeNull();
  });

  it('rejects duplicate (size,color) variants, case-insensitively', () => {
    const input = base({
      hasVariants: true,
      variants: [
        { size: 'M', color: 'Blue' },
        { size: 'm', color: 'blue' },
      ],
    });
    expect(code(() => assertProductBusinessRules(input))).toBe('VALIDATION_FAILED');
  });

  it('allows distinct variants', () => {
    const input = base({
      hasVariants: true,
      variants: [
        { size: 'M', color: 'Blue' },
        { size: 'L', color: 'Blue' },
      ],
    });
    expect(code(() => assertProductBusinessRules(input))).toBeNull();
  });

  it('rejects an alt unit with a non-positive factor or empty name', () => {
    expect(code(() => assertProductBusinessRules(base({ altUnits: [{ name: 'Dozen', factor: 0 }] })))).toBe('VALIDATION_FAILED');
    expect(code(() => assertProductBusinessRules(base({ altUnits: [{ name: '  ', factor: 12 }] })))).toBe('VALIDATION_FAILED');
  });

  it('rejects an alt unit equal to the base unit', () => {
    expect(code(() => assertProductBusinessRules(base({ unit: 'Pcs', altUnits: [{ name: 'pcs', factor: 2 }] })))).toBe('VALIDATION_FAILED');
  });

  it('rejects duplicate alt units', () => {
    const input = base({ altUnits: [{ name: 'Dozen', factor: 12 }, { name: 'dozen', factor: 12 }] });
    expect(code(() => assertProductBusinessRules(input))).toBe('VALIDATION_FAILED');
  });

  it('accepts valid alt units', () => {
    expect(code(() => assertProductBusinessRules(base({ altUnits: [{ name: 'Dozen', factor: 12 }, { name: 'Box', factor: 24 }] })))).toBeNull();
  });

  it('rejects a barcode containing a slash', () => {
    expect(code(() => assertProductBusinessRules(base({ barcode: 'AB/12' })))).toBe('VALIDATION_FAILED');
  });
});
