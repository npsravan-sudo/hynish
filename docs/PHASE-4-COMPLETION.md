# Phase 4 — Completion Report

Master Data Management. This phase delivers production-ready CRUD for the entities every later
workflow depends on — **Products, Categories, Customers, Suppliers, Locations** — end to end, from a
premium responsive UI down to server-authoritative Cloud Functions, reusing the Phase 3 layering
(UI → Hooks → Services → Repositories → Firebase). No sales/purchase/inventory/accounting/reports
workflows were built; those remain later phases.

## Where it lives (adapts to the Phase 1–3 monorepo — no duplicate architecture)

| Layer | Location | Contents |
|---|---|---|
| Pure domain | `packages/domain/src` | `gst-states.ts` (India state codes + GSTIN→state), `text.ts` (barcode/name normalization, search tokens) |
| Firestore reads | `apps/web/src/infrastructure/repositories` | existing typed read repositories (`products`, `customers`, `suppliers`, `locations`) — cursor-paginated |
| Storage | `apps/web/src/infrastructure/storage/product-image.ts`, `apps/web/src/lib/image.ts` | client compression (≤500px JPEG q0.78) + business-scoped upload |
| Write service | `apps/web/src/services/masterdata.service.ts` | the **only** write path — thin, typed wrappers over callables |
| Hooks | `apps/web/src/hooks/{use-master-data,use-paged-list,use-entity}.ts` | bind repos + service to the business; list/detail data-loading |
| Shared UI | `apps/web/src/components/{data,forms,ui}` | `DataList`, `ListToolbar`, `RowActions`, `Field`, `MoneyInput`, `Combobox` |
| Feature pages | `apps/web/src/features/{products,customers,suppliers,locations}` | list / new / detail / edit per entity + categories view |
| Server-authoritative writes | `functions/src/masterdata/*` | `saveProduct`/`setProductActive`/`setProductImage`, `saveCustomer`/`setCustomerActive`, `saveSupplier`/`setSupplierActive`, `saveLocation`/`setLocationActive` |
| Server validation | `functions/src/masterdata/validation.ts` | pure product business-rule guards (unit-tested) |
| Rules | `firestore.rules`, `storage.rules` | client writes to master-data collections denied; product-image upload = owner/admin |
| Indexes | `firestore.indexes.json` | name-ordered + category + search-token composite indexes |

## Implemented

### Products (§7–§13)
- List with **cursor pagination** (no full-collection loads), client-side substring search (legacy
  parity BR-RPT-08), **category filter**, **status filter** (Active / All), responsive table↔cards.
- Create/edit form: name, category (free-text `Combobox` with suggestions), HSN, unit, barcode,
  wholesale/purchase price (`MoneyInput`, integer paise), GST rate (with `suggestGstRateBp`),
  low-stock threshold, **variants** (size/colour, add/remove) and **alternate units**.
- Detail view: overview, pricing & GST, alternate units, variants, photo.
- **Photo lifecycle** (fixes legacy KL-03): client compresses → uploads to
  `businesses/{b}/products/{productId}/{imageId}.jpg` → `setProductImage` records the path and
  **deletes the previous object server-side**, so images are never orphaned.
- Activate/deactivate = **soft-delete** (archive), never hard delete; history stays valid.
- **Barcode uniqueness** enforced server-side, case-insensitively, via a transactional
  `barcodes/{normalizedCode}` index (fixes the legacy client-only check).

### Categories (§ derived)
- Legacy has **no separate category entity** — categories are free-text strings on products. So the
  Categories page is a **derived view** (distinct categories + live product counts) and the product
  form offers them as free-text `Combobox` suggestions. Clicking a category deep-links to the
  filtered product list. No invented entity, no migration.

### Customers (§14–§18)
- List / create / edit / detail / archive. **GSTIN normalized to upper-case**; **state auto-derived**
  from the GSTIN (BR-GST-15/16) and stored as a structured `stateCode` for future intra/inter-state
  GST. Credit limit in paise. B2C (no GSTIN) supported. GST *calculation* stays in the Phase 3
  domain service — this phase only captures the data.

