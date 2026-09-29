import { z } from 'zod';
import { SERIES_KEYS, SYNC_INTERVAL_OPTIONS } from '@hynish/domain';

/** Server-side validation schemas for settings callables (Phase 10). */

export const saveBusinessSettingsSchema = z.object({
  businessId: z.string().min(1),
  businessName: z.string().min(1).max(200),
  /** GSTIN — uppercased server-side (BR-SET-01). Empty string = not set. */
  gstin: z.string().max(15).transform((v) => v.trim().toUpperCase()),
  address: z.string().max(500).default(''),
  city: z.string().max(100).default(''),
  stateCode: z.string().max(2).default(''),
  pincode: z.string().max(10).default(''),
  phone: z.string().max(20).default(''),
  email: z.string().email().or(z.literal('')).default(''),
  logoPath: z.string().nullable().default(null),
  licenseKey: z.string().max(100).default(''),
  bank: z
    .object({
      bankName: z.string().max(200).default(''),
      accountNumber: z.string().max(30).default(''),
      ifsc: z.string().max(11).default(''),
    })
    .default({ bankName: '', accountNumber: '', ifsc: '' }),
  prefixes: z.record(z.enum(SERIES_KEYS), z.string().min(1).max(10)).optional(),
  syncIntervalMinutes: z.number().refine((v) => (SYNC_INTERVAL_OPTIONS as readonly number[]).includes(v), {
    message: 'Invalid sync interval',
  }).optional(),
});
export type SaveBusinessSettingsInput = z.infer<typeof saveBusinessSettingsSchema>;

export const saveIntegrationSettingsSchema = z.object({
  businessId: z.string().min(1),
  whatsapp: z.object({
    provider: z.string().max(100).default(''),
    phoneNumberId: z.string().max(50).default(''),
    businessAccountId: z.string().max(50).default(''),
    notes: z.string().max(500).default(''),
  }),
});
export type SaveIntegrationSettingsInput = z.infer<typeof saveIntegrationSettingsSchema>;

export const createBackupMetadataSchema = z.object({
  businessId: z.string().min(1),
  /** Byte size of the exported JSON — provided by the client after serialization. */
  sizeEstimateBytes: z.number().int().nonnegative(),
  entityCounts: z.record(z.string(), z.number().int().nonnegative()),
  applicationVersion: z.string().max(50),
});
export type CreateBackupMetadataInput = z.infer<typeof createBackupMetadataSchema>;
