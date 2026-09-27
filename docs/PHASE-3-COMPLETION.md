# Phase 3 — Completion Report

Domain model, data architecture & core services. This phase builds the strongly-typed,
framework-free domain foundation every later module consumes. No later-phase UI workflows were
built.

## Where it lives (adapts to the Phase 1/2 monorepo — no duplicate architecture)

| Layer | Location | Contents |
|---|---|---|
| Pure domain (shared by client + Cloud Functions) | `packages/domain/src` | money, dates, GST engine, numbering, accounting, inventory, errors, query, ids, constants/enums, legacy-defaults registry, **Zod schemas**, **fixtures** |
| Firestore infrastructure | `apps/web/src/infrastructure/{firestore,repositories}` | converters (Timestamp↔ms + Zod validation), typed paths, **repository factory + registry**, document reader |
| Domain services (client) | `apps/web/src/services` | GST calculation, settings, document-number (calls callable) |
| Server-authoritative ops | `functions/src/numbering` | `reserveDocumentNumber` callable + transaction core (KL-01 fix) |

## Implemented

**Core (`packages/domain`)**
- **Money** (integer paise): `Money.{add,subtract,sum,multiply,divide,percentage,compare,clamp,roundToRupee}`, `formatINR`, `roundHalfUp`.
- **Dates**: canonical instant = epoch ms; business date = `YYYY-MM-DD` in the business timezone; `todayISO`, `monthKey`, ranges; FY helpers.
- **GST engine** (`gst.ts`): `taxTypeFor`, `computeGstLine`, `totalsForCart`, `suggestGstRateBp` — pure, deterministic, exact legacy math.
- **Numbering** (`numbering.ts`): `formatDocumentNumber`/`parse`, `normalizeSeriesConfig`, and the `DocumentNumberService` contract.
- **Accounting** (`accounting.ts`): `DEFAULT_CHART_OF_ACCOUNTS` (14 system accounts, preserved ids), `validateJournal` (debit=credit invariant), `normalSide`, `cashOrBankAccountId`, `AccountingService` contract.
- **Inventory** (`inventory.ts`): movement types, `lowStockThreshold`(=5), `stockStatus`, `checkAvailability` (warning, not block), `toBaseQty`, `InventoryService` contract.
- **Errors** (`errors.ts`): `ValidationError`, `NotFoundError`, `ConflictError`, `AuthorizationError`, `AccountingError`, `InventoryError`, `DocumentNumberError`.
- **Query** (`query.ts`): `PageRequest`/`Page`, `Sort`, `DateRange`, `ListFilter` — cursor-pagination-ready, small and extensible.
- **IDs** (`ids.ts`): `newId` (crypto.randomUUID), `newRequestId`, `slugId` — strategy documented (§51).
- **Legacy defaults registry** (`legacy-defaults.ts`): every verified default with source citation + `migrateThemeValue`.
- **Zod schemas** (`schemas/*`): Business, Member, Location, BusinessSettings, Integration, UserPreferences, Counter, Product(+Variant), Customer, Supplier, Invoice(+Line), Quotation, DeliveryNote, CreditNote, DebitNote, Purchase(+Line), Payment, Account, JournalEntry(+Line), Expense, ExpenseCategory, CashEntry, StockLevel, StockMovement, StockTransfer, StockCount, PayrollEntry, Staff, StaffPayment, ActivityLog — plus Create/Update DTOs where useful.
- **Fixtures** (`fixtures/`): fictional, schema-valid builders for the main entities.

**Infrastructure (`apps/web`)**
- Firestore **converter** (`makeConverter`): injects doc id, deep-converts Timestamps to ms, validates with Zod (throws in dev, logs in prod). The only place `doc.data()` becomes a typed entity.
- **Repository factory** (`createReadRepository`) with `get` / cursor-paginated `list` / realtime `watch`; **`makeRepositories(businessId)`** registry for the core entities; single-document reader for settings.
- Canonical **paths** module.

