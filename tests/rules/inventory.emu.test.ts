/**
 * Inventory stock core integration against the Firestore emulator (§4, §16, §18, §55, §57, §58).
 * Exercises the real applyMovementTx / readLevelTx cores with an Admin Firestore instance: the
 * movement ledger and the derived level move together, negative stock is refused without an override,
 * and a failed transaction leaves NO partial write.
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { applyMovementTx, readLevelTx, stockLevelId } from '../../functions/src/inventory/stock-core.js';

let app: App;
let db: Firestore;
const BIZ = 'biz-inv';
const P = 'p1', V = 'default', L = 'loc1';

beforeAll(() => {
  process.env.GCLOUD_PROJECT = 'demo-hynish';
  app = initializeApp({ projectId: 'demo-hynish' }, 'inventory-test');
  db = getFirestore(app);
});
afterAll(async () => { await deleteApp(app); });
beforeEach(async () => {
  await db.recursiveDelete(db.collection(`businesses/${BIZ}/stockMovements`));
  await db.recursiveDelete(db.collection(`businesses/${BIZ}/stockLevels`));
});

async function move(type: string, qtyChange: number, allowNegative = false) {
  return db.runTransaction(async (tx) => {
    const current = await readLevelTx(tx, db, BIZ, P, V, L);
    return applyMovementTx(tx, db, {
      businessId: BIZ, date: '2026-04-05', productId: P, variantId: V, locationId: L,
      type: type as never, qtyChange, actorUid: 'u1', allowNegative,
    }, current);
  });
}

describe('applyMovementTx — ledger + derived level (BR-STK-02/03)', () => {
  it('purchase-in then sale-out update the level and append movements', async () => {
    const a = await move('purchase', 10);
    expect(a.qtyAfter).toBe(10);
    const bRes = await move('sale', -4);
    expect(bRes.qtyAfter).toBe(6);

    const level = (await db.doc(`businesses/${BIZ}/stockLevels/${stockLevelId(P, V, L)}`).get()).data();
    expect(level?.qty).toBe(6);
    const movements = await db.collection(`businesses/${BIZ}/stockMovements`).get();
    expect(movements.size).toBe(2);
    // The ledger is the source of truth: qtyAfter is recorded on each movement.
    expect(movements.docs.map((d) => d.data().qtyAfter).sort((x, y) => x - y)).toEqual([6, 10]);
  });

  it('refuses to go negative without an override, and writes nothing', async () => {
    await move('purchase', 3);
    await expect(move('sale', -5)).rejects.toThrow();
    const level = (await db.doc(`businesses/${BIZ}/stockLevels/${stockLevelId(P, V, L)}`).get()).data();
    expect(level?.qty).toBe(3); // unchanged
    expect((await db.collection(`businesses/${BIZ}/stockMovements`).get()).size).toBe(1);
  });

  it('allows negative with an explicit override (BR-STK-06)', async () => {
    await move('purchase', 3);
    const res = await move('sale', -5, true);
    expect(res.qtyAfter).toBe(-2);
  });

  it('rolls back both the movement and the level when the transaction throws (§55)', async () => {
    await move('purchase', 10);
    await expect(
      db.runTransaction(async (tx) => {
        const current = await readLevelTx(tx, db, BIZ, P, V, L);
        applyMovementTx(tx, db, { businessId: BIZ, date: '2026-04-05', productId: P, variantId: V, locationId: L, type: 'sale', qtyChange: -2, actorUid: 'u1' }, current);
        throw new Error('boom'); // e.g. a later line fails
      }),
    ).rejects.toThrow('boom');
    const level = (await db.doc(`businesses/${BIZ}/stockLevels/${stockLevelId(P, V, L)}`).get()).data();
    expect(level?.qty).toBe(10); // no partial write
    expect((await db.collection(`businesses/${BIZ}/stockMovements`).get()).size).toBe(1);
  });

  it('two sequential moves on the same cell stack correctly (transfer out+in pattern)', async () => {
    await move('purchase', 10);
    await move('transfer_out', -4);
    const res = await move('transfer_in', 4);
    expect(res.qtyAfter).toBe(10);
  });
});
