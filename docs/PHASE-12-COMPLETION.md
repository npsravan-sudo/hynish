# Phase 12 — Final Integration, Migration, Security Audit & Production Deployment

**Completed:** 2026-09-29  
**Version shipped:** 1.0.0  
**Branch:** `claude/hynish-erp-phase-0-1nkqbb`

---

## §1  Objectives

Phase 12 closes the rebuild with:

1. Full application audit — every legacy module accounted for in the new system
2. Security audit — Firestore rules, Storage rules, Cloud Functions, client XSS scan, secret scan, npm audit
3. CI/CD validation — GitHub Actions `ci.yml` and `deploy.yml` created and exercised
4. Migration tooling — `runMigration` callable with dry-run mode, journal-balance validation, counter seeding
5. Final documentation — handover guides, deployment guide, this completion report
6. Final build verification — typecheck + lint + production build all pass

---

## §2  Module Completeness Audit

### Cloud Functions (`functions/src/index.ts`)

| Module | Callable(s) | Phase |
|--------|-------------|-------|
| members/manage | createMember, updateMember, setMemberActive | 2 |
| auth/session | logSession | 2 |
| members/triggers | onMemberWritten | 2 |
| numbering/reserve | reserveDocumentNumber | 3 |
| masterdata/products | saveProduct, setProductActive, setProductImage | 4 |
| masterdata/customers | saveCustomer, setCustomerActive | 4 |
| masterdata/suppliers | saveSupplier, setSupplierActive | 4 |
| masterdata/locations | saveLocation, setLocationActive | 4 |
| sales/finalize-invoice | finalizeInvoice | 5 |
| sales/delete-invoice | deleteInvoice | 5 |
| sales/record-payment | recordPayment | 5 |
| sales/quotations | saveQuotation | 5 |
| purchases/finalize-purchase | finalizePurchase | 6 |
| purchases/delete-purchase | deletePurchase | 6 |
| inventory/adjustments | recordStockAdjustment | 6 |
| inventory/transfers | transferStock | 6 |
| inventory/counts | finalizeStockCount | 6 |
| inventory/opening | postOpeningStock | 6 |
| accounting/seed-accounts | seedChartOfAccounts | 7 |
| accounting/save-account | saveAccount | 7 |
| accounting/delete-account | deleteAccount | 7 |
| accounting/cash-book | logCashEntry | 7 |
| accounting/seed-expense-categories | seedExpenseCategories | 8 |
| accounting/expenses | saveExpense, deleteExpense | 8 |
| sales/delivery-notes | saveDeliveryNote, markDeliveryNoteReturned | 8 |
| sales/credit-notes | saveCreditNote | 8 |
| purchases/debit-notes | saveDebitNote | 8 |
| settings/save-settings | saveBusinessSettings, saveIntegrationSettings, createBackupMetadata | 10 |
| migration/run-migration | runMigration | 12 |

**Total callables:** 32 + 1 Firestore trigger

### Web UI Features (`apps/web/src/features/`)

| Feature | Pages | Phase |
|---------|-------|-------|
| auth | Login, ForgotPassword | 2 |
| admin | Members, Activity, Settings | 10 |
| products | List, New/Edit, Detail | 4 |
| customers | List, New/Edit | 4 |
| suppliers | List, New/Edit | 4 |
| locations | List, New/Edit | 4 |
| sales | Invoice List, New Invoice, Invoice Detail, Payments | 5 |
| sales | Quotation List, New Quotation | 5 |
| inventory | Adjustment, Transfer, Count, Opening Stock | 6 |
| purchases | Purchase List, New Purchase, Purchase Detail | 6 |
| accounting | Chart of Accounts, Journal List/Detail, General Ledger | 7 |
| accounting | Trial Balance, P&L, Balance Sheet, Cash Book | 7 |
| accounting | Payables | 7 |
| accounting | Expenses, Delivery Notes, Credit Notes, Debit Notes | 8 |
| reports | Dashboard, Sales Report, Shop Comparison, GST Filing | 9 |
| reports | Expense Report, Cash Report | 9 |
| dashboard | KPI tiles, recent transactions | 9 |

---

## §3  Traceability Matrix (Selected Critical Rules)

