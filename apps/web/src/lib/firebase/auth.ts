/**
 * Auth service accessor (Phase 1 §35). Returns the Firebase Auth instance with
 * local persistence (legacy parity: sessions survive restarts until the 30-day
 * re-auth window, ARCHITECTURE §9). No sign-in logic here — Phase 2 implements it.
 */
import { getAuth, browserLocalPersistence, setPersistence, type Auth } from 'firebase/auth';
import { getFirebaseApp } from './app';
import { appConfig } from '@/config/env';

let cachedAuth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const auth = getAuth(getFirebaseApp());
  void setPersistence(auth, browserLocalPersistence);
  if (appConfig.useEmulators) {
    // Emulator wiring is deferred to the auth phase; import kept lazy to avoid bundling in prod.
  }
  cachedAuth = auth;
  return cachedAuth;
}
