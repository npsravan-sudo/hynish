/**
 * Cloud Storage accessor (Phase 1 §35). Used for product photos and the business logo
 * in later phases (LEGACY-COMPATIBILITY §47).
 */
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFirebaseApp } from './app';

let cachedStorage: FirebaseStorage | null = null;

export function getFirebaseStorage(): FirebaseStorage {
  if (cachedStorage) return cachedStorage;
  cachedStorage = getStorage(getFirebaseApp());
  return cachedStorage;
}
