/**
 * Indian financial year helpers (BR-DAT-01). The FY starts on 1 April.
 * The label is YY(start)YY(end): April 2026 -> "2627", March 2026 -> "2526".
 */

/** Return the two-year FY label for an ISO date string ('YYYY-MM-DD'). */
export function fyLabel(dateISO: string): string {
  const [yearStr, monthStr] = dateISO.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error(`Invalid date for fyLabel: ${dateISO}`);
  }
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
}

/** Accepted date range for native date inputs (BR-DAT-02). */
export const MIN_YEAR = 1990;
export const MAX_YEAR = 2200;

/** Validate a strict 'YYYY-MM-DD' string within the accepted year range (BR-DAT-02). */
export function isValidBusinessDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  if (y < MIN_YEAR || y > MAX_YEAR) return false;
  if (m < 1 || m > 12) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
