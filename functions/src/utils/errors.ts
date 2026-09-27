import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';

/**
 * Stable error codes returned to the client via HttpsError.details.code (ARCHITECTURE §13).
 * The client maps these to friendly messages; raw internals are never leaked.
 */
export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'REAUTH_REQUIRED'
  | 'STEP_UP_REQUIRED'
  | 'NOT_A_MEMBER'
  | 'MEMBER_INACTIVE'
  | 'PERMISSION_DENIED'
  | 'LOCATION_DENIED'
  | 'OWNER_PROTECTED'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  // Confirmation-required (warnings, not hard blocks): the client re-submits with an acknowledgement.
  | 'PAST_MONTH_EDIT'
  | 'OVER_PAYMENT'
  | 'INTERNAL';

const CODE_TO_HTTPS: Record<AppErrorCode, FunctionsErrorCode> = {
  UNAUTHENTICATED: 'unauthenticated',
  REAUTH_REQUIRED: 'unauthenticated',
  STEP_UP_REQUIRED: 'unauthenticated',
  NOT_A_MEMBER: 'permission-denied',
  MEMBER_INACTIVE: 'permission-denied',
  PERMISSION_DENIED: 'permission-denied',
  LOCATION_DENIED: 'permission-denied',
  OWNER_PROTECTED: 'permission-denied',
  VALIDATION_FAILED: 'invalid-argument',
  NOT_FOUND: 'not-found',
  CONFLICT: 'aborted',
  PAST_MONTH_EDIT: 'failed-precondition',
  OVER_PAYMENT: 'failed-precondition',
  INTERNAL: 'internal',
};

export function appError(code: AppErrorCode, message: string, extra?: Record<string, unknown>): HttpsError {
  return new HttpsError(CODE_TO_HTTPS[code], message, { code, ...extra });
}
