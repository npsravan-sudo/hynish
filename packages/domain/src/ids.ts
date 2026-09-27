/**
 * ID strategy (§51). Persisted documents use Firestore auto-generated ids (created by the
 * repository/converter at write time) — collision-resistant and not client-guessable in a way
 * that matters. Server-sensitive ids (reservations, idempotency keys) are generated server-side.
 * This helper provides a strong client-side id ONLY for local/optimistic use (e.g. draft line
 * ids and idempotency request ids), never as a security token.
 */
export function newId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === 'function') {
    return g.crypto.randomUUID();
  }
  // Fallback (older runtimes): time + random. Not cryptographically strong; adequate for draft ids.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A fresh idempotency request id for a critical operation (ARCHITECTURE §6.3). */
export function newRequestId(): string {
  return newId();
}

/** Deterministic slug id (e.g. expense category `exp-cat-rent`, account `acc-rent`) — BR-EXP-04. */
export function slugId(prefix: string, name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}${slug}`;
}
