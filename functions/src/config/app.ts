import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/** Initialize the Admin SDK once per instance. */
if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
export const adminAuth = getAuth();

export { REGION, STEP_UP_MAX_AGE_SECONDS, REAUTH_MAX_AGE_SECONDS } from './constants.js';
