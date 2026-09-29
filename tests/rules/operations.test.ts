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
    await db.doc(`businesses/${BIZ}/expenses/e1`).set({ businessId: BIZ, locationId: 'loc1', categoryId: 'exp-cat-rent', amountPaise: 50000 });
    await db.doc(`businesses/${BIZ}/deliveryNotes/dn1`).set({ businessId: BIZ, locationId: 'loc1', number: 'DN/1', status: 'pending' });
    await db.doc(`businesses/${BIZ}/creditNotes/cn1`).set({ businessId: BIZ, locationId: 'loc1', invoiceId: 'invLoc1', number: 'CN/1' });
    await db.doc(`businesses/${BIZ}/debitNotes/dbn1`).set({ businessId: BIZ, locationId: 'loc1', purchaseId: 'pur1', number: 'DBN/1' });
  });
});

describe('Business Operations rules — writes are server-authoritative (Phase 8)', () => {
  it('nobody — not even an owner — can write expenses, delivery notes, credit notes or debit notes directly', async () => {
    const db = authed('owner');
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/expenses/x`), { locationId: 'loc1', amountPaise: 1 }));
    await assertFails(updateDoc(doc(db, `businesses/${BIZ}/expenses/e1`), { amountPaise: 999999 }));
    await assertFails(deleteDoc(doc(db, `businesses/${BIZ}/expenses/e1`)));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/deliveryNotes/x`), { locationId: 'loc1' }));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/creditNotes/x`), { locationId: 'loc1' }));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/debitNotes/x`), { locationId: 'loc1' }));
  });
});

describe('Business Operations rules — reads are permission + location gated (§56/§57)', () => {
  it('expenses require expenses.view; shop (without it) is denied', async () => {
    await assertSucceeds(getDoc(doc(authed('accountant'), `businesses/${BIZ}/expenses/e1`)));
    await assertFails(getDoc(doc(authed('shop1'), `businesses/${BIZ}/expenses/e1`)));
  });
  it('delivery notes require deliveryNotes.view; staff (without it) is denied', async () => {
    await assertSucceeds(getDoc(doc(authed('shop1'), `businesses/${BIZ}/deliveryNotes/dn1`)));
    await assertFails(getDoc(doc(authed('staffX'), `businesses/${BIZ}/deliveryNotes/dn1`)));
  });
  it('credit notes require sales.view (held by every active role here); an inactive member is denied', async () => {
    await assertSucceeds(getDoc(doc(authed('owner'), `businesses/${BIZ}/creditNotes/cn1`)));
    await assertSucceeds(getDoc(doc(authed('shop1'), `businesses/${BIZ}/creditNotes/cn1`)));
    await assertFails(getDoc(doc(authed('inactive'), `businesses/${BIZ}/creditNotes/cn1`)));
  });
  it('debit notes require purchases.view; staff (without it) is denied', async () => {
    await assertSucceeds(getDoc(doc(authed('owner'), `businesses/${BIZ}/debitNotes/dbn1`)));
    await assertFails(getDoc(doc(authed('staffX'), `businesses/${BIZ}/debitNotes/dbn1`)));
  });
});

describe('Business Operations rules — cross-business isolation (§57)', () => {
  it('a member of another business cannot read this business\'s expenses/delivery notes/credit notes/debit notes', async () => {
    const db = authed('outsider');
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/expenses/e1`)));
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/deliveryNotes/dn1`)));
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/creditNotes/cn1`)));
    await assertFails(getDoc(doc(db, `businesses/${BIZ}/debitNotes/dbn1`)));
  });

  it('an outsider cannot write into this business\'s operations collections either', async () => {
    const db = authed('outsider');
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/expenses/x`), { locationId: 'loc1', amountPaise: 1 }));
    await assertFails(setDoc(doc(db, `businesses/${OTHER_BIZ}/expenses/x`), { locationId: 'loc1', amountPaise: 1 }));
  });
});
