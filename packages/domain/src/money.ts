/**
 * Money is stored everywhere as integer paise (DATA-MODEL §2, BR-MNY-01).
 * These helpers are the ONLY sanctioned way to convert and format money.
 * No floating-point money is ever persisted.
 */

/** Convert a rupee amount (possibly fractional) to integer paise. Half away from zero. */
export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

/** Convert integer paise to a rupee number (for display/inputs only, never for storage). */
export function toRupees(paise: number): number {
  return paise / 100;
}

/**
 * Format integer paise as an Indian-locale currency string, e.g. 12345678 -> "₹1,23,456.78".
 * BR-MNY-05.
 */
export function formatINR(paise: number, opts?: { withSymbol?: boolean }): string {
  const withSymbol = opts?.withSymbol ?? true;
  const value = toRupees(Math.trunc(paise));
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return withSymbol ? `₹${formatted}` : formatted;
}

/**
 * Compact Indian currency for dense chart axes, e.g. 12000000 paise -> "₹1.2L".
 * Used only where space is tight; tooltips and tables use formatINR.
 */
export function formatINRCompact(paise: number): string {
  const rupees = toRupees(Math.trunc(paise));
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs % 1_00_00_000 === 0 ? 0 : 1)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(abs % 1_00_000 === 0 ? 0 : 1)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

/** Integer half-up rounding of numerator/denominator. Used by GST/paise math (no floats). */
export function roundHalfUp(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  const sign = numerator < 0 !== denominator < 0 ? -1 : 1;
  const a = Math.abs(numerator);
  const b = Math.abs(denominator);
  return sign * Math.floor((a * 2 + b) / (b * 2));
}
