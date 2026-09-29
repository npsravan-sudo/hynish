# Developer Handover — Hynish ERP v1.0.0

**Date:** 2026-09-29  
**Rebuilt from:** Hynish Clothing Wholesale Ledger ERP v2.86.1  
**Stack:** React 18, TypeScript, Vite, Firebase (Firestore, Auth, Functions v2, Storage, App Check, Hosting)

---

## Repository Layout

```
hynish/
├── apps/web/              # React PWA (Vite + Tailwind + shadcn/ui)
│   ├── src/
│   │   ├── config/        # Firebase config, app constants
│   │   ├── components/    # Shared UI components (shadcn wrappers, layout)
│   │   ├── features/      # Feature modules (one folder per domain)
│   │   ├── lib/           # Firebase clients, error reporter, utils
│   │   └── sw.ts          # Workbox service worker (injectManifest mode)
├── functions/src/         # Cloud Functions v2 (TypeScript)
│   ├── accounting/        # Chart of Accounts, Cash Book, Expenses
│   ├── auth/              # Session logging, auth context, authorization
│   ├── config/            # Firebase Admin SDK init
│   ├── inventory/         # Stock adjustments, transfers, counts, opening
│   ├── masterdata/        # Products, customers, suppliers, locations
│   ├── members/           # Member management, Firestore trigger
│   ├── middleware/        # defineCallable, Zod schema middleware
│   ├── migration/         # runMigration callable (Phase 12)
│   ├── numbering/         # reserveDocumentNumber
│   ├── purchases/         # finalizePurchase, deletePurchase, debit notes
│   ├── sales/             # finalizeInvoice, deleteInvoice, recordPayment, quotations, delivery/credit notes
│   ├── schemas/           # Shared Firestore document schemas
│   ├── settings/          # saveBusinessSettings, saveIntegrationSettings, createBackupMetadata
│   └── utils/             # Shared helpers
├── packages/domain/       # Pure business logic (no Firebase imports)
│   ├── src/
│   │   ├── calc/          # Invoice + purchase + tax calculations (paise)
│   │   ├── journal/       # Journal line builders for every transaction type
│   │   ├── stock/         # Stock movement helpers
│   │   └── constants/     # Account IDs, permission keys, magic constants
├── docs/                  # Architecture, business rules, phase completion reports
├── firestore.rules        # Firestore security rules
├── firestore.indexes.json # Composite indexes
├── storage.rules          # Cloud Storage security rules
└── .github/workflows/     # CI (ci.yml) and deployment (deploy.yml)
```

---

## Core Architectural Decisions

### Money: Integer Paise
All monetary values are stored and computed as integer paise (₹1 = 100 paise). Never use floating-point arithmetic for money. All calculation functions live in `packages/domain/src/calc/`.

### Server-Authoritative Operations
These operations MUST go through Cloud Functions — never direct Firestore writes from the client:
- Invoice / purchase finalize and delete
- Payment recording
- Stock movements (adjustments, transfers, counts, opening)
- Journal entries
- Document numbering
- Member management
- Settings writes
- Migration

Firestore rules enforce this: all financial collections deny client writes.

### Callable Pattern
Every Cloud Function callable uses this pattern:

```typescript
export const myCallable = defineCallable(
  mySchema,                              // Zod schema for input validation
  async (input, request) => {
    const actor = await resolveActor(request, input.businessId);
    assertPermission(actor.member, 'some.permission');
    // ... business logic
  },
  { timeoutSeconds: 60, memory: '256MiB' },
);
```

`defineCallable` is in `functions/src/middleware/callable.js`. It wraps `onCall` with Zod validation, App Check enforcement, and standardized error handling.

### Idempotency
Every mutating callable checks an idempotency key (`requestId` in the payload) against `businesses/{b}/idempotency/{requestId}` before executing. Double-submission returns the original result without re-executing.

### Domain Package
`packages/domain` has zero Firebase imports. It is the single source of truth for:
- GST calculation logic
- Journal line builders (which accounts to debit/credit for each transaction type)
- Stock movement computation
- Document number parsing

Import from `@hynish/domain` in both functions and web code.

---

## Permission System

Permissions are checked by `assertPermission(actor.member, 'key')` in functions and by `usePermission('key')` hook in the web app. See `docs/PERMISSIONS.md` for the full list.

Role hierarchy: `owner > manager > staff > viewer`

Each role grants a fixed set of permissions. Permissions cannot be individually overridden per member (legacy parity).

---

## Numbering

Invoice and purchase numbers are server-generated and follow legacy series rules:

- GST invoices: `INV-GST-{n}` (series: `inv-gst`)
- Non-GST invoices: `INV-{n}` (series: `inv`)
- Purchases: `PUR-{n}` (series: `pur`)

Counters live at `businesses/{b}/counters/{seriesKey}`.

BR-NUM-01: GST and Non-GST series are separate. A new invoice defaults to Non-GST (DEF-016).

---

## Local Development

### Prerequisites
- Node.js 22
- Firebase CLI (`npm install -g firebase-tools`)
- Java (for Firestore emulator)

### Setup

```bash
npm ci
cp apps/web/.env.example apps/web/.env.local
# Fill in Firebase config from your Firebase project console
```

### Emulator Mode

```bash
firebase emulators:start
# In a separate terminal:
VITE_USE_FIREBASE_EMULATORS=true npm run dev --workspace apps/web
```

### Run All Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build --workspace apps/web
npm run build --workspace functions
```

---

## Adding a New Callable

1. Create `functions/src/{module}/my-callable.ts`
2. Use `defineCallable(schema, handler, options)` pattern
3. Export from `functions/src/index.ts`
4. Add Firestore rules for any new collections
5. Add composite indexes if needed in `firestore.indexes.json`
6. Add a service in `apps/web/src/lib/firebase/functions.ts`

---

## Known Technical Debt

| Item | Location | Priority |
|------|----------|----------|
| OQ-17: multi-business support | `appConfig.businessId` hardcoded | Low — single-business now |
| OQ-28: E2E test automation | No Playwright/Cypress suite | Medium |
| OQ-13: additional library approval | `docs/OPEN-QUESTIONS.md` | Low |
| react-refresh warnings | 8 feature files export non-components | Low |
| npm audit moderate (8) | `firebase-admin` transitives | Low — upstream fix |

---

## Deployment

See `docs/DEPLOYMENT.md` for step-by-step production deployment instructions.

---

## Key Documents

| Document | Purpose |
|---------|---------|
| `docs/ARCHITECTURE.md` | System architecture overview |
| `docs/DATA-MODEL.md` | Firestore document schemas |
| `docs/SECURITY-ARCHITECTURE.md` | Security model, rules strategy |
| `docs/BUSINESS-RULES.md` | Testable business rules (BR-*) |
| `docs/LEGACY-COMPATIBILITY.md` | Feature parity inventory (LC-*, DEF-*) |
| `docs/PERMISSIONS.md` | Role/permission matrix |
| `docs/MIGRATION-PLAN.md` | Legacy data migration guide |
| `docs/OPEN-QUESTIONS.md` | Deferred decisions (OQ-*) |
| `docs/PHASE-12-COMPLETION.md` | Final phase report with security audit |
