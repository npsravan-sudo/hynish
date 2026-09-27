/** Organization schemas: Business, Member, Location, Settings (DATA-MODEL §6.2–6.6). */
import { z } from 'zod';
import { ROLES, PERMISSIONS } from '../permissions.js';
import { LOCATION_TYPES, THEME_MODES, SERIES_KEYS, DEFAULT_PREFIXES, DEFAULT_TIMEZONE } from '../constants.js';
import { entity, auditFields, softDelete, nonNegPaise, gstin, epochMs } from './common.js';

export const businessSchema = entity.extend({
  name: z.string().min(1),
  ownerUid: z.string().min(1),
  status: z.enum(['active', 'suspended']),
  timezone: z.string().default(DEFAULT_TIMEZONE),
  legacyBusinessCode: z.string().nullable(),
  currentSchemaVersion: z.number().int().positive(),
});
export type Business = z.infer<typeof businessSchema>;

const permissionOverrides = z.record(z.enum(PERMISSIONS), z.boolean());

export const memberSchema = entity.merge(softDelete).extend({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().nullable(),
  role: z.enum(ROLES),
  active: z.boolean(),
  /** null = unrestricted (all locations); [] = no access (fails closed). */
  locationIds: z.array(z.string().min(1)).nullable(),
  permissionOverrides: permissionOverrides.nullable(),
  lastInteractiveSignInAt: epochMs.nullable(),
  legacyLocationName: z.string().nullable().optional(),
});
export type Member = z.infer<typeof memberSchema>;

export const locationSchema = entity.merge(softDelete).extend({
  name: z.string().min(1),
  type: z.enum(LOCATION_TYPES),
  address: z.string().default(''),
  openingCashBalancePaise: nonNegPaise.default(0),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export type Location = z.infer<typeof locationSchema>;

/** Business settings — the typed equivalent of the legacy defaultSettings() (§32, LC-2.x). */
export const businessSettingsSchema = z.object({
  businessName: z.string().default(''),
  gstin: gstin.default(''),
  address: z.string().default(''),
  city: z.string().default(''),
  stateCode: z.string().default(''),
  pincode: z.string().default(''),
  phone: z.string().default(''),
  email: z.string().default(''),
  logoPath: z.string().nullable().default(null),
  licenseKey: z.string().default(''),
  bank: z
    .object({ bankName: z.string().default(''), accountNumber: z.string().default(''), ifsc: z.string().default('') })
    .default({ bankName: '', accountNumber: '', ifsc: '' }),
  /** Prefixes per series (numbering counters live in `counters`, not here — BR-NUM-05). */
  prefixes: z.record(z.enum(SERIES_KEYS), z.string()).default({ ...DEFAULT_PREFIXES }),
});
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

/** Non-secret integration settings; the WhatsApp API key lives in Secret Manager (LC-2.5). */
export const integrationSettingsSchema = z.object({
  whatsapp: z
    .object({
      provider: z.string().default(''),
      phoneNumberId: z.string().default(''),
      businessAccountId: z.string().default(''),
      notes: z.string().default(''),
      hasApiKey: z.boolean().default(false),
    })
    .default({ provider: '', phoneNumberId: '', businessAccountId: '', notes: '', hasApiKey: false }),
});
export type IntegrationSettings = z.infer<typeof integrationSettingsSchema>;

/** Per-user preferences (DATA-MODEL §6.1). Theme is Light/Dark/System (Phase 1 §17). */
export const userPreferencesSchema = z.object({
  theme: z.enum(THEME_MODES).default('system'),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

/** Numbering counter document (server-owned; BR-NUM-05). */
export const counterSchema = z.object({
  seriesKey: z.enum(SERIES_KEYS),
  nextSeq: z.number().int().positive(),
  fyScoped: z.boolean(),
  fy: z.string().nullable(),
  updatedAt: epochMs,
  updatedBy: z.string(),
});
export type Counter = z.infer<typeof counterSchema>;

void auditFields;