**Services**
- `GstCalculationService.computeDraft` (pure preview over the domain engine).
- `createSettingsService` (reads via repo; resolves numbering config).
- `documentNumberService` (implements the domain `DocumentNumberService` by calling the callable).

**Server-authoritative numbering (the KL-01 fix, §16/§44)**
- `reserveDocumentNumber` callable: auth + per-series create-permission, then an atomic Firestore transaction that increments the counter and writes a uniqueness reservation.

## Verified (legacy compatibility, §55)

- **Numbering:** prefixes INV/NGST/QUO/DN/CN/DBN and start-sequence 1 preserved; GST and Non-GST series independent; fallback-to-default on invalid input. (tests: `numbering.test.ts`, `legacy-defaults.test.ts`, emulator `numbering.emu.test.ts`)
- **GST:** intra→CGST+SGST, inter→IGST, blank state→intra, `gstApplicable===false`→zero tax, rate suggestion (>₹2500→18% else 5%). (tests: `gst.test.ts`)
- **Settings/theme:** typed `businessSettings` preserving all identity/bank/prefix fields; light/dark migrate, unknown→system; sync-interval meaning retained (default 2, mechanism superseded). (tests: `legacy-defaults.test.ts`, `schemas.test.ts`)
- **Inventory:** low-stock default 5; shortage is a warning (`checkAvailability` never throws); movements are an immutable, auditable ledger. (tests: `inventory.test.ts`)
- **Accounting:** 14-account chart with preserved ids; journal metadata (date/location/refType/refId/refLabel/lines); debit=credit invariant enforced; COGS/Inventory relationship modelled (`unitCostPaise` on invoice lines). (tests: `accounting.test.ts`, `fixtures.test.ts`)

## Legacy limitations NOT reproduced

- Per-device counters → **server-authoritative atomic numbering** (proven collision-free under 20 concurrent reservations).
- Shared `data/main` broad-write document → normalized, permission-aware collections + typed paths.
- App-only authorization → repositories are read-only client-side; all critical writes are server-authoritative (Phase 2 rules + functions).
- Single-device deletion detection → soft-delete tombstones (`deletedAt`) in the schemas.

## Security checks (§59)

- No Firebase **Admin** SDK anywhere in the frontend. The client uses the modular Web SDK for reads only.
- Repositories perform reads/realtime; every critical write is a Cloud Function (server-authoritative).
- **"No Firestore in the UI"** is enforced by an ESLint rule denying `firebase/firestore` (and the firestore infra/lib modules) inside `apps/web/src/features/**` and `components/**`.
- Domain code has zero Firebase imports, so it cannot bypass authorization.

## Deferred (later phases, by design)

- Full billing/purchase/inventory/accounting **workflows and UI** (Phase 4+).
- Server operations `postJournal`, `recordStockMovement`, `postInvoice/Purchase/Payment` — their request/response **contracts** live in `@hynish/domain`; implementation lands with each module. `reserveDocumentNumber` is the concrete example this phase.
- Client write repositories/services for customers/suppliers etc. (their rules are server-only until their module phase).

## Known gaps / open questions touched

- OQ-03 (FY-scoped numbering reset): the counter supports `fyScoped`, defaulting to a single continuous sequence.
- OQ-05 (paise rounding granularity): per-line rounding implemented as recommended.
- OQ-11 (unverified legacy specifics): system-account numeric codes and the full ADJ_CATEGORIES/payroll-type lists are marked NOT VERIFIED in code and centralized so they change in one place once confirmed.

## Test results

- **Unit:** 101 passing — domain 62, web 28, functions 11.
- **Emulator:** 32 passing — Firestore rules 20, Storage rules 10, numbering concurrency 2.
- Lint: 0 errors (3 fast-refresh warnings). Typecheck: clean (strict). Build: succeeds.

## Next-phase prerequisites

- The domain contracts (schemas, GST engine, numbering, accounting/inventory service interfaces) are ready for Phase 4 (products/inventory) and Phase 5 (billing) to implement their callables and UI on top.
- The repository registry + converter give a typed read path any feature can use immediately via a hook.
