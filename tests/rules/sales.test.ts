import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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
  // Seed a quotation and a payment for read-gating tests.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`businesses/${BIZ}/quotations/q1`).set({ businessId: BIZ, locationId: 'loc1', number: 'QUO/1', status: 'open' });
    await db.doc(`businesses/${BIZ}/payments/pay1`).set({ businessId: BIZ, locationId: 'loc1', targetType: 'invoice', targetId: 'invLoc1', amountPaise: 100 });
  });
});

describe('Sales rules — writes are server-authoritative (Phase 5 §57)', () => {
  it('nobody — not even an owner — can write invoices/quotations/payments directly', async () => {
    const db = authed('owner');
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/invoices/x`), { locationId: 'loc1', number: 'INV/x' }));
    await assertFails(updateDoc(doc(db, `businesses/${BIZ}/invoices/invLoc1`), { grandTotalPaise: 1 }));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/quotations/x`), { locationId: 'loc1' }));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/payments/x`), { locationId: 'loc1' }));
  });

  it('nobody can write journal entries, number reservations or idempotency records', async () => {
    const db = authed('owner');
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/journalEntries/x`), { refType: 'invoice' }));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/documentNumbers/INV_2627_0001`), { seq: 1 }));
    await assertFails(setDoc(doc(db, `businesses/${BIZ}/idempotency/req-1`), { result: {} }));
  });
});

describe('Sales rules — reads are permission + location gated (§56/§57)', () => {
  it('a member with sales.view reads invoices at their location', async () => {
    await assertSucceeds(getDoc(doc(authed('shop1'), `businesses/${BIZ}/invoices/invLoc1`)));
  });
  it('quotations require quotations.view; staff (without it) is denied', async () => {
    await assertSucceeds(getDoc(doc(authed('owner'), `businesses/${BIZ}/quotations/q1`)));
    await assertFails(getDoc(doc(authed('staffX'), `businesses/${BIZ}/quotations/q1`)));
  });
  it('payments require dues.view; staff (without it) is denied', async () => {
    await assertSucceeds(getDoc(doc(authed('owner'), `businesses/${BIZ}/payments/pay1`)));
    await assertFails(getDoc(doc(authed('staffX'), `businesses/${BIZ}/payments/pay1`)));
  });
  it('journal entries require accounting.view; shop is denied', async () => {
    await assertSucceeds(getDoc(doc(authed('accountant'), `businesses/${BIZ}/journalEntries/j1`)));
    await assertFails(getDoc(doc(authed('shop1'), `businesses/${BIZ}/journalEntries/j1`)));
  });
});