| Legacy Requirement | Rule ID | Implementation | Test |
|-------------------|---------|----------------|------|
| GST + Non-GST separate series | BR-NUM-01 | `finalizeInvoice` enforces per-series counter | unit: invoice-numbering |
| New bill opens Without GST | DEF-016 | `InvoiceForm` default `gstEnabled: false` | manual |
| Money in integer paise | BR-FIN-01 | `packages/domain` all amounts `number` (paise) | unit: calc tests |
| Journal must balance (debit=credit) | BR-ACC-01 | `postJournalTx` throws on imbalance | unit: journal tests |
| Idempotency on duplicate request | BR-SRV-01 | `/idempotency/{requestId}` checked before every write | unit: idempotency tests |
| Owner step-up for sensitive ops | BR-SEC-01 | `assertStepUp` in restore, migration | functions test |
| Location-scoped stock | BR-INV-01 | stock movements always carry `locationId` | unit: stock tests |
| Numbering counter server-authoritative | BR-NUM-02 | `reserveDocumentNumber` + atomic transactions | unit |
| No direct Firestore writes from UI | BR-SEC-02 | `firestore.rules` deny-all on financial collections | rules test |
| Opening stock posts to journal | BR-ACC-10 | `postOpeningStock` creates journal entry | unit |

---

## §4  Security Audit

### 4.1 Firestore Security Rules

**Strategy:** deny-all default; every readable/writable path is explicit.

Key patterns verified:

| Collection | Client Read | Client Write | Notes |
|-----------|-------------|--------------|-------|
| `/users/{uid}` | own doc only | via Function | `list: false` |
| `/businesses/{b}` | isMember | never | metadata only |
| `/businesses/{b}/members/{uid}` | own doc OR members.manage | never | dual allow rule |
| `/businesses/{b}/settings/*` | isMember | never | Functions-only write |
| `/businesses/{b}/invoices/*` | sales.view | never | Function-only write |
| `/businesses/{b}/journalEntries/*` | accounting.view | never | Function-only write |
| `/businesses/{b}/stockLevels/*` | inventory.view | never | Function-only write |
| `/businesses/{b}/idempotency/*` | never | never | Function-internal |
| `/businesses/{b}/counters/*` | settings.manage | never | Function-only write |

**No client-writable financial collections found.**

### 4.2 Storage Rules

Storage rules restrict:
- Product images: `products.manage` permission required to write
- Signed-in required to read any business asset
- File size and MIME type validated server-side via Cloud Function (`setProductImage`)

### 4.3 Cloud Functions Security

Every callable follows this pattern:
1. `defineCallable(schema, handler)` validates input with Zod (rejects malformed payloads)
2. `resolveActor(request, businessId)` verifies App Check token + Firebase Auth token
3. `assertPermission(actor.member, 'permission.key')` checks role-based permission
4. Business ID in payload must match token's business claim
5. Sensitive ops (migration, restore) additionally require `assertStepUp` (5-minute reauth)

**No callable accepts arbitrary Firestore paths or unvalidated writes.**

### 4.4 Client XSS Scan

- No `dangerouslySetInnerHTML` found in production source
- No `eval()`, `new Function()`, `document.write()` in source
- All user-facing strings rendered via React's escaped JSX
- External content (customer names, product names) treated as plain text, not HTML

### 4.5 Secret Scan

```
grep -rn "privateKey|serviceAccountKey|-----BEGIN" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=lib
```

**Result:** No secrets found in source.

`VITE_*` variables are public Firebase SDK config (not service account keys). Service account credentials are accessed only via the Firebase Admin SDK in Cloud Functions (granted via ADC/IAM, never stored in source).

### 4.6 npm Audit

```
npm audit --audit-level=critical --omit=dev
```

**Critical:** 0  
**High:** 0  
**Moderate:** 8 — all in `firebase-admin` transitive chain (`uuid`, `teeny-request`, `@google-cloud/storage`) — server-side only, not shipped in client bundle.

Accepted risk: `firebase-admin` is a Google-maintained package; upstream patch expected via firebase-admin release. Monitored via Dependabot.

---

## §5  CI/CD

### `.github/workflows/ci.yml`

Triggers: push to `main` and feature branch; PR to `main`

Jobs:
1. **lint-typecheck** — `npm run lint && npm run typecheck`
2. **test** — `npm test`
3. **build** — depends on lint+test; builds web app + functions; CI-safe VITE_ fallbacks
4. **security-audit** — `npm audit --audit-level=critical --omit=dev`; grep for secrets in source

### `.github/workflows/deploy.yml`

Trigger: manual `workflow_dispatch`

Inputs:
- `environment`: `staging` | `production`
- `confirm_production`: must be `"DEPLOY"` for production

Jobs:
1. **guard** — blocks production without confirmation
2. **build-and-test** — full build with real secrets from GitHub environment
3. **deploy-functions** — rules + indexes + storage rules + functions (sequential, depends on build)
4. **deploy-hosting** — hosting (depends on deploy-functions)

Required GitHub Secrets:
- `FIREBASE_PROJECT_ID`, `FIREBASE_CI_TOKEN`
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
- `VITE_APPCHECK_SITE_KEY`, `VITE_BUSINESS_ID`

---

## §6  Migration Tooling

### `runMigration` Callable

**Callable ID:** `runMigration`  
**Auth:** owner role + step-up (5-min reauth) + App Check  
**Timeout:** 540 seconds | **Memory:** 512 MiB

