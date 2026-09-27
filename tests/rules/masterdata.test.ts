import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { makeTestEnv, seed, freshToken, BIZ } from './helpers.js';

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
});

describe('Master-data rules — writes are server-authoritative (Phase 4 §5)', () => {
  it('nobody — not even an owner — can create/update/delete products directly', async () => {
    const db = authed('owner');
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/products/new`), { name: 'X', businessId: BIZ }));
    await assertFails(updateDoc(doc(db, `businesses/${BIZ}/products/p1`), { name: 'Hacked' }));
    await assertFails(deleteDoc(doc(db, `businesses/${BIZ}/products/p1`)));
  });

  it('nobody can write customers/suppliers directly', async () => {
    const db = authed('owner');
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/customers/c1`), { name: 'X', businessId: BIZ }));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/suppliers/s1`), { name: 'X', businessId: BIZ }));
  });

  it('nobody can write locations directly (even owner/admin who may manage them via callable)', async () => {
    await assertFails(setDoc(doc(authed('owner'), `businesses/${BIZ}/locations/loc9`), { name: 'X', type: 'shop' }));
    await assertFails(updateDoc(doc(authed('admin'), `businesses/${BIZ}/locations/loc1`), { name: 'Renamed' }));
  });

  it('nobody can write the barcode uniqueness index directly', async () => {
    await assertFails(setDoc(doc(authed('owner'), `businesses/${BIZ}/barcodes/ABC123`), { productId: 'p1', barcode: 'ABC123' }));
  });
});

describe('Master-data rules — reads are permission-gated (Phase 4 §5)', () => {
  it('a member with products.view reads products; a member without suppliers.view cannot read suppliers', async () => {
    await assertSucceeds(getDoc(doc(authed('shop1'), `businesses/${BIZ}/products/p1`)));
    // staff has no suppliers.view
    await assertFails(getDoc(doc(authed('staffX'), `businesses/${BIZ}/suppliers/anyId`)));
  });

  it('any member may read locations (to switch/view)', async () => {
    await assertSucceeds(getDoc(doc(authed('shop1'), `businesses/${BIZ}/locations/loc1`)));
    await assertSucceeds(getDoc(doc(authed('staffX'), `businesses/${BIZ}/locations/loc1`)));
  });

  it('the barcode index is readable with products.view but not by a member lacking it', async () => {
    await assertSucceeds(getDoc(doc(authed('shop1'), `businesses/${BIZ}/barcodes/ABC123`)));
  });
});
