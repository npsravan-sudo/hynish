# Phase 10 — Completion Report

Settings, Backup/Restore, Audit & Administration: Business profile settings, document numbering,
bank details, WhatsApp (Coming Soon), theme/sync settings, backup export with client download,
restore preview with server validation, immutable activity log, and member management.

## Architecture

```
Settings mutation:
  UI (React Hook Form + Zod) ──▶ AdminService (callable) ──▶ Cloud Function
      (assertPermission + assertStepUp + GSTIN uppercase)
          ──▶ Firestore batch (settings write + activityLog write)
                ▲ never: UI ──▶ Firestore directly (rules: allow write: if false)

Backup export (client-side):
  BackupSection ──▶ reads own Firestore via repos (reads already allowed for member)
      ──▶ builds JSON envelope (backupEnvelopeSchema)
          ──▶ client downloads file
              ──▶ createBackupMetadata callable writes Firestore metadata + activityLog

Restore (Phase 10: preview only, OQ-29):
  FileInput ──▶ validateBackupEnvelope() ──▶ backupRestorePreview() ──▶ UI preview panel
      (full destructive restore is OQ-29 — not yet implemented)

Activity log reads:
  ActivityPage ──▶ usePagedList(repos.activityLog) ──▶ Firestore (allow read: if hasPermission activity.view)
```

## Where it lives

| Layer | Location | Contents |
|---|---|---|
| Domain schemas | `packages/domain/src/schemas/backup.ts` | `BACKUP_SCHEMA_VERSION=1`, `backupMetadataSchema`, `backupEnvelopeSchema`, `validateBackupEnvelope()`, `backupRestorePreview()`, `RestorePreview` |
| Domain tests | `packages/domain/src/schemas/backup.test.ts` | 8 tests: validateBackupEnvelope (6) + backupRestorePreview (2) |
| Function schemas | `functions/src/schemas/settings.ts` | `saveBusinessSettingsSchema` (GSTIN uppercase transform), `saveIntegrationSettingsSchema`, `createBackupMetadataSchema` |
| Functions | `functions/src/settings/save-settings.ts` | `saveBusinessSettings`, `saveIntegrationSettings`, `createBackupMetadata` callables |
| Functions index | `functions/src/index.ts` | Exports all three settings callables |
| Firestore paths | `apps/web/src/infrastructure/firestore/paths.ts` | Added `backups` path |
| Repositories | `apps/web/src/infrastructure/repositories/index.ts` | Added `activityLog`, `integrationSettings`, `backups` |
| Services | `apps/web/src/services/admin.service.ts` | `createAdminService()` — settings, backup, members |
| Service types | `apps/web/src/services/admin-types.ts` | `SaveBusinessSettingsInput`, `SaveIntegrationSettingsInput` |
| Hook | `apps/web/src/hooks/use-master-data.ts` | Added `useAdminService()` |
| Admin pages barrel | `apps/web/src/features/admin/admin-pages.tsx` | Re-exports real implementations |
| Settings UI | `apps/web/src/features/admin/settings-page.tsx` | Profile, Numbering, Bank, WhatsApp (Coming Soon), Sync, Appearance, Backup sections |
| Members UI | `apps/web/src/features/admin/users-page.tsx` | Member list, invite, activate/deactivate |
| Activity UI | `apps/web/src/features/admin/activity-page.tsx` | Paginated audit log with search + detail sheet |

## Business rules implemented