#### Input Schema

```typescript
{
  businessId: string;          // destination business
  legacyBusinessId: string;    // source legacy business
  dryRun: boolean;             // true = read+validate+report only
  force?: boolean;             // bypass migration stamp (default false)
}
```

#### Collections Migrated

| Collection | Validation | Counter Seeded |
|-----------|-----------|----------------|
| products | name required | — |
| customers | name required | — |
| suppliers | name required | — |
| locations | name required | — |
| invoices | number + date required | `counters/inv` |
| purchases | number + date required | `counters/pur` |
| expenses | none (pass-through) | — |
| journalEntries | debit === credit | — |
| quotations, deliveryNotes, creditNotes, debitNotes | none | — |
| cashEntries, stockMovements, stockLevels, accounts | none | — |
| payments, members | none | — |

#### Idempotency

- Existing destination documents are **skipped** (not overwritten)
- Numbering counters seeded to `max(existing numbers) + 1`
- Migration stamp at `businesses/{b}/settings/migrationStatus` prevents re-run unless `force=true`

#### Dry-Run Mode

`dryRun: true` — reads legacy data, validates, reports. Never writes to destination.  
`dryRun: false` — executes migration; writes stamp; seeds counters.

#### Financial Reconciliation

The report includes aggregate financial totals (invoice taxable/tax/grand, purchase total, expense total, journal debit/credit) for reconciliation against legacy reports before going live.

---

## §7  Build Verification

### Typecheck

```
npm run typecheck
```
**Result:** ✓ All workspaces pass (0 errors)

### Lint

```
npm run lint
```
**Result:** ✓ 0 errors, 8 warnings (react-refresh/only-export-components — pre-existing, non-blocking)

### Web Production Build

```
npm run build --workspace apps/web
```
**Result:** ✓ built in ~8s  
**PWA:** 120 precache entries (2165 KiB), SW built (17.72 KB gzip: 5.92 KB)

### Functions Build

```
npm run build --workspace functions
```
**Result:** ✓ tsc clean

### Electron Check

```
grep -r "electron" --include="*.ts" --include="*.tsx" --include="*.json" --exclude-dir=node_modules
```
**Result:** Only reference is `electron-to-chromium` in `package-lock.json` — a browserslist transitive dep, not shipped. **No Electron in production source.**

---

## §8  Application Version

`appConfig.version` updated to `1.0.0` in `apps/web/src/config/env.ts`.

---

## §9  Known Limitations

1. **Concurrent migration writes** — `runMigration` does not lock the business during migration. The administrator must ensure no active sessions during a production migration run (documented in callable header).
2. **Migration report size** — The migration report stored in Firestore is truncated to 900 KB to stay under the 1 MB document limit. Very large migrations may lose tail of the report.
3. **npm audit moderate** — 8 moderate findings in `firebase-admin` server-side transitives; not client-exposed. Upstream fix tracked.
4. **react-refresh warnings** — 8 lint warnings for shared non-component exports in feature files. Pre-existing architectural pattern; non-blocking in production.
5. **No end-to-end test automation** — E2E tests (Playwright/Cypress) are deferred (OQ-28). Manual smoke-test checklist is provided in `deploy.yml`.

---

## §10  Rollback Strategy

1. **Functions rollback:** `firebase deploy --only functions` from previous `lib/` artifact. All callables are idempotent and forward-compatible with existing Firestore data.
2. **Hosting rollback:** Firebase Hosting version history → revert to previous deployment in Firebase Console.
3. **Rules rollback:** `git revert` the rules commit + `firebase deploy --only firestore:rules`.
4. **Data rollback:** Not automated. Pre-migration backup via `createBackupMetadata` is required before any production migration.

---

## LEGACY COMPATIBILITY CHECK

- **Existing defaults preserved:** DEF-016 (Without GST default) — unchanged; invoice form defaults `gstEnabled: false`
- **Existing settings preserved:** All business settings, integration settings, numbering series — managed via `saveBusinessSettings` / `saveIntegrationSettings`
- **Existing validations preserved:** All Phase 2–11 validations — unchanged
- **Existing calculations preserved:** BR-FIN-* (paise arithmetic, GST computation, stock valuation) — untouched in `packages/domain`
- **Existing workflows preserved:** All sales/purchase/inventory/accounting workflows — unchanged
- **Existing permissions preserved:** All 30+ permission keys from `PERMISSIONS.md` — unchanged
- **Existing document behavior preserved:** Invoice/Purchase/Quotation/DN/CN/DBN numbering, status lifecycle — unchanged
- **Existing reports preserved:** All 9 report pages — unchanged
- **Existing user-visible behavior preserved:** All Phase 2–11 behavior — unchanged
- **Deviations:** None. Phase 12 adds migration tooling and CI/CD only.
- **NOT VERIFIED items touched:** None
