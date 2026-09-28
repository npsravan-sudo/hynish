import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { makeTestEnv, seed, freshToken, BIZ } from './helpers.js';

let env: RulesTestEnvironment;
const authed = (uid: string) => env.authenticatedContext(uid, freshToken()).firestore();

beforeAll(async () => { env = await makeTestEnv(); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`businesses/${BIZ}/stockLevels/p1_default_loc1`).set({ businessId: BIZ, productId: 'p1', variantId: 'default', locationId: 'loc1', qty: 7 });
    await db.doc(`businesses/${BIZ}/stockMovements/mv1`).set({ businessId: BIZ, productId: 'p1', variantId: 'default', locationId: 'loc1', type: 'purchase', qtyChange: 7, qtyAfter: 7 });
    await db.doc(`businesses/${BIZ}/purchases/pur1`).set({ businessId: BIZ, locationId: 'loc1', supplierId: 's1', totalPaise: 1000 });
  });
});

describe('Inventory rules — stock is server-authoritative (Phase 6 §53)', () => {
  it('nobody — not even an owner — can write stock levels or movements directly', async () => {
    const db = authed('owner');
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/stockLevels/x`), { qty: 999, locationId: 'loc1' }));
    await assertFails(updateDoc(doc(db, `businesses/${BIZ}/stockLevels/p1_default_loc1`), { qty: 999 }));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/stockMovements/x`), { qtyChange: 1, locationId: 'loc1' }));
  });

  it('nobody can write purchases, stock transfers or stock counts directly', async () => {
    const db = authed('owner');
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/purchases/x`), { locationId: 'loc1' }));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/stockTransfers/x`), { fromLocationId: 'loc1', toLocationId: 'loc2' }));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/stockCounts/x`), { locationId: 'loc1' }));
  });
});

describe('Inventory rules — reads are permission + location gated (§24, §61)', () => {
  it('a member with stock.view reads levels/movements at their location', async () => {
    await assertSucceeds(getDoc(doc(authed('shop1'), `businesses/${BIZ}/stockLevels/p1_default_loc1`)));
    await assertSucceeds(getDoc(doc(authed('shop1'), `businesses/${BIZ}/stockMovements/mv1`)));
  });
  it('purchases require purchases.view; staff (without it) is denied', async () => {
    await assertSucceeds(getDoc(doc(authed('accountant'), `businesses/${BIZ}/purchases/pur1`)));
    await assertFails(getDoc(doc(authed('staffX'), `businesses/${BIZ}/purchases/pur1`)));
  });
});
