/**
 * Admin write service (Phase 10). Thin typed wrappers over the server-authoritative
 * Cloud Functions for settings, members, and backup. No direct Firestore writes here.
 */
import { callable } from '@/lib/firebase/functions';
import type { SaveBusinessSettingsInput, SaveIntegrationSettingsInput } from './admin-types';

const saveBusinessSettingsFn = callable<SaveBusinessSettingsInput, { ok: boolean }>('saveBusinessSettings');
const saveIntegrationSettingsFn = callable<SaveIntegrationSettingsInput, { ok: boolean }>('saveIntegrationSettings');
const createBackupMetadataFn = callable<
  { businessId: string; sizeEstimateBytes: number; entityCounts: Record<string, number>; applicationVersion: string },
  { backupId: string }
>('createBackupMetadata');

// Member management callables (already in Phase 2, re-exposed here for Settings UI)
const createMemberFn = callable<{
  businessId: string; uid: string; email: string; displayName: string;
  role: string; locationIds: string[] | null; permissionOverrides?: Record<string, boolean> | null;
}, { ok: boolean }>('createMember');
const updateMemberFn = callable<{
  businessId: string; uid: string; role?: string; locationIds?: string[] | null;
  permissionOverrides?: Record<string, boolean> | null; displayName?: string;
}, { ok: boolean }>('updateMember');
const setMemberActiveFn = callable<{ businessId: string; uid: string; active: boolean }, { ok: boolean }>('setMemberActive');

export function createAdminService(businessId: string) {
  return {
    settings: {
      saveBusiness: (input: Omit<SaveBusinessSettingsInput, 'businessId'>) =>
        saveBusinessSettingsFn({ ...input, businessId }),
      saveIntegrations: (input: Omit<SaveIntegrationSettingsInput, 'businessId'>) =>
        saveIntegrationSettingsFn({ ...input, businessId }),
    },
    backup: {
      recordMetadata: (opts: { sizeEstimateBytes: number; entityCounts: Record<string, number>; applicationVersion: string }) =>
        createBackupMetadataFn({ businessId, ...opts }),
    },
    members: {
      create: (input: Omit<Parameters<typeof createMemberFn>[0], 'businessId'>) =>
        createMemberFn({ ...input, businessId }),
      update: (input: Omit<Parameters<typeof updateMemberFn>[0], 'businessId'>) =>
        updateMemberFn({ ...input, businessId }),
      setActive: (uid: string, active: boolean) =>
        setMemberActiveFn({ businessId, uid, active }),
    },
  };
}
export type AdminService = ReturnType<typeof createAdminService>;
