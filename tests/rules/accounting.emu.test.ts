/**
 * Accounting server-core integration against the Firestore emulator (Phase 7). Exercises
 * postJournalTx's accountIds derivation and the General Ledger's accountIds array-contains
 * query — the same way sales.emu.test.ts exercises the rest of the posting gateway.
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { postJournalTx } from '../../functions/src/accounting/post-core.js';

let app: App;
let db: Firestore;
const BIZ = 'biz-accounting';

beforeAll(() => {
  process.env.GCLOUD_PROJECT = 'demo-hynish';
  app = initializeApp({ projectId: 'demo-hynish' }, 'accounting-test');
  db = getFirestore(app);
});
afterAll(async () => {
  await deleteApp(app);
});
beforeEach(async () => {
  await db.recursiveDelete(db.collection(`businesses/${BIZ}/journalEntries`));
  await db.recursiveDelete(db.collection(`businesses/${BIZ}/idempotency`));
});

describe('postJournalTx — accountIds derivation (BR-ACC underpinning General Ledger + deleteAccount safety)', () => {
  it('stores the distinct set of accountIds referenced by the entry\'s lines', async () => {
    const id = await db.runTransaction((tx) =>
      Promise.resolve(postJournalTx(tx, db, {
        businessId: BIZ, date: '2026-04-05', locationId: 'loc1', refType: 'invoice', refId: 'inv1', refLabel: 'INV/1',
        lines: [
          { accountId: 'acc-cash', debitPaise: 11800, creditPaise: 0 },
          { accountId: 'acc-sales', debitPaise: 0, creditPaise: 10000 },
          { accountId: 'acc-gst-output', debitPaise: 0, creditPaise: 1800 },
        ],
        actorUid: 'u1',
      })),
    );
    const snap = await db.doc(`businesses/${BIZ}/journalEntries/${id}`).get();
    expect(new Set(snap.data()?.accountIds)).toEqual(new Set(['acc-cash', 'acc-sales', 'acc-gst-output']));
  });
});

describe('General Ledger — accountIds array-contains query (BR-ACC-16)', () => {
  it('finds only entries that reference the queried account, chronologically', async () => {
    await db.runTransaction((tx) => Promise.resolve(postJournalTx(tx, db, {
      businessId: BIZ, date: '2026-04-01', locationId: 'loc1', refType: 'invoice', refId: 'inv-a', refLabel: 'INV/A',
      lines: [{ accountId: 'acc-cash', debitPaise: 100, creditPaise: 0 }, { accountId: 'acc-sales', debitPaise: 0, creditPaise: 100 }],
      actorUid: 'u1',
    })));
    await db.runTransaction((tx) => Promise.resolve(postJournalTx(tx, db, {
      businessId: BIZ, date: '2026-04-03', locationId: 'loc1', refType: 'invoice', refId: 'inv-b', refLabel: 'INV/B',
      lines: [{ accountId: 'acc-cash', debitPaise: 200, creditPaise: 0 }, { accountId: 'acc-sales', debitPaise: 0, creditPaise: 200 }],
      actorUid: 'u1',
    })));
    await db.runTransaction((tx) => Promise.resolve(postJournalTx(tx, db, {
      businessId: BIZ, date: '2026-04-02', locationId: 'loc1', refType: 'purchase', refId: 'pur-c', refLabel: 'PUR/C',
      lines: [{ accountId: 'acc-inventory', debitPaise: 50, creditPaise: 0 }, { accountId: 'acc-ap', debitPaise: 0, creditPaise: 50 }],
      actorUid: 'u1',
    })));

    const snap = await db.collection(`businesses/${BIZ}/journalEntries`)
      .where('accountIds', 'array-contains', 'acc-cash')
      .orderBy('date', 'asc')
      .get();

    expect(snap.docs.map((d) => d.data().refId)).toEqual(['inv-a', 'inv-b']);
  });

  it('an account referenced by no entries is safe to delete (no journalEntries hit)', async () => {
    const snap = await db.collection(`businesses/${BIZ}/journalEntries`)
      .where('accountIds', 'array-contains', 'acc-drawings')
      .limit(1)
      .get();
    expect(snap.empty).toBe(true);
  });
});
