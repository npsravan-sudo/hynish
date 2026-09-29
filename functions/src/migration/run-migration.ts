/**
 * Data migration callable (Phase 12, §8-25).
 *
 * Transforms and validates legacy v2.x Hynish ERP data into the Phase 0-11 schema.
 * Runs in two modes:
 *   dryRun: true  → reads + validates + reports; never writes production data
 *   dryRun: false → executes migration into a DESTINATION business document
 *
 * Security:
 *  - Requires owner role + step-up (5-minute reauth) + App Check (via defineCallable)
 *  - businessId in payload must match the authenticated actor's business
 *  - A migration stamp prevents accidental re-run unless force=true
 *
 * Determinism / Idempotency:
 *  - Document IDs preserved from legacy (no renumbering of historical docs)
 *  - Records already present in destination are skipped (not overwritten)
 *  - Numbering counters seeded to max+1 to prevent future collisions
 *
 * CONCURRENCY NOTE:
 *  - This callable does NOT prevent concurrent live writes to the same records.
 *    The calling administrator must ensure no active sessions modify the business
 *    during a production migration.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { db } from '../config/app.js';
import { defineCallable, z } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertStepUp } from '../auth/authorize.js';

// ---- Input schema ----------------------------------------------------------------

const runMigrationSchema = z.object({
  businessId: z.string().min(1),
  legacyBusinessId: z.string().min(1),
  dryRun: z.boolean(),
  force: z.boolean().optional().default(false),
});

// ---- Types -----------------------------------------------------------------------

export interface MigrationEntityReport {
  total: number;
  valid: number;
  invalid: number;
  skipped: number;
  warnings: string[];
  errors: string[];
}

export interface MigrationReport {
  dryRun: boolean;
  businessId: string;
  legacyBusinessId: string;
  startedAt: string;
  completedAt: string | null;
  status: 'completed' | 'failed' | 'dry_run_complete';
  entities: Record<string, MigrationEntityReport>;
  numberingSeeds: Record<string, number>;
  financialTotals: {
    invoiceCount: number;
    invoiceTaxablePaise: number;
    invoiceTaxPaise: number;
    invoiceGrandTotalPaise: number;
    purchaseCount: number;
    purchaseTotalPaise: number;
    expenseTotalPaise: number;
    journalDebitPaise: number;
    journalCreditPaise: number;
  };
  globalWarnings: string[];
  globalErrors: string[];
}

// ---- Helpers --------------------------------------------------------------------

function emptyEntityReport(): MigrationEntityReport {
  return { total: 0, valid: 0, invalid: 0, skipped: 0, warnings: [], errors: [] };
}

function emptyReport(businessId: string, legacyBusinessId: string, dryRun: boolean): MigrationReport {
  const collections = [
    'products', 'customers', 'suppliers', 'locations', 'invoices', 'purchases',
    'quotations', 'deliveryNotes', 'creditNotes', 'debitNotes', 'expenses',
    'cashEntries', 'stockMovements', 'stockLevels', 'accounts', 'journalEntries',
    'payments', 'members',
  ];
  const entities: Record<string, MigrationEntityReport> = {};
  for (const c of collections) entities[c] = emptyEntityReport();
  return {
    dryRun, businessId, legacyBusinessId,
    startedAt: new Date().toISOString(), completedAt: null, status: 'failed',
    entities,
    numberingSeeds: {},
    financialTotals: {
      invoiceCount: 0, invoiceTaxablePaise: 0, invoiceTaxPaise: 0, invoiceGrandTotalPaise: 0,
      purchaseCount: 0, purchaseTotalPaise: 0, expenseTotalPaise: 0,
      journalDebitPaise: 0, journalCreditPaise: 0,
    },
    globalWarnings: [],
    globalErrors: [],
  };
}

function validateJournal(doc: Record<string, unknown>): string | null {
  const lines = doc['lines'];
  if (!Array.isArray(lines) || lines.length === 0) return 'No journal lines';
  let debit = 0; let credit = 0;
  for (const line of lines as Array<Record<string, unknown>>) {
    debit += Number(line['debitPaise'] ?? 0);
    credit += Number(line['creditPaise'] ?? 0);
  }
  return Math.abs(debit - credit) > 0
    ? `Unbalanced journal: debit=${debit} credit=${credit}`
    : null;
}

function extractDocNumber(number: unknown): number | null {
  if (typeof number !== 'string') return null;
  const match = number.match(/(\d+)$/);
  return match ? parseInt(match[1]!, 10) : null;
}

async function migrateCollection(
  legacyPath: string,
  destPath: string,
  report: MigrationEntityReport,
  dryRun: boolean,
  validate: (doc: Record<string, unknown>) => string | null,
  transform: (doc: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const snapshot = await db.collection(legacyPath).get();
  report.total = snapshot.size;
  for (const legacyDoc of snapshot.docs) {
    const data = legacyDoc.data() as Record<string, unknown>;
    const err = validate(data);
    if (err) { report.invalid++; report.errors.push(`[${legacyDoc.id}] ${err}`); continue; }
    if (!dryRun) {
      const destRef = db.doc(`${destPath}/${legacyDoc.id}`);
      const existing = await destRef.get();
      if (existing.exists) { report.skipped++; report.warnings.push(`[${legacyDoc.id}] already exists — skipped`); continue; }
      await destRef.set(transform(data));
    }
    report.valid++;
  }
}

// ---- Main callable ---------------------------------------------------------------

export const runMigration = defineCallable(
  runMigrationSchema,
  async (input, request) => {
    const { businessId, legacyBusinessId, dryRun, force } = input;
    const actor = await resolveActor(request, businessId);
    assertPermission(actor.member, 'restore.execute');
    assertStepUp(actor.token, Math.floor(Date.now() / 1000));

    const report = emptyReport(businessId, legacyBusinessId, dryRun);

    // Guard: check for existing migration stamp
    if (!dryRun && !force) {
      const stamp = await db.doc(`businesses/${businessId}/settings/migrationStatus`).get();
      if (stamp.exists && stamp.data()?.['status'] === 'completed') {
        throw new Error('This business has already been migrated. Pass force=true to re-run.');
      }
    }

    logger.info('[migration] starting', { businessId, legacyBusinessId, dryRun });

    const base = `businesses/${businessId}`;
    const legacyBase = `businesses/${legacyBusinessId}`;

    // --- Products, Customers, Suppliers, Locations (master data) ------------------
    await migrateCollection(`${legacyBase}/products`, `${base}/products`, report.entities['products']!, dryRun,
      (d) => (typeof d['name'] === 'string' && d['name'] ? null : 'Missing name'),
      (d) => ({ ...d, businessId }),
    );
    await migrateCollection(`${legacyBase}/customers`, `${base}/customers`, report.entities['customers']!, dryRun,
      (d) => (typeof d['name'] === 'string' && d['name'] ? null : 'Missing name'),
      (d) => ({ ...d, businessId }),
    );
    await migrateCollection(`${legacyBase}/suppliers`, `${base}/suppliers`, report.entities['suppliers']!, dryRun,
      (d) => (typeof d['name'] === 'string' && d['name'] ? null : 'Missing name'),
      (d) => ({ ...d, businessId }),
    );
    await migrateCollection(`${legacyBase}/locations`, `${base}/locations`, report.entities['locations']!, dryRun,
      (d) => (typeof d['name'] === 'string' && d['name'] ? null : 'Missing name'),
      (d) => ({ ...d, businessId }),
    );

    // --- Invoices (financial totals + numbering) ----------------------------------
    {
      const r = report.entities['invoices']!;
      const invoiceNumbers: number[] = [];
      const snap = await db.collection(`${legacyBase}/invoices`).get();
      r.total = snap.size;
      for (const doc of snap.docs) {
        const data = doc.data() as Record<string, unknown>;
        if (!data['number'] || !data['date']) { r.invalid++; r.errors.push(`[${doc.id}] missing number or date`); continue; }
        const n = extractDocNumber(data['number']);
        if (n) invoiceNumbers.push(n);
        report.financialTotals.invoiceCount++;
        report.financialTotals.invoiceTaxablePaise += Number(data['taxableAmountPaise'] ?? 0);
        report.financialTotals.invoiceTaxPaise += Number(data['totalTaxPaise'] ?? 0);
        report.financialTotals.invoiceGrandTotalPaise += Number(data['totalPaise'] ?? 0);
        if (!dryRun) {
          const dest = db.doc(`${base}/invoices/${doc.id}`);
          if ((await dest.get()).exists) { r.skipped++; continue; }
          await dest.set({ ...data, businessId });
        }
        r.valid++;
      }
      if (invoiceNumbers.length > 0) {
        const seed = Math.max(...invoiceNumbers) + 1;
        report.numberingSeeds['invoice'] = seed;
        if (!dryRun) await db.doc(`${base}/counters/inv`).set({ next: seed, migratedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    }

    // --- Purchases (financial totals + numbering) ---------------------------------
    {
      const r = report.entities['purchases']!;
      const purchaseNumbers: number[] = [];
      const snap = await db.collection(`${legacyBase}/purchases`).get();
      r.total = snap.size;
      for (const doc of snap.docs) {
        const data = doc.data() as Record<string, unknown>;
        if (!data['number'] || !data['date']) { r.invalid++; r.errors.push(`[${doc.id}] missing number or date`); continue; }
        const n = extractDocNumber(data['number']);
        if (n) purchaseNumbers.push(n);
        report.financialTotals.purchaseCount++;
        report.financialTotals.purchaseTotalPaise += Number(data['totalPaise'] ?? 0);
        if (!dryRun) {
          const dest = db.doc(`${base}/purchases/${doc.id}`);
          if ((await dest.get()).exists) { r.skipped++; continue; }
          await dest.set({ ...data, businessId });
        }
        r.valid++;
      }
      if (purchaseNumbers.length > 0) {
        const seed = Math.max(...purchaseNumbers) + 1;
        report.numberingSeeds['purchase'] = seed;
        if (!dryRun) await db.doc(`${base}/counters/pur`).set({ next: seed, migratedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    }

    // --- Expenses (financial totals) ---------------------------------------------
    {
      const r = report.entities['expenses']!;
      const snap = await db.collection(`${legacyBase}/expenses`).get();
      r.total = snap.size;
      for (const doc of snap.docs) {
        const data = doc.data() as Record<string, unknown>;
        report.financialTotals.expenseTotalPaise += Number(data['totalPaise'] ?? 0);
        if (!dryRun) {
          const dest = db.doc(`${base}/expenses/${doc.id}`);
          if ((await dest.get()).exists) { r.skipped++; continue; }
          await dest.set({ ...data, businessId });
        }
        r.valid++;
      }
    }

    // --- Journal entries (balance validation) ------------------------------------
    {
      const r = report.entities['journalEntries']!;
      const snap = await db.collection(`${legacyBase}/journalEntries`).get();
      r.total = snap.size;
      for (const doc of snap.docs) {
        const data = doc.data() as Record<string, unknown>;
        const balErr = validateJournal(data);
        if (balErr) { r.invalid++; r.errors.push(`[${doc.id}] ${balErr}`); continue; }
        const lines = data['lines'] as Array<Record<string, unknown>>;
        for (const l of lines) {
          report.financialTotals.journalDebitPaise += Number(l['debitPaise'] ?? 0);
          report.financialTotals.journalCreditPaise += Number(l['creditPaise'] ?? 0);
        }
        if (!dryRun) {
          const dest = db.doc(`${base}/journalEntries/${doc.id}`);
          if ((await dest.get()).exists) { r.skipped++; continue; }
          await dest.set({ ...data, businessId });
        }
        r.valid++;
      }
    }

    // --- Remaining collections (pass-through with businessId rewrite) ------------
    for (const collection of [
      'quotations', 'deliveryNotes', 'creditNotes', 'debitNotes',
      'cashEntries', 'stockMovements', 'stockLevels', 'accounts',
      'payments', 'members',
    ]) {
      await migrateCollection(
        `${legacyBase}/${collection}`, `${base}/${collection}`,
        report.entities[collection]!, dryRun,
        () => null,
        (d) => ({ ...d, businessId }),
      );
    }

    // --- Global journal balance check --------------------------------------------
    const diff = report.financialTotals.journalDebitPaise - report.financialTotals.journalCreditPaise;
    if (diff !== 0) {
      report.globalWarnings.push(
        `Aggregate journal imbalance: debit=${report.financialTotals.journalDebitPaise} ` +
        `credit=${report.financialTotals.journalCreditPaise} diff=${diff}. ` +
        `Invalid journals were excluded. Investigate before production migration.`,
      );
    }

    // --- Complete ----------------------------------------------------------------
    report.completedAt = new Date().toISOString();
    report.status = dryRun ? 'dry_run_complete' : 'completed';

    if (!dryRun) {
      await db.doc(`${base}/settings/migrationStatus`).set({
        status: 'completed', completedAt: FieldValue.serverTimestamp(),
        legacyBusinessId, schemaVersion: 1,
        report: JSON.stringify(report).slice(0, 900_000), // Firestore 1MB doc limit
      });
    }

    logger.info('[migration] done', { status: report.status, dryRun });
    return { report };
  },
  { timeoutSeconds: 540, memory: '512MiB' },
);
