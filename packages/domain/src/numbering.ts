/**
 * Document numbering domain abstraction (BR-NUM-01..11, LEGACY-COMPATIBILITY §21).
 *
 * Legacy limitation FIXED: numbers are NEVER issued by client-side per-device counters (KL-01).
 * This module defines the pure formatting/parsing and the CONTRACT for a server-authoritative,
 * transaction-safe numbering service (implemented as a Cloud Function). Six independent series
 * (BR-NUM-01), never combined.
 */
import { DEFAULT_PREFIXES, DEFAULT_INITIAL_SEQ, type SeriesKey } from './constants.js';
import { fyLabel } from './fy.js';

/** Per-series numbering configuration stored in business settings + counters. */
export interface NumberingSeriesConfig {
  seriesKey: SeriesKey;
  prefix: string;
  nextSeq: number;
  /**
   * Whether the sequence resets each financial year. Legacy behavior is NOT VERIFIED (OQ-03);
   * the documented single counter per series implies false. Default false until decided.
   */
  fyScoped: boolean;
}

/** Format a document number as PREFIX/<FY>/<seq padded to 4> (BR-NUM-02), e.g. INV/2627/0001. */
export function formatDocumentNumber(prefix: string, fy: string, seq: number): string {
  return `${prefix}/${fy}/${String(seq).padStart(4, '0')}`;
}

/** Format from a config + the document's date. */
export function formatFromConfig(config: NumberingSeriesConfig, dateISO: string, seq: number): string {
  return formatDocumentNumber(config.prefix, fyLabel(dateISO), seq);
}

export interface ParsedDocumentNumber {
  prefix: string;
  fy: string;
  seq: number;
}

/** Parse a PREFIX/FY/SEQ number. Returns null if it doesn't match the canonical shape. */
export function parseDocumentNumber(value: string): ParsedDocumentNumber | null {
  const m = /^([A-Za-z0-9]+)\/(\d{2,4})\/(\d+)$/.exec(value.trim());
  if (!m) return null;
  const [, prefix, fy, seqStr] = m;
  if (!prefix || !fy || !seqStr) return null;
  return { prefix, fy, seq: Number(seqStr) };
}

/** Fall back to the default prefix/sequence on invalid settings input (BR-NUM-09, DEF-013). */
export function normalizeSeriesConfig(
  seriesKey: SeriesKey,
  prefix: string | undefined,
  nextSeq: number | undefined,
  fyScoped = false,
): NumberingSeriesConfig {
  const cleanPrefix = (prefix ?? '').trim();
  const cleanSeq = Number.isInteger(nextSeq) && (nextSeq as number) > 0 ? (nextSeq as number) : DEFAULT_INITIAL_SEQ;
  return {
    seriesKey,
    prefix: cleanPrefix === '' ? DEFAULT_PREFIXES[seriesKey] : cleanPrefix,
    nextSeq: cleanSeq,
    fyScoped,
  };
}

// ---- Server-authoritative numbering contract (implemented as a Cloud Function) ------------
export interface ReserveNumberRequest {
  businessId: string;
  seriesKey: SeriesKey;
  /** The document's date, used for the FY label (and FY scoping if enabled). */
  dateISO: string;
}
export interface ReserveNumberResult {
  number: string;
  seriesKey: SeriesKey;
  fy: string;
  seq: number;
}

/**
 * Contract for issuing a unique document number. The implementation MUST run inside a Firestore
 * transaction that atomically increments the counter and writes a uniqueness reservation
 * (BR-NUM-05/07), so concurrent users/devices can never collide. Editing never consumes a
 * number (BR-NUM-06); a failed save consumes nothing (BR-NUM-11).
 */
export interface DocumentNumberService {
  reserveNextNumber(request: ReserveNumberRequest): Promise<ReserveNumberResult>;
}
