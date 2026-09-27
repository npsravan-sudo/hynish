/** Pure configuration constants (no side effects, no Admin SDK init) so guards stay unit-testable. */

/** Region co-located with Firestore (asia-south1 recommended, OQ-15). */
export const REGION = 'asia-south1';

/** 5-minute step-up window for sensitive operations (SECURITY-ARCHITECTURE §3). */
export const STEP_UP_MAX_AGE_SECONDS = 5 * 60;

/** 30-day interactive re-auth window (BR-PRM-08). */
export const REAUTH_MAX_AGE_SECONDS = 30 * 24 * 3600;
