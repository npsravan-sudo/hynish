/**
 * Canonical date/time (BR-DAT, §52/§53). One representation per concept, framework-free:
 *  - Instant (created/updated/at): epoch MILLISECONDS (number), field suffix `Ms`. Firestore
 *    converters translate `Timestamp` <-> epoch ms at the persistence boundary.
 *  - Business date (date/dueDate/period): strict 'YYYY-MM-DD' string in the business timezone.
 * Business-date semantics (FY start in April, 1990–2200 range) are preserved from the legacy app.
 */
import { DEFAULT_TIMEZONE } from './constants.js';

/** Canonical instant type. */
export type EpochMs = number;

export function nowMs(): EpochMs {
  return Date.now();
}

/** Today's business date as 'YYYY-MM-DD' in the given timezone (default Asia/Kolkata). */
export function todayISO(timezone: string = DEFAULT_TIMEZONE, at: Date = new Date()): string {
  // en-CA yields YYYY-MM-DD; timeZone shifts the calendar day to the business zone.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Month key 'YYYY-MM' from a business date (for monthly ledger buckets / filters). */
export function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

/** Compare two 'YYYY-MM-DD' strings (lexicographic == chronological for this format). */
export function compareDateISO(a: string, b: string): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Is `dateISO` within [from, to] inclusive? Blank bounds are treated as open. */
export function isWithinRange(dateISO: string, from?: string | null, to?: string | null): boolean {
  if (from && dateISO < from) return false;
  if (to && dateISO > to) return false;
  return true;
}
