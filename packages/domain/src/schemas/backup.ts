/**
 * Backup/Restore schemas (Phase 10, TD §3.2, BR-SET-10..16).
 *
 * The export file is a versioned JSON envelope that holds every entity array the business owns.
 * It is downloaded client-side (never uploaded to a server host) and restored via a server-only
 * Cloud Function call — clients can never write entity collections directly.
 *
 * NEVER include: API keys, secrets, Firebase credentials, WhatsApp tokens, auth tokens.
 */
import { z } from 'zod';

/** Current backup format version. Increment when a field is removed or its semantics change. */
export const BACKUP_SCHEMA_VERSION = 1 as const;

/** Metadata written to Firestore when a backup is created (backup.create permission). */
export const backupMetadataSchema = z.object({
  id: z.string().min(1),
  businessId: z.string().min(1),
  createdAt: z.number(), // epoch ms — Firestore serverTimestamp materialised as number on read
  createdBy: z.string().min(1),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  applicationVersion: z.string(),
  entityCounts: z.record(z.string(), z.number().int().nonnegative()),
  sizeEstimateBytes: z.number().int().nonnegative(),
});
export type BackupMetadata = z.infer<typeof backupMetadataSchema>;

/** Full export envelope downloaded to the client. */
export const backupEnvelopeSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  applicationVersion: z.string(),
  exportedAt: z.string(), // ISO-8601 timestamp string
  businessId: z.string().min(1),
  businessName: z.string(),

  // Entity arrays — each is validated on restore. Unknown keys are stripped.
  settings: z.object({
    business: z.record(z.unknown()).nullable(),
    integrations: z.record(z.unknown()).nullable(),
  }),
  members: z.array(z.record(z.unknown())),
  locations: z.array(z.record(z.unknown())),
  products: z.array(z.record(z.unknown())),
  customers: z.array(z.record(z.unknown())),
  suppliers: z.array(z.record(z.unknown())),
  invoices: z.array(z.record(z.unknown())),
  purchases: z.array(z.record(z.unknown())),
  quotations: z.array(z.record(z.unknown())),
  deliveryNotes: z.array(z.record(z.unknown())),
  creditNotes: z.array(z.record(z.unknown())),
  debitNotes: z.array(z.record(z.unknown())),
  expenses: z.array(z.record(z.unknown())),
  cashEntries: z.array(z.record(z.unknown())),
  stockMovements: z.array(z.record(z.unknown())),
  journalEntries: z.array(z.record(z.unknown())),
  accounts: z.array(z.record(z.unknown())),
});
export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;

/** Validate that a parsed JSON object is a recognisable backup envelope before restore. */
export function validateBackupEnvelope(raw: unknown): BackupEnvelope {
  const result = backupEnvelopeSchema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new Error(
      `Invalid backup file: ${firstIssue ? `${firstIssue.path.join('.')} — ${firstIssue.message}` : 'schema mismatch'}`,
    );
  }
  if (result.data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup version ${result.data.schemaVersion}. Expected ${BACKUP_SCHEMA_VERSION}.`);
  }
  return result.data;
}

/** Summary of what a restore will overwrite — shown to the user before confirmation. */
export interface RestorePreview {
  businessId: string;
  businessName: string;
  exportedAt: string;
  entityCounts: Record<string, number>;
  schemaVersion: number;
}

export function backupRestorePreview(envelope: BackupEnvelope): RestorePreview {
  return {
    businessId: envelope.businessId,
    businessName: envelope.businessName,
    exportedAt: envelope.exportedAt,
    entityCounts: {
      members: envelope.members.length,
      locations: envelope.locations.length,
      products: envelope.products.length,
      customers: envelope.customers.length,
      suppliers: envelope.suppliers.length,
      invoices: envelope.invoices.length,
      purchases: envelope.purchases.length,
      quotations: envelope.quotations.length,
      deliveryNotes: envelope.deliveryNotes.length,
      creditNotes: envelope.creditNotes.length,
      debitNotes: envelope.debitNotes.length,
      expenses: envelope.expenses.length,
      cashEntries: envelope.cashEntries.length,
      stockMovements: envelope.stockMovements.length,
      journalEntries: envelope.journalEntries.length,
      accounts: envelope.accounts.length,
    },
    schemaVersion: envelope.schemaVersion,
  };
}
