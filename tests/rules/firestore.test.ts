import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { makeTestEnv, seed, freshToken, staleToken, BIZ, OTHER_BIZ } from './helpers.js';

let env: RulesTestEnvironment;

const authed = (uid: string, token = freshToken()) => env.authenticatedContext(uid, token).firestore();
const unauthed = () => env.unauthenticatedContext().firestore();

beforeAll(async () => {
  env = await makeTestEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
});

describe('Firestore rules — authentication & isolation (§40)', () => {
  it('denies all reads/writes to unauthenticated users', async () => {
    await assertFails(getDoc(doc(unauthed(), `businesses/${BIZ}/products/p1`)));
    await assertFails(setDoc(doc(unauthed(), `businesses/${BIZ}/products/p2`), { name: 'x' }));
  });

  it('denies a member of business B from reading business A data', async () => {
    const db = authed('outsider'); // member of OTHER_BIZ only
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/products/p1`)));
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/invoices/invLoc1`)));
  });

  it('denies a signed-in non-member', async () => {
    const db = authed('ghost');
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/products/p1`)));
  });

  it('denies an inactive member', async () => {
    const db = authed('inactive');
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/products/p1`)));
  });

  it('denies a stale (expired reauth) session', async () => {
    const db = authed('owner', staleToken());
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/products/p1`)));
  });
});

describe('Firestore rules — permissions by role (§40, §60)', () => {
  it('shop can read products but not accounting', async () => {
    const db = authed('shop1');
    await assertSucceeds(getDoc(doc(db, `businesses/${BIZ}/products/p1`)));
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/journalEntries/j1`)));
  });

  it('accountant can read accounting but not create-only areas it lacks', async () => {
    const db = authed('accountant');
    await assertSucceeds(getDoc(doc(db, `businesses/${BIZ}/journalEntries/j1`)));
    await assertSucceeds(getDoc(doc(db, `businesses/${BIZ}/products/p1`)));
  });

  it('staff cannot read accounting', async () => {
    const db = authed('staffX');
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/journalEntries/j1`)));
  });

  it('owner/admin can read everything in their business', async () => {
    await assertSucceeds(getDoc(doc(authed('owner'), `businesses/${BIZ}/journalEntries/j1`)));
    await assertSucceeds(getDoc(doc(authed('admin'), `businesses/${BIZ}/counters/invoice_gst`)));
  });

  it('shop cannot read the numbering counters (settings.manage only)', async () => {
    await assertFails(getDoc(doc(authed('shop1'), `businesses/${BIZ}/counters/invoice_gst`)));
  });
});

describe('Firestore rules — location authorization (§26, §40)', () => {
  it('a location-restricted member reads only their location', async () => {
    const db = authed('shop1'); // restricted to loc1
    await assertSucceeds(getDoc(doc(db, `businesses/${BIZ}/invoices/invLoc1`)));
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/invoices/invLoc2`)));
  });

  it('an unrestricted member (admin) reads any location', async () => {
    const db = authed('admin');
    await assertSucceeds(getDoc(doc(db, `businesses/${BIZ}/invoices/invLoc1`)));
    await assertSucceeds(getDoc(doc(db, `businesses/${BIZ}/invoices/invLoc2`)));
  });

  it('a restricted member reads stock movements only at their location', async () => {
    const db = authed('shop1'); // restricted to loc1
    await assertSucceeds(getDoc(doc(db, `businesses/${BIZ}/stockMovements/m1`))); // m1 @ loc1
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/stockMovements/m2`))); // m2 @ loc2
  });
});

describe('Firestore rules — membership document protection (§29, §30)', () => {
  it('a member may read their own membership', async () => {
    await assertSucceeds(getDoc(doc(authed('shop1'), `businesses/${BIZ}/members/shop1`)));
  });

  it('a non-admin cannot read another member', async () => {
    await assertFails(getDoc(doc(authed('shop1'), `businesses/${BIZ}/members/owner`)));
  });

  it('an admin can read another member', async () => {
    await assertSucceeds(getDoc(doc(authed('owner'), `businesses/${BIZ}/members/shop1`)));
  });

  it('NOBODY can write a member document directly — even an admin (server-only)', async () => {
    await assertFails(setDoc(doc(authed('owner'), `businesses/${BIZ}/members/newuser`), { role: 'staff', active: true, locationIds: null }));
    await assertFails(updateDoc(doc(authed('owner'), `businesses/${BIZ}/members/shop1`), { role: 'admin' }));
    // A member cannot escalate their own role.
    await assertFails(updateDoc(doc(authed('shop1'), `businesses/${BIZ}/members/shop1`), { role: 'owner' }));
  });
});

describe('Firestore rules — settings & server-only writes', () => {
  it('members read business settings but cannot write them', async () => {
    await assertSucceeds(getDoc(doc(authed('shop1'), `businesses/${BIZ}/settings/business`)));
    await assertFails(setDoc(doc(authed('owner'), `businesses/${BIZ}/settings/business`), { businessName: 'hacked' }));
  });

  it('nobody can write invoices/stock/journal directly (Cloud Functions only)', async () => {
    await assertFails(setDoc(doc(authed('owner'), `businesses/${BIZ}/invoices/x`), { locationId: 'loc1' }));
    await assertFails(setDoc(doc(authed('owner'), `businesses/${BIZ}/stockMovements/x`), { locationId: 'loc1' }));
    await assertFails(setDoc(doc(authed('owner'), `businesses/${BIZ}/journalEntries/x`), { refType: 'invoice' }));
  });
});

describe('Firestore rules — cross-business isolation on the members path (§13)', () => {
  it('a member of A cannot read members of B', async () => {
    await assertFails(getDoc(doc(authed('owner'), `businesses/${OTHER_BIZ}/members/outsider`)));
  });
});
