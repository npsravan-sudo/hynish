/**
 * Money is stored everywhere as integer paise (DATA-MODEL §2, BR-MNY-01).
 * These helpers are the ONLY sanctioned way to convert, compute and format money.
 * No floating-point money is ever persisted. All inputs/outputs are integer paise.
 *
 * Safe range: JS integers are exact to 2^53. All realistic ERP amounts (well under
 * ₹90 trillion) stay in range; intermediate products in percentage() are bounded by
 * the caller's values (a line taxable × 4000 bp is safe for any realistic invoice).
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

/** Integer half-up rounding of numerator/denominator (no floats). */
export function roundHalfUp(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  const sign = numerator < 0 !== denominator < 0 ? -1 : 1;
  const a = Math.abs(numerator);
  const b = Math.abs(denominator);
  return sign * Math.floor((a * 2 + b) / (b * 2));
}

/** The Money value object is a plain integer (paise). These are the sanctioned operations. */
export const Money = {
  zero: 0,
  add: (a: number, b: number): number => Math.trunc(a) + Math.trunc(b),
  subtract: (a: number, b: number): number => Math.trunc(a) - Math.trunc(b),
  sum: (values: readonly number[]): number => values.reduce((acc, v) => acc + Math.trunc(v), 0),
  /** Multiply paise by a (possibly fractional) quantity, rounding to whole paise. */
  multiply: (paise: number, factor: number): number => Math.round(paise * factor),
  /** Divide paise into `parts`, rounding to whole paise. */
  divide: (paise: number, parts: number): number => (parts === 0 ? 0 : Math.round(paise / parts)),
  /** `bp` basis points of `paise` (e.g. 500 bp = 5%), rounded half-up to whole paise. */
  percentage: (paise: number, bp: number): number => roundHalfUp(paise * bp, 10000),
  compare: (a: number, b: number): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0),
  isZero: (paise: number): boolean => Math.trunc(paise) === 0,
  isNegative: (paise: number): boolean => paise < 0,
  max: (a: number, b: number): number => (a >= b ? a : b),
  min: (a: number, b: number): number => (a <= b ? a : b),
  clampNonNegative: (paise: number): number => (paise < 0 ? 0 : Math.trunc(paise)),
  /** Round paise to the nearest rupee (100 paise). Returns { rounded, roundOff }. */
  roundToRupee: (paise: number): { rounded: number; roundOff: number } => {
    const rounded = Math.round(paise / 100) * 100;
    return { rounded, roundOff: rounded - paise };
  },
} as const;

/** Format integer paise as an Indian-locale currency string, e.g. 12345678 -> "₹1,23,456.78". */
export function formatINR(paise: number, opts?: { withSymbol?: boolean }): string {
  const withSymbol = opts?.withSymbol ?? true;
  const value = toRupees(Math.trunc(paise));
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return withSymbol ? `₹${formatted}` : formatted;
}

/** Compact Indian currency for dense chart axes, e.g. 12000000 paise -> "₹1.2L". */
export function formatINRCompact(paise: number): string {
  const rupees = toRupees(Math.trunc(paise));
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs % 1_00_00_000 === 0 ? 0 : 1)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(abs % 1_00_000 === 0 ? 0 : 1)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}
