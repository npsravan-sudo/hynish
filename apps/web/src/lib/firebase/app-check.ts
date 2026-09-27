/**
 * Firebase App Check (Phase 2 §34, SECURITY-ARCHITECTURE §10). reCAPTCHA Enterprise in
 * production; a debug token in development only. Debug tokens are read from env and NEVER
 * hard-coded, so production builds cannot ship one.
 */
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';
import { getFirebaseApp } from './app';
import { appConfig } from '@/config/env';

let cached: AppCheck | null = null;

declare global {
  var FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean | undefined;
}

/** Initialize App Check when a site key is configured. Safe no-op otherwise (e.g. emulators). */
export function initAppCheck(): AppCheck | null {
  if (cached) return cached;
  if (appConfig.useEmulators) return null; // App Check is bypassed against local emulators
  if (!appConfig.appCheckSiteKey) return null;

  if (import.meta.env.DEV && appConfig.appCheckDebugToken) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = appConfig.appCheckDebugToken;
  }

  cached = initializeAppCheck(getFirebaseApp(), {
    provider: new ReCaptchaEnterpriseProvider(appConfig.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return cached;
}
