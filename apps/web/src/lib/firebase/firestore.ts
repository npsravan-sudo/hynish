/**
 * Firestore accessor (Phase 1 §35). Repositories (Phase 2+) are the only code that
 * imports this; UI components never touch Firestore directly (ARCHITECTURE §2).
 */
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFirebaseApp } from './app';

let cachedDb: Firestore | null = null;

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getFirebaseApp());
  return cachedDb;
}
