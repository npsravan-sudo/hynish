/**
 * Cloud Storage accessor (Phase 2). Product photos and the business logo (LEGACY-COMPATIBILITY
 * §47). Emulator wiring for development.
 */
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFirebaseApp } from './app';
import { appConfig } from '@/config/env';

let cachedStorage: FirebaseStorage | null = null;

export function getFirebaseStorage(): FirebaseStorage {
  if (cachedStorage) return cachedStorage;
  const storage = getStorage(getFirebaseApp());
  if (appConfig.useEmulators) {
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
  cachedStorage = storage;
  return cachedStorage;
}