### Suppliers (§19–§20)
- Mirror of customers (name, contact, GSTIN + state, city, phone, address) with `suppliers.*`
  permissions. Archive is soft-delete so purchases keep their details.

### Locations (§21–§23)
- Business-scoped list / create / edit / detail. Managed by `locations.manage` (owner/admin — an
  unrestricted role), enforced **server-side**, not UI-only. Fields: name, type (shop/warehouse),
  address, opening cash balance, default flag, sort order.
- **At least one active location must remain** (BR-LOC-01): archiving the last active location is
  refused transactionally. Archive is soft-delete so stock/journal references stay valid (BR-LOC-02).
- Location *locking* dependency for Phase 5 is documented (see MIGRATION-PLAN / ARCHITECTURE).

## Security (Phase 2 model honoured)
- **All writes are server-authoritative.** Firestore rules deny client writes to `products`,
  `customers`, `suppliers`, `locations`, and the `barcodes` index; every mutation flows through a
  Cloud Functions callable.
- Each callable runs the Phase 2/3 pipeline: App Check + auth + reauth window + Zod, then
  `resolveActor` → `assertPermission` → (where relevant) `assertLocationAccess`, with business
  isolation from `resolveActor`.
- Permission model: `products.manage`/`products.delete` = owner/admin; `customers.manage` = shop+
  (`customers.delete` admin-only); `suppliers.manage` = manager+; `locations.manage` = owner/admin.
- Product-image upload tightened to owner/admin (`products.manage`); reads remain any member.
- **Audit logging** for every create/update/activate/deactivate via the Phase 3 immutable
  `activityLog`, written atomically in the same batch/transaction as the mutation.

## UI/UX
- Premium components reused from the design system; responsive **360–1920px** (tables collapse to
  cards on mobile); **Light / Dark / System**; accessible fields (labels, `aria-invalid`, hints).
- **Confirmation dialogs** via the app's `confirm()` (never `window.confirm`); **toasts** for
  success/error; loading / empty / error states on every list and detail.
- Friendly server-error mapping via `mapCallableError` (typed `details.code` → message).
- Navigation: **Categories** entry added; Products/Suppliers/Locations/Customers now route to the new
  master-data pages with `new` / `:id` / `:id/edit` sub-routes, guarded by permission.

## Data & indexes
- Firestore is search-limited by design: lists order by `nameLower` and filter by
  `deletedAt == null` for Active; composite + array (`searchTokens`) indexes are declared in
  `firestore.indexes.json`. Arbitrary full-text search is intentionally **not** implemented.

## Tests
- **Domain unit** — `gst-states.test.ts` (state derivation, name lookup, GSTIN validation),
  `text.test.ts` (barcode/name normalization, search-token prefixes, cap).
- **Functions unit** — `masterdata/validation.test.ts` (duplicate variants, alt-unit rules,
  barcode-slash rejection).
- **Firestore rules (emulator)** — `tests/rules/masterdata.test.ts`: client writes to
  products/customers/suppliers/locations/barcodes denied for everyone (incl. owner); reads gated by
  permission; any member reads locations.
- **Storage rules (emulator)** — updated `tests/rules/storage.test.ts`: owner/admin may upload,
  a non-admin member is denied, cross-business + non-image + oversize denied, member reads succeed.

## Verification (Definition of Done)
- `npm run build:domain` ✅
- `npm run typecheck` (domain + web + functions) ✅
- `npm run lint` ✅ (0 errors; only pre-existing `react-refresh` warnings)
- `npm test` — domain 77, web 28, functions 19 ✅
- `npm run test:rules` — 40 passed (Firestore + Storage emulator) ✅
- `npm run build` (web) ✅

## Explicitly out of scope (later phases)
Invoicing, quotations, delivery/credit/debit notes, payments, purchasing, stock movements/counts/
transfers, accounting, reports, dashboard, payroll. No Electron / `.exe` / Windows installer /
desktop wrapper — browser/PWA only.
