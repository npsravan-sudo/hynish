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

/** Document types (LEGACY-COMPATIBILITY §14; DATA-MODEL). Central enum — no string literals. */
export const DOCUMENT_TYPES = [
  'invoice_gst',
  'invoice_nogst',
  'quotation',
  'delivery_note',
  'credit_note',
  'debit_note',
  'purchase',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Which document types draw a number from which series (BR-NUM-01). Purchases are not numbered. */
export const DOCUMENT_TYPE_SERIES: Partial<Record<DocumentType, SeriesKey>> = {
  invoice_gst: 'invoice_gst',
  invoice_nogst: 'invoice_nogst',
  quotation: 'quotation',
  delivery_note: 'delivery_note',
  credit_note: 'credit_note',
  debit_note: 'debit_note',
};

/** Payment status buckets (BR-PAY-02). */
export const PAYMENT_STATUSES = ['paid', 'partial', 'unpaid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Tax type (BR-GST-01). */
export const TAX_TYPES = ['intra', 'inter'] as const;
export type TaxType = (typeof TAX_TYPES)[number];

/** Cash Book categories (DEF-038/039, BR-CASH-01). Verified from TD §6.3. */
export const CASH_IN_CATEGORIES = [
  'Sales Collection (Cash)',
  'Customer Payment Received',
  'Capital Introduced',
  'Loan/Advance Received',
  'Other Income',
] as const;
export const CASH_OUT_CATEGORIES = [
  'Supplier Payment',
  'Expense Payment',
  'Staff Salary/Commission',
  'Owner Drawings',
  'Bank Deposit',
  'Loan Repayment',
  'Other',
] as const;
export type CashInCategory = (typeof CASH_IN_CATEGORIES)[number];
export type CashOutCategory = (typeof CASH_OUT_CATEGORIES)[number];

/**
 * Sync interval options in minutes (LEGACY-COMPATIBILITY DEF-048, TD §3.2). The legacy default
 * was 2. In the new architecture interval sync is SUPERSEDED by realtime + server writes; this
 * enum is retained only to preserve the user's stored preference meaning during migration.
 */
export const SYNC_INTERVAL_OPTIONS = [0, 1, 2, 5, 10, 15, 30, 60] as const;
export type SyncIntervalMinutes = (typeof SYNC_INTERVAL_OPTIONS)[number];
export const DEFAULT_SYNC_INTERVAL_MINUTES: SyncIntervalMinutes = 2;

/** Theme preference (Phase 1 §17). Legacy stored only light/dark; System is the new addition. */
export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** Document lifecycle statuses. */
export const QUOTATION_STATUSES = ['open', 'converted'] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export const DELIVERY_NOTE_STATUSES = ['pending', 'invoiced', 'returned'] as const;
export type DeliveryNoteStatus = (typeof DELIVERY_NOTE_STATUSES)[number];
