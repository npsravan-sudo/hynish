/**
 * Pure master-data business-rule guards (Phase 4 §7, BR-PRD-01). Kept free of firebase-admin so the
 * rules are unit-testable in isolation. Callables call these AFTER Zod validation and BEFORE any
 * Firestore write. They throw typed AppErrors (VALIDATION_FAILED) that the callable pipeline maps.
 */
import { appError } from '../utils/errors.js';

export interface ProductRulesInput {
  hasVariants: boolean;
  variants: { size: string; color: string }[];
  altUnits: { name: string; factor: number }[];
  unit: string;
  barcode: string; // already normalized
}

/** Enforce product invariants that Zod cannot express (duplicate variants/alt-units, barcode shape). */
export function assertProductBusinessRules(input: ProductRulesInput): void {
  // ≥1 variant is enforced by schema. No duplicate (size,color) when hasVariants (BR-PRD-01).
  if (input.hasVariants) {
    const seen = new Set<string>();
    for (const v of input.variants) {
      const key = `${v.size.trim().toLowerCase()}|${v.color.trim().toLowerCase()}`;
      if (seen.has(key)) throw appError('VALIDATION_FAILED', 'Duplicate variant (same size and color).');
      seen.add(key);
    }
  }
  // Alt units: non-empty name, factor > 0, de-duplicated, never equal to the base unit (BR-PRD-01).
  const altSeen = new Set<string>();
  for (const a of input.altUnits) {
    const name = a.name.trim();
    if (!name || a.factor <= 0) throw appError('VALIDATION_FAILED', 'Alt unit needs a name and a positive factor.');
    if (name.toLowerCase() === input.unit.toLowerCase()) throw appError('VALIDATION_FAILED', 'Alt unit cannot equal the base unit.');
    if (altSeen.has(name.toLowerCase())) throw appError('VALIDATION_FAILED', 'Duplicate alt unit.');
    altSeen.add(name.toLowerCase());
  }
  if (input.barcode.includes('/')) throw appError('VALIDATION_FAILED', 'Barcode cannot contain "/".');
}
