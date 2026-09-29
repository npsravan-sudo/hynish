/**
 * Settings callables (Phase 10, TD §3.2, BR-SET-01..09).
 *
 * Business settings and integration settings are NEVER client-writable (Firestore rules deny it).
 * All mutations flow through these callables with permission guards, GSTIN normalization, and audit.
 *
 * createBackupMetadata is the server-side counterpart to the client's backup export: the client
 * reads its own Firestore data, builds the JSON locally, then calls this to record the metadata.
 * Restore (a full server-side rewrite) is out of scope for the initial phase (OQ-29 — destructive
 * bulk writes require a dedicated migration path; the client download/import is the supported flow).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/app.js';
import { defineCallable } from '../middleware/callable.js';
import { resolveActor } from '../auth/context.js';
import { assertPermission, assertStepUp } from '../auth/authorize.js';
import { logActivity, updateAudit } from '../masterdata/common.js';
import {
  saveBusinessSettingsSchema,
  saveIntegrationSettingsSchema,
  createBackupMetadataSchema,
} from '../schemas/settings.js';
import { BACKUP_SCHEMA_VERSION } from '@hynish/domain';

const APP_VERSION = process.env.APP_VERSION ?? '10.0.0';

export const saveBusinessSettings = defineCallable(saveBusinessSettingsSchema, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'settings.manage');
  assertStepUp(actor.token, Math.floor(Date.now() / 1000));

  const ref = db.doc(`businesses/${input.businessId}/settings/business`);

  // GSTIN is already uppercased by the schema transform (BR-SET-01).
  const payload: Record<string, unknown> = {
    businessName: input.businessName.trim(),
    gstin: input.gstin,
    address: input.address.trim(),
    city: input.city.trim(),
    stateCode: input.stateCode,
    pincode: input.pincode.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    logoPath: input.logoPath,
    licenseKey: input.licenseKey.trim(),
    bank: input.bank,
    ...updateAudit(actor.uid),
  };

  if (input.prefixes) {
    payload['prefixes'] = input.prefixes;
  }
  if (input.syncIntervalMinutes !== undefined) {
    payload['syncIntervalMinutes'] = input.syncIntervalMinutes;
  }

  const batch = db.batch();
  batch.set(ref, payload, { merge: true });
  logActivity(
    db,
    (r, d) => batch.set(r, d),
    actor,
    'update',
    { type: 'settings', id: 'business', label: 'Business Settings' },
  );
  await batch.commit();
  return { ok: true };
});

export const saveIntegrationSettings = defineCallable(saveIntegrationSettingsSchema, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'settings.manage');
  assertStepUp(actor.token, Math.floor(Date.now() / 1000));

  const ref = db.doc(`businesses/${input.businessId}/settings/integrations`);

  const batch = db.batch();
  // Never update hasApiKey or the actual API key from this callable — that goes through
  // Secret Manager separately and is never echoed back (BR-SET-08).
  batch.set(
    ref,
    {
      whatsapp: {
        provider: input.whatsapp.provider.trim(),
        phoneNumberId: input.whatsapp.phoneNumberId.trim(),
        businessAccountId: input.whatsapp.businessAccountId.trim(),
        notes: input.whatsapp.notes.trim(),
      },
      ...updateAudit(actor.uid),
    },
    { merge: true },
  );
  logActivity(
    db,
    (r, d) => batch.set(r, d),
    actor,
    'update',
    { type: 'settings', id: 'integrations', label: 'Integration Settings' },
  );
  await batch.commit();
  return { ok: true };
});

export const createBackupMetadata = defineCallable(createBackupMetadataSchema, async (input, request) => {
  const actor = await resolveActor(request, input.businessId);
  assertPermission(actor.member, 'backup.create');

  const ref = db.collection(`businesses/${input.businessId}/backups`).doc();

  const batch = db.batch();
  batch.set(ref, {
    id: ref.id,
    businessId: input.businessId,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    applicationVersion: input.applicationVersion || APP_VERSION,
    entityCounts: input.entityCounts,
    sizeEstimateBytes: input.sizeEstimateBytes,
  });
  logActivity(
    db,
    (r, d) => batch.set(r, d),
    actor,
    'create',
    { type: 'backup', id: ref.id, label: 'Data Backup' },
  );
  await batch.commit();
  return { backupId: ref.id };
});
