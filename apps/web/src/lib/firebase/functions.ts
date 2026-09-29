/**
 * Callable Cloud Functions accessor (Phase 2 §22, §53). Business-critical operations are
 * performed via authenticated callables, never direct client writes. Region matches the
 * functions deployment (asia-south1, OQ-15).
 */
import { getFunctions, connectFunctionsEmulator, httpsCallable, type Functions } from 'firebase/functions';
import { getFirebaseApp } from './app';
import { appConfig } from '@/config/env';

const REGION = 'asia-south1';
let cached: Functions | null = null;

export function getFirebaseFunctions(): Functions {
  if (cached) return cached;
  const functions = getFunctions(getFirebaseApp(), REGION);
  if (appConfig.useEmulators) {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
  cached = functions;
  return cached;
}

/**
 * Typed wrapper around a callable. Resolution of the Functions instance is deferred to the first
 * invocation (not module load) so importing a service module never requires Firebase to be
 * configured — only actually calling one of its functions does.
 */
export function callable<TInput, TOutput>(name: string) {
  return async (data: TInput): Promise<TOutput> =>
    (await httpsCallable<TInput, TOutput>(getFirebaseFunctions(), name)(data)).data;
}
