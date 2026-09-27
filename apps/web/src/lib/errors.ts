/**
 * Friendly error mapping for Cloud Function callables and repository failures (Phase 4 §40).
 * Never surfaces raw internals. Reads the stable `details.code` set by the server (ARCHITECTURE
 * §13) and falls back to a safe default.
 */
const CODE_MESSAGES: Record<string, string> = {
  VALIDATION_FAILED: 'Please check the highlighted fields and try again.',
  PERMISSION_DENIED: "You don't have permission to do that.",
  LOCATION_DENIED: "You aren't authorized for this location.",
  NOT_A_MEMBER: "You aren't a member of this business.",
  MEMBER_INACTIVE: 'Your account is inactive. Please contact your administrator.',
  REAUTH_REQUIRED: 'Your sign-in has expired. Please sign in again.',
  STEP_UP_REQUIRED: 'Please re-enter your password to continue.',
  OWNER_PROTECTED: 'Only the owner can manage owner-level accounts.',
  CONFLICT: 'That conflicts with existing data. Please review and retry.',
  NOT_FOUND: 'That record was not found. It may have been removed.',
  INTERNAL: 'Something went wrong. Please try again.',
};

function detailsCode(err: unknown): string | null {
  if (typeof err === 'object' && err !== null) {
    const details = (err as { details?: unknown }).details;
    if (typeof details === 'object' && details !== null && 'code' in details) {
      const code = (details as { code?: unknown }).code;
      if (typeof code === 'string') return code;
    }
    // Firebase permission-denied on a direct read
    const code = (err as { code?: unknown }).code;
    if (code === 'permission-denied') return 'PERMISSION_DENIED';
    if (code === 'not-found') return 'NOT_FOUND';
  }
  return null;
}

export function mapCallableError(err: unknown): string {
  const code = detailsCode(err);
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  return CODE_MESSAGES.INTERNAL!;
}
