/**
 * Firestore accessor (Phase 2). Repositories are the only code that imports this; UI
 * components never touch Firestore directly (ARCHITECTURE §2). Emulator wiring for development.
 */
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getFirebaseApp } from './app';
import { appConfig } from '@/config/env';

let cachedDb: Firestore | null = null;

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  const db = getFirestore(getFirebaseApp());
  if (appConfig.useEmulators) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  cachedDb = db;
  return cachedDb;
}
