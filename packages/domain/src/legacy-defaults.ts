/**
 * LEGACY DEFAULTS REGISTRY (§54). The single, verified source of every legacy default the
 * rebuild must preserve. Every value cites its source in TECHNICAL-DOCUMENTATION (TD) and/or
 * docs/LEGACY-COMPATIBILITY (DEF and BR ids). DO NOT add a value here unless verified against the
 * source. These re-export the canonical constants so there is exactly one definition of each.
 */
import {
  DEFAULT_PREFIXES,
  DEFAULT_INITIAL_SEQ,
  DEFAULT_LOW_STOCK_THRESHOLD,
  NEW_BILL_GST_APPLICABLE_DEFAULT,
  DEFAULT_SYNC_INTERVAL_MINUTES,
  GST_RATES_BP,
  UNITS,
  PAYMENT_MODES,
  OUTSTANDING_THRESHOLD_PAISE,
  DEFAULT_TIMEZONE,
  type SeriesKey,
} from './constants.js';

export const LEGACY_DEFAULTS = {
  /** Document numbering prefixes (DEF-001..011, TD §2.3/§3.2). INV/NGST/QUO/DN/CN/DBN. */
  numberingPrefixes: DEFAULT_PREFIXES as Record<SeriesKey, string>,
  /** Every series starts at 1 (DEF-002..012, TD §2.3). */
  numberingInitialSeq: DEFAULT_INITIAL_SEQ, // 1
  /** Low-stock threshold when a product has none (DEF-023, BR-STK-04, TD §2.7/§4.1). */
  lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD, // 5
  /** New Bill opens Without GST (DEF-016, BR-INV-01, TD §5.2). CRITICAL — never flip to true. */
  newBillGstApplicable: NEW_BILL_GST_APPLICABLE_DEFAULT, // false
  /** Legacy sync interval default in minutes (DEF-048, TD §3.2). Meaning preserved; mechanism superseded. */
  syncIntervalMinutes: DEFAULT_SYNC_INTERVAL_MINUTES, // 2
  /** Allowed GST rates as basis points (DEF-024, BR-GST-08, TD §2.1). */
  gstRatesBp: GST_RATES_BP, // 0,25,300,500,1200,1800,2800,4000
  /** Base units (DEF-026, TD §2.1). */
  units: UNITS,
  /** Payment modes (DEF-040, TD §6.1.6). Non-Cash books to Bank. */
  paymentModes: PAYMENT_MODES,
  /** GST rate suggestion boundary: > ₹2500 → 18%, else 5% (BR-GST-18, TD §2.7). Suggestion only. */
  gstSuggestionThresholdPaise: 2500 * 100,
  /** Outstanding threshold: a gap > 50 paise counts as due (BR-DUE-02, BR-MNY-02, TD §6.8). */
  outstandingThresholdPaise: OUTSTANDING_THRESHOLD_PAISE, // 50
  /** Business timezone (BR-DAT-03). */
  timezone: DEFAULT_TIMEZONE, // Asia/Kolkata
  /** Legacy theme values that must migrate cleanly (LC-2.4, TD §2.3). System is the new addition. */
  legacyThemeValues: ['light', 'dark'] as const,
  /** Financial year starts in April (BR-DAT-01, TD §2.7). */
  financialYearStartMonth: 4,
} as const;

/**
 * Migrate a legacy theme value ('light' | 'dark' | anything) to the new ThemeMode. Unknown or
 * missing values become 'system' (the new default, OQ-08). Preserves legacy light/dark exactly.
 */
export function migrateThemeValue(legacy: string | null | undefined): 'light' | 'dark' | 'system' {
  return legacy === 'light' || legacy === 'dark' ? legacy : 'system';
}
