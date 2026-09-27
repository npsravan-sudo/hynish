import { describe, it, expect } from 'vitest';
import { normalizeBarcode, lower, buildSearchTokens } from './text.js';

describe('text helpers', () => {
  describe('normalizeBarcode', () => {
    it('trims and upper-cases', () => {
      expect(normalizeBarcode('  ab12cd ')).toBe('AB12CD');
    });
    it('handles nullish', () => {
      expect(normalizeBarcode(null)).toBe('');
      expect(normalizeBarcode(undefined)).toBe('');
    });
  });

  describe('lower', () => {
    it('trims and lower-cases', () => {
      expect(lower('  Blue Shirt ')).toBe('blue shirt');
    });
  });

  describe('buildSearchTokens', () => {
    it('emits word prefixes of length >= 2 for each field', () => {
      const tokens = buildSearchTokens('Shirt');
      expect(tokens).toContain('sh');
      expect(tokens).toContain('shi');
      expect(tokens).toContain('shirt');
      expect(tokens).not.toContain('s'); // single char excluded
    });
    it('combines multiple fields and de-duplicates', () => {
      const tokens = buildSearchTokens('Blue', 'blue');
      expect(tokens.filter((t) => t === 'blue')).toHaveLength(1);
    });
    it('splits on non-alphanumerics and ignores empty fields', () => {
      const tokens = buildSearchTokens('AB-12', null, '');
      expect(tokens).toContain('ab');
      expect(tokens).toContain('12');
    });
    it('caps the token count at 60', () => {
      const many = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
      expect(buildSearchTokens(many).length).toBeLessThanOrEqual(60);
    });
  });
});
