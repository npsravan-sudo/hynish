/**
 * Shared enumerations and legacy-preserved defaults (LEGACY-COMPATIBILITY DEF-*).
 * These are the single source of truth — no feature may redefine them as magic strings.
 */

/** Base units (DEF-026). */
export const UNITS = ['Pcs', 'Set', 'Pair', 'Mtr', 'Kg', 'Box', 'Dozen'] as const;
export type Unit = (typeof UNITS)[number];

/** Allowed GST rates as basis points (DEF-024, BR-GST-08). 5% = 500. */
export const GST_RATES_BP = [0, 25, 300, 500, 1200, 1800, 2800, 4000] as const;
export type GstRateBp = (typeof GST_RATES_BP)[number];

/** Payment modes (DEF-040). Non-Cash books to the Bank account (BR-PAY-04). */
export const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

/** Document numbering series (BR-NUM-01). Six independent series, never combined. */
export const SERIES_KEYS = [
  'invoice_gst',
  'invoice_nogst',
  'quotation',
  'delivery_note',
  'credit_note',
  'debit_note',
] as const;
export type SeriesKey = (typeof SERIES_KEYS)[number];

/** Default prefixes per series (DEF-001..011). Fallbacks applied on invalid input (DEF-013). */
export const DEFAULT_PREFIXES: Record<SeriesKey, string> = {
  invoice_gst: 'INV',
  invoice_nogst: 'NGST',
  quotation: 'QUO',
  delivery_note: 'DN',
  credit_note: 'CN',
  debit_note: 'DBN',
};

/** Default starting sequence for every series (DEF-002..012). */
export const DEFAULT_INITIAL_SEQ = 1;

/** Default low-stock threshold when a product has none (DEF-023, BR-STK-04). */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/** New Bill opens as Without GST (DEF-016). Critical legacy default — do not change. */
export const NEW_BILL_GST_APPLICABLE_DEFAULT = false;

/** Location types (DEF-070). */
export const LOCATION_TYPES = ['shop', 'warehouse'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

/** Outstanding threshold in paise (BR-MNY-02, BR-DUE-02): a gap greater than 50 paise. */
export const OUTSTANDING_THRESHOLD_PAISE = 50;

/** Default business timezone (BR-DAT-03). */
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
