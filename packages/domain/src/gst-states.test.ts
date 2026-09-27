import { describe, it, expect } from 'vitest';
import { GST_STATES, stateCodeFromGstin, stateName, isValidGstin } from './gst-states.js';

describe('gst-states', () => {
  it('exposes states sorted by name with 2-digit codes', () => {
    expect(GST_STATES.length).toBeGreaterThan(30);
    const names = GST_STATES.map((s) => s.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
    for (const s of GST_STATES) expect(s.code).toMatch(/^\d{2}$/);
  });

  describe('stateCodeFromGstin', () => {
    it('derives the code from the leading two digits', () => {
      expect(stateCodeFromGstin('29ABCDE1234F1Z5')).toBe('29'); // Karnataka
      expect(stateCodeFromGstin('27AAAAA0000A1Z5')).toBe('27'); // Maharashtra
    });
    it('lower-case input is normalized', () => {
      expect(stateCodeFromGstin('29abcde1234f1z5')).toBe('29');
    });
    it('returns null for unknown or too-short input', () => {
      expect(stateCodeFromGstin('00AAAAA0000A1Z5')).toBeNull();
      expect(stateCodeFromGstin('2')).toBeNull();
      expect(stateCodeFromGstin('')).toBeNull();
      expect(stateCodeFromGstin(null)).toBeNull();
    });
  });

  describe('stateName', () => {
    it('maps a code to its name', () => {
      expect(stateName('29')).toBe('Karnataka');
      expect(stateName('27')).toBe('Maharashtra');
    });
    it('returns empty for unknown or blank', () => {
      expect(stateName('00')).toBe('');
      expect(stateName(null)).toBe('');
      expect(stateName('')).toBe('');
    });
  });

  describe('isValidGstin', () => {
    it('accepts a well-formed GSTIN', () => {
      expect(isValidGstin('29ABCDE1234F1Z5')).toBe(true);
      expect(isValidGstin('29abcde1234f1z5')).toBe(true); // normalized
    });
    it('rejects malformed values', () => {
      expect(isValidGstin('29ABCDE1234F1Z')).toBe(false); // 14 chars
      expect(isValidGstin('ABCDE12345678Z9')).toBe(false);
      expect(isValidGstin('')).toBe(false);
    });
  });
});
