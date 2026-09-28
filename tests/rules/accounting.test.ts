import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { makeTestEnv, seed, freshToken, BIZ, OTHER_BIZ } from './helpers.js';

let env: RulesTestEnvironment;
const authed = (uid: string) => env.authenticatedContext(uid, freshToken()).firestore();

beforeAll(async () => {
  env = await makeTestEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`businesses/${BIZ}/accounts/acc-cash`).set({ businessId: BIZ, code: 1000, name: 'Cash in Hand', type: 'asset', isSystem: true });
    await db.doc(`businesses/${BIZ}/cashEntries/c1`).set({ businessId: BIZ, locationId: 'loc1', type: 'in', amountPaise: 1000 });
    await db.doc(`businesses/${BIZ}/cashEntries/c2`).set({ businessId: BIZ, locationId: 'loc2', type: 'out', amountPaise: 500 });
    // A cashbook.view-holding member scoped to loc1 only, to isolate the location-gating check
    // from the permission check (shop1 in helpers.seed() lacks cashbook.view entirely).
    await db.doc(`businesses/${BIZ}/members/accountantLoc1`).set({ role: 'accountant', active: true, locationIds: ['loc1'] });
  });
});

describe('Accounting rules — writes are server-authoritative (Phase 7)', () => {
  it('nobody — not even an owner — can write accounts or cash entries directly', async () => {
    const db = authed('owner');
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/accounts/x`), { name: 'Fake', type: 'asset' }));
    await assertFails(updateDoc(doc(db, `businesses/${BIZ}/accounts/acc-cash`), { code: 9999 }));
    await assertFails(deleteDoc(doc(db, `businesses/${BIZ}/accounts/acc-cash`)));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/cashEntries/x`), { locationId: 'loc1', amountPaise: 1 }));
  });
});

describe('Accounting rules — reads are permission + location gated (§56/§57)', () => {
  it('accounts require accounting.view; shop (without it) is denied', async () => {
    await assertSucceeds(getDoc(doc(authed('accountant'), `businesses/${BIZ}/accounts/acc-cash`)));
    await assertFails(getDoc(doc(authed('shop1'), `businesses/${BIZ}/accounts/acc-cash`)));
  });

  it('cash entries require cashbook.view; shop (without it) is denied regardless of location', async () => {
    await assertSucceeds(getDoc(doc(authed('owner'), `businesses/${BIZ}/cashEntries/c1`)));
    await assertFails(getDoc(doc(authed('shop1'), `businesses/${BIZ}/cashEntries/c1`)));
  });

  it('cash entries are further gated by location — a cashbook.view member scoped to loc1 cannot read loc2 entries', async () => {
    await assertSucceeds(getDoc(doc(authed('accountantLoc1'), `businesses/${BIZ}/cashEntries/c1`)));
    await assertFails(getDoc(doc(authed('accountantLoc1'), `businesses/${BIZ}/cashEntries/c2`)));
  });
});

describe('Accounting rules — cross-business isolation (§57)', () => {
  it('a member of another business cannot read this business\'s accounts, journal entries or cash entries', async () => {
    const db = authed('outsider');
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/accounts/acc-cash`)));
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/journalEntries/j1`)));
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/cashEntries/c1`)));
  });

  it('an outsider cannot write into this business\'s accounting collections either', async () => {
    const db = authed('outsider');
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/accounts/x`), { name: 'Fake', type: 'asset' }));
    await assertFails(setDoc(doc(db, `businesses/${OTHER_BIZ}/accounts/x`), { name: 'Fake', type: 'asset' }));
  });
});
