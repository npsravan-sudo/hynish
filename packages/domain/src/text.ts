/**
 * Text normalization & search tokens (ARCHITECTURE §8.4, Phase 4 §26). Firestore has no
 * full-text search; we index lower-cased word prefixes so a list can filter by `searchTokens
 * array-contains <token>`. Free-text search over already-loaded collections stays client-side.
 */

/** Normalize a barcode: trimmed, upper-cased (BR-BAR-01). */
export function normalizeBarcode(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

/** Lower-case a name for case-insensitive ordering/equality (nameLower). */
export function lower(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Build prefix search tokens from one or more text fields. For each word of length ≥ 2, emit its
 * prefixes (2..word) so a "starts-with" search matches. Capped to keep the array small.
 */
export function buildSearchTokens(...fields: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const field of fields) {
    if (!field) continue;
    for (const word of field.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
      tokens.add(word);
      for (let i = 2; i < word.length && i <= 12; i++) tokens.add(word.slice(0, i));
    }
  }
  return [...tokens].slice(0, 60);
}
