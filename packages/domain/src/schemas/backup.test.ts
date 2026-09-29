import { describe, it, expect } from 'vitest';
import {
  BACKUP_SCHEMA_VERSION,
  validateBackupEnvelope,
  backupRestorePreview,
  type BackupEnvelope,
} from './backup.js';

const VALID_ENVELOPE: BackupEnvelope = {
  schemaVersion: BACKUP_SCHEMA_VERSION,
  applicationVersion: '10.0.0',
  exportedAt: '2026-09-29T12:00:00.000Z',
  businessId: 'biz123',
  businessName: 'Hynish Clothing',
  settings: { business: null, integrations: null },
  members: [{ uid: 'u1', role: 'owner' }],
  locations: [{ id: 'loc1', name: 'Main' }],
  products: [],
  customers: [{ id: 'c1', name: 'ABC' }],
  suppliers: [],
  invoices: [{ id: 'inv1' }, { id: 'inv2' }],
  purchases: [],
  quotations: [],
  deliveryNotes: [],
  creditNotes: [],
  debitNotes: [],
  expenses: [],
  cashEntries: [],
  stockMovements: [],
  journalEntries: [],
  accounts: [],
};

describe('validateBackupEnvelope', () => {
  it('accepts a valid envelope', () => {
    const result = validateBackupEnvelope(VALID_ENVELOPE);
    expect(result.businessId).toBe('biz123');
    expect(result.schemaVersion).toBe(1);
  });

  it('throws on missing required field', () => {
    const bad = { ...VALID_ENVELOPE, businessId: undefined };
    expect(() => validateBackupEnvelope(bad)).toThrow(/businessId/);
  });

  it('throws on wrong schemaVersion', () => {
    const bad = { ...VALID_ENVELOPE, schemaVersion: 99 };
    expect(() => validateBackupEnvelope(bad)).toThrow(/Invalid backup file/);
  });

  it('throws on missing entity array', () => {
    const { accounts: _a, ...bad } = VALID_ENVELOPE;
    expect(() => validateBackupEnvelope(bad)).toThrow(/Invalid backup file/);
  });

  it('throws on null input', () => {
    expect(() => validateBackupEnvelope(null)).toThrow(/Invalid backup file/);
  });

  it('throws on non-object input', () => {
    expect(() => validateBackupEnvelope('not-an-object')).toThrow(/Invalid backup file/);
  });
});

describe('backupRestorePreview', () => {
  it('returns correct entity counts', () => {
    const preview = backupRestorePreview(VALID_ENVELOPE);
    expect(preview.businessId).toBe('biz123');
    expect(preview.businessName).toBe('Hynish Clothing');
    expect(preview.entityCounts.members).toBe(1);
    expect(preview.entityCounts.locations).toBe(1);
    expect(preview.entityCounts.customers).toBe(1);
    expect(preview.entityCounts.invoices).toBe(2);
    expect(preview.entityCounts.products).toBe(0);
  });

  it('returns schemaVersion and exportedAt', () => {
    const preview = backupRestorePreview(VALID_ENVELOPE);
    expect(preview.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(preview.exportedAt).toBe('2026-09-29T12:00:00.000Z');
  });
});