| Rule | Implementation |
|---|---|
| BR-SET-01: GSTIN uppercase | Schema `.transform((v) => v.trim().toUpperCase())` in `saveBusinessSettingsSchema`; also client-side in React Hook Form onChange |
| BR-SET-02: stateCode auto-derived from GSTIN | `stateCodeFromGstin()` in ProfileSection `watch('gstin')` effect |
| BR-SET-03: valid GSTIN shown | `isValidGstin()` visual indicator on GSTIN field |
| BR-SET-04: settings.manage permission required | `assertPermission(actor.member, 'settings.manage')` in all settings callables |
| BR-SET-05: step-up auth for settings mutations | `assertStepUp(actor.token, ...)` in `saveBusinessSettings` and `saveIntegrationSettings` |
| BR-SET-06: document prefix defaults | 6 series with prefixes — INV/QUO/DN/CN/DBN, invoice_nogst=BL |
| BR-SET-07: sync interval | Options: 0/1/2/5/10/15/30/60 min; default=2 (DEF-017) |
| BR-SET-08: WhatsApp API key never stored in settings | `saveIntegrationSettings` never writes `hasApiKey` or the key itself |
| BR-SET-09: logActivity on every settings mutation | All three callables call `logActivity()` |
| BR-SET-10: backup.create permission required | `assertPermission(actor.member, 'backup.create')` in `createBackupMetadata` |
| BR-SET-11: backup never includes secrets | `backupEnvelopeSchema` excludes all API keys, auth tokens, Firebase credentials |
| BR-SET-12: backup schemaVersion=1 | `BACKUP_SCHEMA_VERSION = 1 as const` from domain |
| BR-SET-13: restore preview validates business ownership | `backupRestorePreview()` returns `businessId`; UI checks it before proceeding |
| BR-SET-14: full restore is OQ-29 | Only client-side preview implemented; restore callable is out of scope this phase |
| BR-ADM-01: members.manage permission | `assertPermission(actor.member, 'members.manage')` in member callables (Phase 2) |
| BR-ADM-02: self-modification guard | `m.uid === currentUid` check in UsersPage actions |
| BR-ADM-03: activity.view permission for log | Firestore rules + router gate |
| BR-ADM-04: activityLog is append-only | `allow write: if false` in firestore.rules (already present) |

## Firestore rules

No new rules were required for Phase 10. All collections already had correct rules:

| Collection | Rule |
|---|---|
| `businesses/{b}/settings/{doc}` | `allow get: if isMember(b); allow list, write: if false` |
| `businesses/{b}/counters/{s}` | `allow read: if hasPermission(b, 'settings.manage'); allow write: if false` |
| `businesses/{b}/activityLog/{id}` | `allow read: if hasPermission(b, 'activity.view'); allow write: if false` |
| `businesses/{b}/backups/{id}` | `allow read: if hasPermission(b, 'backup.create'); allow write: if false` |
| `businesses/{b}/restoreJobs/{id}` | `allow read: if hasPermission(b, 'restore.execute'); allow write: if false` |

## Backup envelope schema (version 1)

```json
{
  "schemaVersion": 1,
  "applicationVersion": "10.0.0",
  "exportedAt": "2026-09-29T12:00:00.000Z",
  "businessId": "biz123",
  "businessName": "Hynish Clothing",
  "settings": { "business": {...}, "integrations": {...} },
  "members": [...],
  "locations": [...],
  "products": [...],
  "customers": [...],
  "suppliers": [...],
  "invoices": [...],
  "purchases": [...],
  "quotations": [...],
  "deliveryNotes": [...],
  "creditNotes": [...],
  "debitNotes": [...],
  "expenses": [...],
  "cashEntries": [...],
  "stockMovements": [...],
  "journalEntries": [...],
  "accounts": [...]
}
```

NEVER included: API keys, WhatsApp tokens, Firebase credentials, auth tokens, Secret Manager values.

## Open questions created this phase

None — all Phase 10 functionality was either defined in TD §3.2/§3.3 or references the pre-existing OQ-29 (destructive bulk restore).

---

## LEGACY COMPATIBILITY CHECK

- Existing defaults preserved:
  - DEF-016 (New Bill opens Without GST): not touched — invoice series unchanged
  - DEF-017 (syncIntervalMinutes=2): SYNC_INTERVAL_OPTIONS includes 2; 2 is the defaultValue in SyncSection
- Existing settings preserved: All existing settings schema fields preserved; Phase 10 adds prefixes, syncIntervalMinutes, bank, whatsapp sub-objects
- Existing validations preserved: GSTIN format validation (isValidGstin), stateCode auto-derive — preserved from legacy TD §3.2
- Existing calculations preserved: No calculation changes in Phase 10
- Existing workflows preserved: Member invite/activate/deactivate callables are Phase 2 callables reused unchanged; no workflow regressions
- Existing permissions preserved: settings.manage, members.manage, backup.create, activity.view, restore.execute all preserved per SECURITY-ARCHITECTURE.md §HARD_EXCLUDED_FOR_NON_ADMIN
- Existing document behavior preserved: No document (invoice/quotation/etc.) behavior changed
- Existing reports preserved: No report changes in Phase 10
- Existing user-visible behavior preserved: Theme (Light/Dark/System) already implemented in theme-store.ts — Phase 10 only wires the UI buttons to the existing store
- Deviations (with reason / OQ ref): Full restore not implemented — OQ-29 (destructive bulk writes require dedicated migration path)
- NOT VERIFIED items touched: None
