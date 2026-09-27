/**
 * Auth service accessor (Phase 2 §7, §10). Local persistence (legacy parity: sessions survive
 * restarts until the 30-day re-auth window, ARCHITECTURE §9). Emulator wiring for development.
 */
import {
  getAuth,
  browserLocalPersistence,
  connectAuthEmulator,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirebaseApp } from './app';
import { appConfig } from '@/config/env';

let cachedAuth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const auth = getAuth(getFirebaseApp());
  void setPersistence(auth, browserLocalPersistence);
  if (appConfig.useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  cachedAuth = auth;
  return cachedAuth;
}
