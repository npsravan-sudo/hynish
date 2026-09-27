/**
 * Sales server-core integration against the Firestore emulator (§26, §27, §59, §63). Exercises the
 * real transaction cores (accounting posting gateway, journal voiding, in-transaction numbering,
 * idempotency) with an Admin Firestore instance — the same way numbering.emu.test.ts does.
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { postJournalTx, readPostedJournalsForRef, voidEntries } from '../../functions/src/accounting/post-core.js';
import { reserveNumberInTx } from '../../functions/src/numbering/reserve-core.js';
import { readIdempotentResult, writeIdempotentResult } from '../../functions/src/utils/idempotency.js';
import { journalLinesForInvoice } from '@hynish/domain';

let app: App;
let db: Firestore;
const BIZ = 'biz-sales';

beforeAll(() => {
  process.env.GCLOUD_PROJECT = 'demo-hynish';
  app = initializeApp({ projectId: 'demo-hynish' }, 'sales-test');
  db = getFirestore(app);
});
afterAll(async () => {
  await deleteApp(app);
});
beforeEach(async () => {
  await db.recursiveDelete(db.collection(`businesses/${BIZ}/journalEntries`));
  await db.recursiveDelete(db.collection(`businesses/${BIZ}/counters`));
  await db.recursiveDelete(db.collection(`businesses/${BIZ}/documentNumbers`));
  await db.recursiveDelete(db.collection(`businesses/${BIZ}/idempotency`));
  await db.doc(`businesses/${BIZ}/settings/business`).set({ prefixes: { invoice_gst: 'INV' } });
});

describe('postJournalTx — balance-or-refuse (BR-ACC-01)', () => {
  it('posts a balanced entry and returns its id', async () => {
    const id = await db.runTransaction((tx) =>
      Promise.resolve(postJournalTx(tx, db, {
        businessId: BIZ, date: '2026-04-05', locationId: 'loc1', refType: 'invoice', refId: 'inv1', refLabel: 'INV/1',
        lines: journalLinesForInvoice({ subtotalPaise: 10000, taxPaise: 1800, roundOffPaise: 0, grandTotalPaise: 11800, atBillingPaidPaise: 0 }),
        actorUid: 'u1',
      })),
    );
    expect(id).toBeTruthy();
    const snap = await db.doc(`businesses/${BIZ}/journalEntries/${id}`).get();
    expect(snap.data()?.status).toBe('posted');
    expect(snap.data()?.totalPaise).toBe(11800);
  });

  it('refuses an unbalanced entry and writes nothing', async () => {
    await expect(
      db.runTransaction((tx) =>
        Promise.resolve(postJournalTx(tx, db, {
          businessId: BIZ, date: '2026-04-05', locationId: 'loc1', refType: 'invoice', refId: 'bad', refLabel: 'INV/x',
          lines: [{ accountId: 'acc-ar', debitPaise: 100, creditPaise: 0 }, { accountId: 'acc-sales', debitPaise: 0, creditPaise: 90 }],
          actorUid: 'u1',
        })),
      ),
    ).rejects.toThrow();
    const all = await db.collection(`businesses/${BIZ}/journalEntries`).get();
    expect(all.empty).toBe(true);
  });

  it('returns null (no entry) when all lines are zero (BR-ACC-02)', async () => {
    const id = await db.runTransaction((tx) =>
      Promise.resolve(postJournalTx(tx, db, {
        businessId: BIZ, date: '2026-04-05', locationId: 'loc1', refType: 'invoice_cogs', refId: 'inv1', refLabel: 'INV/1',
        lines: [], actorUid: 'u1',
      })),
    );
    expect(id).toBeNull();
  });
});

describe('void by ref (BR-ACC-05)', () => {
  it('marks posted entries voided; they no longer read as posted', async () => {
    await db.runTransaction((tx) => Promise.resolve(postJournalTx(tx, db, {
      businessId: BIZ, date: '2026-04-05', locationId: 'loc1', refType: 'invoice', refId: 'inv9', refLabel: 'INV/9',
      lines: journalLinesForInvoice({ subtotalPaise: 5000, taxPaise: 0, roundOffPaise: 0, grandTotalPaise: 5000, atBillingPaidPaise: 0 }),
      actorUid: 'u1',
    })));
    await db.runTransaction(async (tx) => {
      const refs = await readPostedJournalsForRef(tx, db, BIZ, 'invoice', 'inv9');
      expect(refs.length).toBe(1);
      voidEntries(tx, refs, 'u1', 'edit');
    });
    const again = await db.runTransaction((tx) => readPostedJournalsForRef(tx, db, BIZ, 'invoice', 'inv9'));
    expect(again.length).toBe(0);
  });
});

describe('numbering is atomic with the rest of the transaction (BR-NUM-11)', () => {
  it('rolls back the counter when the transaction throws after reserving', async () => {
    await expect(
      db.runTransaction(async (tx) => {
        await reserveNumberInTx(tx, db, { businessId: BIZ, seriesKey: 'invoice_gst', dateISO: '2026-04-05', actorUid: 'u1' });
        throw new Error('boom'); // e.g. a later validation failure
      }),
    ).rejects.toThrow('boom');
    const counter = await db.doc(`businesses/${BIZ}/counters/invoice_gst`).get();
    expect(counter.exists).toBe(false); // nothing consumed
  });
});

describe('idempotency (§27)', () => {
  it('returns the stored result on a replay of the same requestId', async () => {
    const first = await db.runTransaction(async (tx) => {
      const cached = await readIdempotentResult<{ n: number }>(tx, db, BIZ, 'req-1');
      if (cached) return cached;
      const out = { n: 42 };
      writeIdempotentResult(tx, db, BIZ, 'req-1', 'test', out, 'u1');
      return out;
    });
    expect(first.n).toBe(42);
    const replay = await db.runTransaction(async (tx) => {
      const cached = await readIdempotentResult<{ n: number }>(tx, db, BIZ, 'req-1');
      return cached ?? { n: -1 };
    });
    expect(replay.n).toBe(42);
  });
});
