/**
 * Firebase app initialization (Phase 1 §35). Lazy and idempotent: nothing initializes
 * until a service is first requested, and the app never crashes at import time when
 * Firebase is unconfigured (isFirebaseConfigured stays false and the UI shows a config error).
 * Phase 2 wires real auth/membership; this phase only prepares the layer.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirebaseConfig, isFirebaseConfigured } from '@/config/env';

let cachedApp: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  const existing = getApps();
  cachedApp = existing[0] ?? initializeApp(getFirebaseConfig());
  return cachedApp;
}

export { isFirebaseConfigured };
