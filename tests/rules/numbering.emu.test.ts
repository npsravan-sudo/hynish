/**
 * Server-authoritative numbering: concurrency safety (§16, §44, KL-01 fix). Runs the real
 * transaction core against the Firestore emulator with many concurrent reservations and asserts
 * every issued number is unique and sequential — exactly what the legacy per-device counters
 * could NOT guarantee.
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { reserveNumber } from '../../functions/src/numbering/reserve-core.js';

let app: App;
let db: Firestore;
const BIZ = 'biz-num';

beforeAll(() => {
  process.env.GCLOUD_PROJECT = 'demo-hynish';
  app = initializeApp({ projectId: 'demo-hynish' }, 'numbering-test');
  db = getFirestore(app);
});
afterAll(async () => {
  await deleteApp(app);
});
beforeEach(async () => {
  // Clear the counter and any reservations from a previous run.
  await db.recursiveDelete(db.collection(`businesses/${BIZ}/counters`));
  await db.recursiveDelete(db.collection(`businesses/${BIZ}/documentNumbers`));
  await db.doc(`businesses/${BIZ}/settings/business`).set({ prefixes: { invoice_gst: 'INV' } });
});

describe('reserveNumber — atomic, collision-free', () => {
  it('issues sequential, unique numbers under 20 concurrent requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        reserveNumber(db, { businessId: BIZ, seriesKey: 'invoice_gst', dateISO: '2026-04-05', actorUid: 'u1' }),
      ),
    );
    const numbers = results.map((r) => r.number);
    const unique = new Set(numbers);
    expect(unique.size).toBe(20); // no collisions
    const seqs = results.map((r) => r.seq).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => i + 1)); // 1..20
    expect(numbers).toContain('INV/2627/0001');
    expect(numbers).toContain('INV/2627/0020');

    const counter = (await db.doc(`businesses/${BIZ}/counters/invoice_gst`).get()).data();
    expect(counter?.nextSeq).toBe(21);
  });

  it('keeps GST and Non-GST series independent (BR-NUM-01/04)', async () => {
    const gst = await reserveNumber(db, { businessId: BIZ, seriesKey: 'invoice_gst', dateISO: '2026-04-05', actorUid: 'u1' });
    const nogst = await reserveNumber(db, { businessId: BIZ, seriesKey: 'invoice_nogst', dateISO: '2026-04-05', actorUid: 'u1' });
    expect(gst.number.startsWith('INV/')).toBe(true);
    expect(nogst.number.startsWith('NGST/')).toBe(true);
    expect(gst.seq).toBe(1);
    expect(nogst.seq).toBe(1); // independent counters
  });
});
