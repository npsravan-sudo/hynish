import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const projectId = 'demo-hynish';
const nowSeconds = Math.floor(Date.now() / 1000);

function hostPort(envVar: string, fallbackPort: number): { host: string; port: number } {
  const raw = process.env[envVar];
  if (raw) {
    const [host, port] = raw.replace(/^https?:\/\//, '').split(':');
    return { host: host || '127.0.0.1', port: Number(port) || fallbackPort };
  }
  return { host: '127.0.0.1', port: fallbackPort };
}

export async function makeTestEnv(): Promise<RulesTestEnvironment> {
  const firestoreRules = readFileSync(
    fileURLToPath(new URL('../../firestore.rules', import.meta.url)),
    'utf8',
  );
  const storageRules = readFileSync(
    fileURLToPath(new URL('../../storage.rules', import.meta.url)),
    'utf8',
  );
  const fs = hostPort('FIRESTORE_EMULATOR_HOST', 8080);
  const st = hostPort('FIREBASE_STORAGE_EMULATOR_HOST', 9199);

  return initializeTestEnvironment({
    projectId,
    firestore: { rules: firestoreRules, host: fs.host, port: fs.port },
    storage: { rules: storageRules, host: st.host, port: st.port },
  });
}

/** A fresh (reauth-valid) token. Rules require request.auth.token.auth_time within 30 days. */
export function freshToken(extra: Record<string, unknown> = {}) {
  return { auth_time: nowSeconds, email: 'user@example.com', ...extra };
}

/** A stale token (> 30 days) to exercise the reauth window. */
export function staleToken() {
  return { auth_time: nowSeconds - 31 * 24 * 3600, email: 'user@example.com' };
}

export const BIZ = 'bizA';
export const OTHER_BIZ = 'bizB';

/** Seed members and representative documents with rules disabled. */
export async function seed(env: RulesTestEnvironment): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Members of bizA
    await db.doc(`businesses/${BIZ}/members/owner`).set({ role: 'owner', active: true, locationIds: null });
    await db.doc(`businesses/${BIZ}/members/admin`).set({ role: 'admin', active: true, locationIds: null });
    await db.doc(`businesses/${BIZ}/members/accountant`).set({ role: 'accountant', active: true, locationIds: null });
    await db.doc(`businesses/${BIZ}/members/shop1`).set({ role: 'shop', active: true, locationIds: ['loc1'] });
    await db.doc(`businesses/${BIZ}/members/staffX`).set({ role: 'staff', active: true, locationIds: null });
    await db.doc(`businesses/${BIZ}/members/inactive`).set({ role: 'shop', active: false, locationIds: null });
    // A member of a different business (for isolation tests)
    await db.doc(`businesses/${OTHER_BIZ}/members/outsider`).set({ role: 'owner', active: true, locationIds: null });

    // Business docs
    await db.doc(`businesses/${BIZ}`).set({ id: BIZ, name: 'Biz A' });
    await db.doc(`businesses/${BIZ}/settings/business`).set({ businessName: 'Biz A' });
    await db.doc(`businesses/${BIZ}/locations/loc1`).set({ name: 'Shop 1', type: 'shop', sortOrder: 0 });
    await db.doc(`businesses/${BIZ}/products/p1`).set({ name: 'Shirt', businessId: BIZ });
    await db.doc(`businesses/${BIZ}/invoices/invLoc1`).set({ businessId: BIZ, locationId: 'loc1', number: 'INV/1' });
    await db.doc(`businesses/${BIZ}/invoices/invLoc2`).set({ businessId: BIZ, locationId: 'loc2', number: 'INV/2' });
    await db.doc(`businesses/${BIZ}/journalEntries/j1`).set({ businessId: BIZ, refType: 'invoice' });
    await db.doc(`businesses/${BIZ}/counters/invoice_gst`).set({ nextSeq: 1 });
    await db.doc(`businesses/${BIZ}/stockMovements/m1`).set({ businessId: BIZ, locationId: 'loc1', type: 'sale' });
    await db.doc(`businesses/${BIZ}/stockMovements/m2`).set({ businessId: BIZ, locationId: 'loc2', type: 'sale' });
  });
}
