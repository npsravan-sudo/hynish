/**
 * Typed, validated public configuration (Phase 1 §37). Missing required Firebase config
 * produces a clear, actionable error instead of cryptic `undefined` failures later.
 */
import { z } from 'zod';

const rawEnvSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().optional(),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  VITE_FIREBASE_PROJECT_ID: z.string().optional(),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  VITE_FIREBASE_APP_ID: z.string().optional(),
  VITE_APPCHECK_SITE_KEY: z.string().optional(),
  VITE_USE_FIREBASE_EMULATORS: z.string().optional(),
});

const parsed = rawEnvSchema.parse(import.meta.env);

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const firebaseFields = {
  apiKey: parsed.VITE_FIREBASE_API_KEY,
  authDomain: parsed.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: parsed.VITE_FIREBASE_PROJECT_ID,
  storageBucket: parsed.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: parsed.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: parsed.VITE_FIREBASE_APP_ID,
};

/** True only when every required Firebase field is present. */
export const isFirebaseConfigured: boolean = Object.values(firebaseFields).every(
  (v) => typeof v === 'string' && v.length > 0,
);

export function getFirebaseConfig(): FirebaseConfig {
  if (!isFirebaseConfigured) {
    const missing = Object.entries(firebaseFields)
      .filter(([, v]) => !v)
      .map(([k]) => `VITE_FIREBASE_${k.replace(/[A-Z]/g, (m) => `_${m}`).toUpperCase()}`);
    throw new Error(
      `Firebase is not configured. Missing: ${missing.join(', ')}. ` +
        `Copy apps/web/.env.example to .env.local and fill in your project's values.`,
    );
  }
  return firebaseFields as FirebaseConfig;
}

export const appConfig = {
  appName: 'Hynish ERP',
  fullName: 'Hynish Clothing — Wholesale Ledger',
  version: '0.1.0',
  appCheckSiteKey: parsed.VITE_APPCHECK_SITE_KEY ?? '',
  useEmulators: parsed.VITE_USE_FIREBASE_EMULATORS === 'true',
} as const;
