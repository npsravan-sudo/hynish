/**
 * Official Indian GST state/UT codes (BR-GST-15, TD §2.1 `GST_STATE_CODES`). These are the
 * canonical, public 2-digit GST state codes — the first two digits of a GSTIN ARE the state code.
 * Used to derive/suggest a customer's or supplier's state from their GSTIN, and by `taxTypeFor`
 * (which compares state CODES). This is reference data, not an invented business rule.
 */
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

/** All selectable states as {code, name}, sorted by name (for dropdowns). */
export const GST_STATES: ReadonlyArray<{ code: string; name: string }> = Object.entries(GST_STATE_CODES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** The GST state code embedded in a GSTIN (its first two digits), or null if not derivable. */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  const g = (gstin ?? '').trim().toUpperCase();
  if (g.length < 2) return null;
  const code = g.slice(0, 2);
  return code in GST_STATE_CODES ? code : null;
}

/** Human-readable state name for a 2-digit code, or '' if unknown/blank. */
export function stateName(code: string | null | undefined): string {
  if (!code) return '';
  return GST_STATE_CODES[code] ?? '';
}

/** Validate a 15-character GSTIN format (BR-RPT-07 readiness check pattern). */
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export function isValidGstin(gstin: string): boolean {
  return GSTIN_RE.test(gstin.trim().toUpperCase());
}
