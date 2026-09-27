# Hynish Clothing — Wholesale Ledger ERP: Technical Documentation

**Prepared for**: handoff to a developer unfamiliar with this codebase
**App version at time of writing**: v2.86.1
**Scope**: every module, every business rule, every piece of sync/accounting logic in the application — written directly from a full read of every source file, not from documentation or memory.

## How to read this document

This is a from-the-source technical reference for the entire Hynish Clothing app — a single-page, no-framework JavaScript ERP covering billing, inventory, GST (Indian tax) compliance, double-entry accounting, and multi-device/multi-shop cloud sync, distributed both as a web app / PWA and as a packaged Windows desktop app (Electron).

Each major section below documents one source file (or a tightly coupled pair of files) end-to-end: its data model, every function's exact behavior, validation rules, and — importantly — the honest caveats and known limitations the code itself flags in its comments. Nothing here is a summary written from a high level; every function name, field name, and formula is taken directly from the code.

Read this top-to-bottom for a full picture, or jump to the section for the file you're changing. The final two sections ("PWA, Packaging & Deployment" and "Known Limitations & Honest Caveats") pull together cross-cutting concerns that span multiple files.

## Source files covered

| File | Lines | What it is |
|---|---|---|
| `app.html` | 1,644 | The single HTML entry point: global state, auth gate, render loop, GST math, cross-cutting helpers |
| `src/admin.js` | 1,213 | Dashboard, Settings, Shop Comparison, Reports, Activity Log, WhatsApp drafts, Delivery Note PDFs, payment recording |
| `src/inventory.js` | 2,124 | Products/variants, multi-location stock, transfers, barcodes, purchases, reorder planning |
| `src/sales.js` | 2,209 | Customers, New Bill/GST engine consumer, Quotations, Delivery Notes, Credit/Debit Notes, invoice PDFs |
| `src/finance.js` | 1,431 | Chart of Accounts, double-entry journal, Trial Balance/P&L/Balance Sheet, Cash Book, Expenses, GST Filing, Payroll |
| `src/sync-engine.js` | 377 | Firebase Auth/membership, whole-document interval sync, Business Settings real-time sync |
| `src/sync-rules.js` | 26 | The pure merge algorithms (`mergeCollectionById`, `mergeProductImages`, `syncRecordsForCollection`) — isolated for testability |
| `service-worker.js` | 69 | PWA offline shell caching, same-origin-only fetch interception |
| `manifest.json` | 13 | PWA manifest |
| `firebase.json` | 69 | Firebase Hosting/Firestore/Storage deployment config |
| `firestore.rules` / `storage.rules` | — | Security rules for Firestore and Cloud Storage |
| `package.json` / `main.js` | — | Electron desktop packaging |

---

## 1. Architecture Overview

**No framework.** This is a hand-rolled single-page app. A single `render()`/`renderNow()` pair does a full `innerHTML` rebuild of `#app` on every state change — there is no virtual DOM, no component tree, and no build step. All application state lives in module-scope `let` variables declared at the top of `app.html`.

**Backend: Firebase only, no custom server.** Firebase Auth provides one email/password account per device/shop (provisioned by hand in the Firebase Console — there is no sign-up flow in the app). Firestore holds all business data under `businesses/{businessCode}/...`. There is no Node/Express/custom API layer anywhere in this stack.

**Two coexisting sync mechanisms**, both active simultaneously by design:

1. **Whole-document interval sync** (the original mechanism, `src/sync-engine.js` + `src/sync-rules.js`): every `syncIntervalMinutes`, the entire local state for ~20 collections is merged against one big Firestore document, `businesses/{businessCode}/data/main`, via `mergeCollectionById()` — a 3-way merge keyed by record id, with same-device-only deletion detection (see §7 for the exact algorithm and its known blind spot).
2. **Real-time per-record sync** (added incrementally, newest first): Firestore `onSnapshot()` listeners on their own dedicated collections/documents, for **Customers**, **Suppliers**, **Products**, **Invoices**, **Stock Movements**, **Business Settings**, and **Locations** — each with its own `enableRealtimeX()`/`disableRealtimeX()` pair, its own migration-on-first-enable logic, and its own conflict-resolution strategy (blind-replace for simple collections like Customers/Suppliers; diff-and-push for high-churn collections like Products/Invoices; pure-additive for the immutable Stock Movements ledger; max()-merge for Business Settings' numeric counters).

Running both at once for the same collection is deliberate, not an oversight: the interval sync is described in the code as a safety net for any device that hasn't turned on real-time sync for a given collection, and the occasional redundant whole-document write it produces is explicitly documented as harmless.

**Authentication and access control.** Every device signs in with its own Firebase email/password account — there is no local username/password system anymore (it was retired; see §2.4 in the App Shell section for the history). Access to the whole app is gated on that account having an `active:true` membership document at `businesses/{businessCode}/members/{uid}` in Firestore. A membership doc's `role` (`owner`/`admin` vs `shop`), `locationName`, and `tabs` map drive admin-vs-shop permissions and which tabs a given shop account can see.

**GST (Indian tax) engine.** A single shared engine (`taxTypeFor`, `computeLineForTaxType`, `totalsForCart` — all in `app.html`) decides CGST+SGST (intra-state) vs IGST (inter-state) by comparing the business's own state to the customer's state, and is reused identically by Invoices, Quotations, Delivery Notes, and Credit/Debit Notes. A separate, fully independent numbering series exists for "Without GST" bills so the main GST-applicable invoice sequence never skips a number.

**Double-entry accounting.** Every business event that has a financial effect (a sale, a purchase, an expense, a payroll payment, a credit/debit note, a recorded payment) posts through one single gateway, `postJournal()` (in `finance.js`), which refuses to post anything that doesn't balance to zero. Trial Balance, Profit & Loss, and Balance Sheet are all computed live from the journal — nothing is pre-aggregated or cached.

**Packaging.** The same `app.html` + `src/*.js` + `vendor/*` file set is served three ways: as a hosted PWA (Firebase Hosting, `manifest.json` + `service-worker.js`), as a packaged Windows desktop app (Electron, via `main.js`/`package.json`/electron-builder), or opened directly as a local file — the code guards every browser-only API (service worker registration, `window.storage`) so it degrades gracefully in whichever context it's running.

The sections below document each file in full detail.

---

## 2. Core Application Shell (app.html)

Source: `/home/claude/hynish_web/app.html` (1,644 lines total). The file is the single HTML entry point: a `<head>` that loads vendored libraries and `styles.css`, a body containing three empty DOM roots (`#app`, `#toast-root`, `#confirm-modal-root`, `#print-area`), five separately-loaded `<script src="src/...">` files (`sync-rules.js`, `finance.js`, `inventory.js`, `sales.js`, `sync-engine.js`, `admin.js`), and then one large inline `<script>` block (lines 48–1641) that holds global state, storage plumbing, the auth/session gate, the render shell, and thin business-logic helpers. Note: most of the actual per-tab `render*()` view-builder functions (e.g. `renderDashboard`, `renderProducts`, `renderCustomers`) referenced by `renderByTab()` are **not defined in app.html** — only their section markers, a handful of local helpers, and their module-level `let` state live here; the bulk of each tab's UI/logic is implemented in the separately-loaded `src/*.js` files. app.html itself is best understood as the shell: bootstrap, storage, auth, global state, render loop, and cross-cutting helpers (GST math, numbering, PDF text layout, sync scaffolding).

### 2.1 Overall Architecture

- **No framework.** This is a hand-rolled single-page app: a giant `render()`/`renderNow()` pair does a full `innerHTML` rebuild of `#app` on every state change — there is no virtual DOM or diffing of individual nodes (aside from two narrow exceptions: `patchCell()` and `renderAdjVariants()`, see §2.2).
- **Vendored libraries** loaded as plain `<script>` tags before the app script: `vendor/jspdf.umd.min.js` + `jspdf.plugin.autotable.min.js` (PDF export), `vendor/JsBarcode.all.min.js` (barcode rendering), `vendor/firebase-{app,auth,firestore,storage}-compat.js` (Cloud Sync — loads harmlessly even when not configured; every call site checks `typeof firebase` before using it), and `vendor/zxing-index.min.js` (camera barcode scanning, likewise guarded by `typeof ZXing` checks).
- **Storage abstraction** (`HAS_CLAUDE_STORAGE` / `getKey` / `setKey`, lines 189–233): the app can run either as a Claude.ai in-chat artifact (using `window.storage.get/set`, an async key/value API) or standalone (double-clicked file, hosted page, Electron-packaged desktop app), in which case it falls back to `localStorage` under keys prefixed `wledger:`. `HAS_CLAUDE_STORAGE` is computed once as a boolean feature check, and every `getKey`/`setKey` call transparently branches on it, with both wrapped in try/catch so a storage failure never throws — `getKey` returns the caller's `fallback` and `setKey` just logs to console.
- **Top-level global state** (`let` declarations, lines 65–187) — the whole app's runtime state lives in module-scope variables, not a store/reducer. Major ones:
  - Core data collections loaded from storage: `settings`, `products`, `customers`, `invoices`, `suppliers`, `purchases`, `stockMovements`, `physicalCounts`, `quotations`, `deliveryNotes`, `creditNotes`, `debitNotes`, `activityLog`, `expenses`, `expenseCategories`, `locations`, `transfers`, `cashEntries`, `productImages`, `whatsappCampaigns`, `accounts`, `journalEntries`, `payrollEntries`, `staffMembers`, `staffPayments`.
  - Session/auth: `currentUser`, `lastAuthAt`, `firebaseGateError`, `firebaseGateBusy`, `interactiveSignInInFlight`.
  - Draft/in-progress editing state per document type: `draft` (invoice), `purchaseDraft`, `quoteDraft`, `dnDraft`, `cnDraft`/`dbnDraft`, `transferDraft`, plus a `lastSaved*Id`/`viewing*Id`/`editing*Id` triple for most document types.
  - Navigation/UI chrome: `activeTab`, `sidebarOpen`, `sidebarCollapsedGroups`, `profileMenuOpen`, `globalSearchQuery`/`globalSearchOpen`, `notifPanelOpen`, `currentLocationId`.
  - Cloud Sync bookkeeping: `firebaseInitialized`, `firebaseMembershipVerifiedUid`, `cloudSyncTimer`, `lastSyncSnapshot`, `cloudSyncStatus`, plus, per real-time-enabled collection, a `<name>RealtimeActive` flag and `<name>Unsubscribe` handle (customers, suppliers, products, invoices, stockMovements, businessSettings, locations), and diff/push snapshots (`lastPushedProductsSnapshot`, `lastPushedInvoicesSnapshot`, `pushedStockMovementIds`, `lastPushedBusinessSettingsSnapshot`).
  - Constants: `GST_STATE_CODES` (all 38 GST state/UT codes → names), `STATES`, `GST_RATES = [0,0.25,3,5,12,18,28,40]`, `UNITS = ["Pcs","Set","Pair","Mtr","Kg","Box","Dozen"]`, `ADJ_CATEGORIES` (stock adjustment reason codes), `CASH_IN_CATEGORIES`/`CASH_OUT_CATEGORIES`, `TOGGLEABLE_TABS`, `TAB_LABELS`, `DEFAULT_SHOP_TABS`, `APP_VERSION`.

### 2.2 The Render Cycle

- **`render()`** (line 843) is a one-line trampoline: `setTimeout(renderNow, 0)`. The comment explains why the defer matters: if a field's `onchange` handler called this synchronously during a blur (e.g. right before a button click), replacing the DOM mid-click can cause the click itself to be lost. Deferring by one tick lets the current click/event finish against the existing DOM first.
- **`renderNow()`** (line 928) does the actual rebuild:
  1. Toggles a `billing-mode` class on `#app` when `activeTab==='new-invoice'`.
  2. If `isFirebaseGateActive()` (i.e. `!currentUser`), replaces `#app` with `renderLoginScreen()` and focuses the email field, then returns early — nothing else in the app renders until sign-in succeeds.
  3. **Focus preservation**: before touching the DOM, it records `document.activeElement` if it has a `dataset.focusKey` and is inside `#app`, along with `selectionStart`/`selectionEnd`. After the rebuild, it re-queries `[data-focus-key="<key>"]` in the new DOM, calls `.focus()`, and restores the selection range. This is how a full innerHTML teardown/rebuild doesn't lose the user's cursor position — any field that needs to survive a re-render must carry a `data-focus-key` attribute.
  4. **Sidebar scroll preservation**: captures `.sidebar`'s `scrollTop` before replacing `#app.innerHTML`, then restores it onto the newly created `.sidebar` element afterward.
  5. Rebuilds `#app` from `sidebarHtml()` + `topbarHtml()` + `viewHtml()` (the latter inside `<div id="main">`), plus a skip-link and sidebar backdrop.
  6. Special-cases one non-full-render patch: if on the `ledger` tab and an `#adj_product` element exists, calls `renderAdjVariants()` separately (a targeted DOM patch rather than a full rebuild).
- **`patchCell(id, text)`** (line 841): updates a single element's `textContent` by id without touching the rest of the DOM — used by numeric field handlers on invoice line items so editing one field never disturbs focus on a sibling field or risks eating a nearby button click.
- **Toasts** (`showToast`/`dismissToast`/`renderToasts`, lines 844–874) render into their own dedicated `#toast-root`, entirely independent of the main render cycle, because a toast's auto-dismiss `setTimeout` could otherwise fire mid-keystroke and wipe unsaved input via a full `app.innerHTML` replace.
- **Confirm modal** (`showConfirmModal`/`closeConfirmModal`/`confirmModalProceed`/`renderConfirmModal`, lines 881–927) similarly renders into its own `#confirm-modal-root`. It's async-callback based (`onConfirm`) rather than the blocking native `confirm()`, restores whatever had focus before it opened, and implements a minimal Tab/Shift+Tab focus trap plus Escape-to-close.

### 2.3 Settings Object — `defaultSettings()` (lines 194–203)

Returns the canonical shape merged into loaded settings on every boot (`loadAll()` spreads `{...defaultSettings(), ...settings}`, and does the same one level deeper for `firebase`). Fields:

- **Business identity**: `businessName`, `gstin`, `address`, `city`, `state`, `pincode`, `phone`, `email`, `businessLogo`, `licenseKey`.
- **Document numbering counters**: `invoicePrefix`/`nextInvoiceSeq` ("INV"/1) for GST-applicable invoices, `invoicePrefixNoGst`/`nextInvoiceSeqNoGst` ("NGST"/1) as a separate local-only series for Without-GST bills, `quotePrefix`/`nextQuoteSeq` ("QUO"/1), `dnPrefix`/`nextDnSeq` ("DN"/1), `cnPrefix`/`nextCnSeq` ("CN"/1), `dbnPrefix`/`nextDbnSeq` ("DBN"/1).
- **Bank details**: `bankName`, `bankAccount`, `bankIfsc`.
- **UI preference**: `theme` ("light"/"dark").
- **`whatsapp`** sub-object: `{provider, apiKey, phoneNumberId, businessAccountId, notes}`.
- **`firebase`** sub-object: hardcoded project credentials (`apiKey`, `authDomain`, `projectId: 'hh-erp-2026'`, `storageBucket`, `messagingSenderId`, `appId`), `businessCode: 'hh-erp-2026'`, `authEmail`, `enabled`, `syncIntervalMinutes` (default 2), `lastSyncedAt`, `productPhotosToStorage`, and one `realtime<X>Enabled` boolean per real-time-sync-capable collection.

### 2.4 Authentication & Permissions

Every device signs in with its own Firebase email/password account (provisioned once via the Firebase Console). There is no local username/password system — the Firebase account IS the login for every shop and the admin account alike. Access to the whole app (not just Cloud Sync) is gated on the signed-in account having an `active:true` membership document at `businesses/hh-erp-2026/members/{uid}` in Firestore, checked via `verifyFirebaseMembership()` (in `src/sync-engine.js`). Re-login is forced periodically even though Firebase's own session would otherwise persist indefinitely.

- **`doFirebaseLogin()`** (line 406): reads `#login_email`/`#login_pass`, validates both non-empty, sets `firebaseGateBusy=true` and renders, sets `interactiveSignInInFlight=true`, calls `initCloudSync()`, then `firebase.auth().signInWithEmailAndPassword(...)`, and on success awaits `applySignedInFirebaseUser(credential.user)`. On failure sets `firebaseGateError` via `friendlyFirebaseError(e)`. `interactiveSignInInFlight` is reset in a `finally` block regardless of outcome.
- **`applySignedInFirebaseUser(user, {isRestoredSession=false})`** (line 430) is the single end-to-end path for both a fresh interactive login and a Firebase-restored session on app boot:
  1. `verifyFirebaseMembership(user)` — throws (and signs the account back out itself) if not an active member.
  2. Reads the membership doc via `businessMembershipRef(user.uid).get()`.
  3. **Re-auth expiry check**: if `isRestoredSession && !reAuthStillValid()`, force-signs-out, clears `currentUser`, shows "Your sign-in has expired." — only fires for a *restored* session, never a fresh interactive login.
  4. Computes `isAdmin = m.role==='owner' || m.role==='admin'`.
  5. Resolves `homeLoc` for non-admins with a `locationName` on their membership doc, matching case/whitespace-insensitively against `locations[].name` (this comes from a Firestore field typed by hand in the Console, so a stray capital letter or trailing space shouldn't silently turn a shop account into an unrestricted one). If a `locationName` doesn't match any location, it warns to console and leaves the account **unrestricted** until fixed.
  6. Builds `currentUser = {id, email, username, role, isAdmin, locationName, homeLocationId, tabs}` — `tabs` comes from the membership doc's `m.tabs` if present, else `DEFAULT_SHOP_TABS` for non-admins or `null` (all) for admins.
  7. First-ever-connect bootstrap — see §2.5.
  8. `lastAuthAt = Date.now()`, persisted.
  9. `enforceHomeLocation()` restricts `currentLocationId` for location-locked accounts.
  10. Only for a genuinely new interactive login: logs `login` activity and resets `activeTab='dashboard'`.
  11. `restartAutoSync()` and `reconnectRealtimeSyncOnLogin()` run on every login, restored or fresh.
  - Catch block: on failure, `currentUser=null`; if the error is tagged `e.isMembershipCheckNetworkError` (set in `verifyFirebaseMembership`), shows a network-specific message instead of a generic auth-failure one, since only the Firestore membership read failed, not necessarily the credentials.
- **`interactiveSignInInFlight` race fix** (lines 100–111): Firebase's `onAuthStateChanged` fires for every sign-in, including one `doFirebaseLogin()` just triggered. Without this flag, two concurrent `applySignedInFirebaseUser()` calls could run for the same fresh login — the listener's call (`isRestoredSession:true`) could reach its `reAuthStillValid()` check before `doFirebaseLogin()`'s own call had set `lastAuthAt`, and on a device that's never signed in before (`lastAuthAt===null`) would incorrectly sign a brand-new login straight back out seconds later. `init()`'s listener checks `if(interactiveSignInInFlight) return;` to skip the redundant concurrent call.
- **`onAuthStateChanged` listener** (in `init()`, line 691): fires once immediately with Firebase's restored session (or `null`), then again on every future sign-in/out. Calls `applySignedInFirebaseUser(user, {isRestoredSession:true})` if a non-anonymous user is present and no interactive sign-in is in flight; otherwise clears `currentUser` and renders the login screen.
- **`reAuthStillValid()`** (line 369): `REAUTH_MAX_AGE_DAYS = 30`; `!!(lastAuthAt && (Date.now()-lastAuthAt) < 30*24*60*60*1000)`.
- **Role-based tab restriction**: `canAccessTab(tab)` (line 372) returns `false` with no `currentUser`; `true` unconditionally for admins; hard-blocks `settings`/`users`/`locations` for non-admins; grants the virtual `'stock'` grouping tab if any of `ledger`/`stockcount`/`reorder` is granted; otherwise checks `currentUser.tabs[tab]`. `DEFAULT_SHOP_TABS` (lines 210–214) covers day-to-day billing/stock work and never Settings, Users, Locations, Accounting, Cash Book, Expenses, Dues, or GST Filing — an owner can grant a custom set per shop via a `tabs` object on that account's membership doc.
- **Home-location enforcement**: `homeLocationId` on `currentUser` plus `enforceHomeLocation()` restricts a location-bound shop account's `currentLocationId`; the sidebar's location `<select>` is hidden and replaced with a fixed label for restricted users.
- **Sign-out — `doLogout()`** (line 560): logs a `logout` activity entry, signs out of Firebase (guarded), clears `firebaseMembershipVerifiedUid`/`currentUser`/`lastAuthAt`, resets `activeTab`, closes the sidebar, re-renders.
- **Staff directory note**: `staffMembers`/`staffPayments` (lines 117–125) is a *named* permanent-staff directory (Payroll & Activity → Staff tab), explicitly separate from location-keyed payroll, since staff no longer have their own login accounts — it exists purely as a payroll record with no auth relationship.

### 2.5 First-Ever-Connect Bootstrap & Reconnect-on-Login

- **`firstEverConnect`** (inside `applySignedInFirebaseUser`, line 470): computed as `!settings.firebase.enabled` *before* setting it true — i.e. true only the very first time any account signs in successfully on this device/browser, and never again afterwards. When true: `settings.firebase.enabled=true`, `authEmail` recorded, `syncIntervalMinutes` defaults to 2 if unset — so a shop signing in for the first time is sharing data immediately without visiting Settings to flip six toggles manually.
- Still inside that branch, it fires (fire-and-forget) `retryEnableOnFirstConnect()` for every real-time-sync collection: customers, suppliers, products, invoices, stock movements, business settings, locations.
- **`retryEnableOnFirstConnect(enableFn, isActiveFn, label, attempts=4, delayMs=3000)`** (line 538): retries a first-time `enableRealtimeX(true)` call up to 4 times, 3 seconds apart, checking `isActiveFn()` after each attempt rather than trusting a `.catch()`, because `enableRealtimeX(true)` swallows its own errors by design (`silent=true`). This fixes a real bug (v2.86.1): a single transient failure on first connect (slow network, cold IndexedDB cache, several `enablePersistence()` calls racing) used to leave a `realtimeXEnabled` flag permanently `false` forever, since `reconnectRealtimeSyncOnLogin()` only reconnects collections whose flag is *already* true — for Business Settings and Locations specifically, nothing else in the app ever pulls that data back down otherwise, so a device could be stuck showing blank Business Details or a stale location list forever with no indication why. If all attempts fail, it logs a console error and gives up — stays off until manually enabled in Settings.
- **`reconnectRealtimeSyncOnLogin()`** (line 550): runs on every login (fresh or restored), unconditionally re-subscribing whichever real-time collections were previously left "on," because the underlying `onSnapshot()` listeners are purely in-memory and never survive an app restart even though Settings still shows them enabled.

### 2.6 PWA Bits Referenced Here

- **`APP_VERSION = '2.86.1'`** (line 977): single source of truth for the version shown in the sidebar footer and Settings → About. Bump this alongside `package.json`'s version and `service-worker.js`'s `CACHE_NAME` on every release (a past drift bug once left the sidebar footer two releases behind).
- **Manifest link**: `<link rel="manifest" href="manifest.json">` plus PWA meta tags — inert unless served over HTTPS (or localhost) alongside `manifest.json` + `service-worker.js` + icons; harmless no-op as a local file or in Electron.
- **Service worker registration** (lines 806–810): only attempts registration under HTTPS or localhost; silently no-ops otherwise (including Electron or `file://`).

### 2.7 Other Significant Business Logic / Cross-Cutting Rules

- **GST engine** (lines 626–661): `taxTypeFor(customerId)` compares `settings.state` (seller) to the customer's state; returns `"intra"` if equal (or either is blank) and `"inter"` otherwise. `computeLineForTaxType(item, taxType)` computes `taxable = qty*rate - discount%`, splitting `cgst=sgst=taxable*rate/2/100` for intra or `igst=taxable*rate/100` for inter. `totalsForCart(items, taxType)` sums line taxables/taxes, rounds, and returns `roundOff` as the rounding delta. `draftTaxType()`/`computeLine(item)` are New-Bill-specific wrappers over the same engine, with an explicit carve-out that `draft.gstApplicable===false` zeroes all tax fields *only* for the New Bill draft — Quotations/DNs/CN-DBNs always use the full generic engine.
- **`suggestGstRate(price)`** (line 341): `>2500 ⇒ 18%`, else `5%` — a suggestion only, not enforced.
- **`stateFromGSTIN(g)`**: derives state name from a GSTIN's first two digits via `GST_STATE_CODES`.
- **Indian numbering words** (lines 605–623): converts an amount into Crore/Lakh/Thousand/Hundred words for "Amount in Words" on printed invoices.
- **Financial year label** — `fyLabel(dateStr)` (line 343): Indian FY starts in April; month ≥4 ⇒ `year–year+1`, else `year-1–year`, formatted two-digit-two-digit (e.g. "2425").
- **Stock ledger model** (lines 575–603): every product variant stores stock per-location as `variant.stockByLocation = {[locationId]: qty}`; `logMovement()`/related helpers here are the ONLY places that should read/write that object. `logMovement(m)` appends an immutable audit entry to `stockMovements`. `movementBadge(type)` maps movement types to a badge CSS class + label.
- **Low-stock threshold**: `lowStockThresholdFor(p)` overrides a default of 5; Dashboard, notifications, and the Products list all read from the same helper so a custom threshold is never only honored in some of them.
- **Data migrations run on every `loadAll()`** (lines 234–301): expenses recorded before per-location tracking existed are backfilled with `locationId = locations[0].id`; legacy flat-stock products (pre-variants) are migrated to a single `{id:'default',...}` variant with `stockByLocation` seeded from the old flat `stock`; `expenseCategories`/`accounts`/`locations` are seeded from defaults if empty; `currentLocationId` falls back to `locations[0].id` if invalid.
- **Date-input sanitization** (lines 727–736): a native date field whose value doesn't match strict `YYYY-MM-DD` with a year in 1990–2200 is force-cleared, guarding against a browser quirk producing nonsense dates like `0002-09-15`.
- **Enter-key-as-Tab navigation** (lines 742–760): Enter in a visible input/select advances focus to the next field, since the app doesn't use native form submission. Skips `#product-code-input` and `#global-search-input`, which have their own Enter handling.
- **Ctrl+K / Cmd+K** focuses global search from anywhere; Escape closes global search/notification panel/profile menu or the confirm modal.
- **Click-outside-closes** (lines 793–799): closes global search, notification panel, profile menu, or product search dropdown on an outside click.
- **Tab/navigation configuration**: `sidebarHtml()` groups tabs into fixed `NAV_GROUPS`, filtering through `canAccessTab()` and dropping empty groups. `setTab(tab)` (line 813) is the sole navigation entry point: re-checks access, lazily initializes drafts, resets saved/viewing/editing state on tab-leave, closes the mobile drawer, scrolls to top.
- **Global search** (lines 1103–1116): case-insensitive substring match, capped at 5 per category, across products/customers/invoices/quotations/purchases.
- **System alerts / notification bell** (lines 1094–1102): low-stock count summed across every variant at `currentLocationId`; overdue invoices are `(grandTotal-paidAmount)>0.5` with a past `dueDate` — the same logic Dashboard and Outstanding Dues use, centralized so the two never disagree.
- **PDF text-block layout helper** — `pdfBlock(doc, text, x, y, maxWidthMm, lineHeightMm)` (line 1361): fixes a real layout bug where every printed document used to place its customer/supplier block at hardcoded Y offsets that a long free-text address could overflow into. Wraps via `doc.splitTextToSize()` and returns the actual Y position below the block so callers chain calls without overlap.
- **`pdfItemCode(it)`** (line 1372): looks up a line item's product/variant code live from the current `products` array, not a saved snapshot, so old printed documents show the product's *current* code; returns `''` if deleted since.
- **Cloud Sync architecture comments** (lines 1464–1626) document the design in detail even though little of the actual sync code lives in app.html — see §7 for the full picture, including the invoice-numbering-collision open issue and the Locations resurrection-bug fix history.
- **`escapeHtml`, `cap`, `money`, `fmtDate`, `fmtDateShort`, `downloadCSV`, `csvEscape`, `uid`, `todayISO`** (lines 330–356): shared formatting/utility helpers (money via `toLocaleString('en-IN', ...)`; `uid()` is `Date.now().toString(36) + Math.random().toString(36).slice(2,8)` — not cryptographically unique but effectively collision-free at this app's scale).
- **Business-name gate** (`viewHtml()`, line 1219): if `settings.businessName` is empty and the tab isn't Settings, a non-blocking warning banner is prepended above normal content.
- **`activityLabel`/`ACTIVITY_LABELS`** (lines 1263–1280): maps ~25 activity-log action codes to human-readable phrases.
- **Alt units / unit conversion** (lines 1292–1301): `product.altUnits: [{name, factor}]`; `toBaseQty(product, qty, unitName)` converts any alt-unit quantity back to base units for stock deduction.

---

## 3. Administration, Settings & Dashboard (admin.js)

`admin.js` (1,213 lines) implements: the home Dashboard, the entire Business Settings screen, Shop Comparison / cross-location reporting, Sales Reports, the Payroll & Activity screen *shell* (Activity Log is implemented here; the Staff/Payroll sub-tabs live in `finance.js`), WhatsApp campaign drafting, Delivery Note preview/PDF generation, payment recording against invoices/purchases, manual stock adjustments, Credit/Debit Note draft-line recalculation, and GST CSV exports.

### 3.1 Dashboard — `renderDashboard()`

**Greeting & header:** time-of-day greeting from `new Date().getHours()`. Shows current user, current location, today's date.

**KPIs:**
- **Today's Sales** — sum of `grandTotal` for invoices dated today, plus bill count. "vs yesterday %" only shown if yesterday's sales were >0. **Not location-scoped** — sums across all locations.
- **Month vs last month** — same pattern, calendar-month scoped, also not location-scoped.
- **Outstanding Dues** — `Σ max(0, grandTotal - paidAmount)` across all invoices (all locations), plus a distinct-customer count where the gap exceeds 0.5.
- **Low Stock count** — *is* location-scoped: counts variants where stock at `currentLocationId` ≤ `lowStockThresholdFor(p)`.
- `computeSystemAlerts()` and a `recentActivity` slice are computed but **not actually used in the returned HTML** — dead code left over from a previous layout.

**Setup-needed banner:** shown when business name or state is missing.

**Multi-shop cloud-sync-not-configured banner:** shown when more than one location exists but Firebase isn't fully configured or the auto-sync interval is 0/unset.

**Sales trend chart** — `dashTrendRange` (14/30/90 days) builds a daily-total-sales SVG line+gradient chart. Note: the chart legend advertises two series ("Sales Amount" and "Number of Bills") but only sales amount is ever actually plotted — the bill-count legend entry is vestigial.

**Recent Invoices table** — top 4 by `date` string descending (lexicographic sort, not a true date sort). **Low Stock table** — first 4 rows from the same scan as the KPI. **Quick Actions** — 6 shortcut buttons.

**Status badges:** `statusBadge(inv)` → `paymentStatusBadge(total, paid)`: due ≤0.5 → "Paid"; paid>0 → "Partial"; else "Unpaid".

### 3.2 Business Settings screen — `renderSettings()`

A `businessDetailsLikelyNotLoaded` banner shows when Cloud Sync is enabled, real-time Business Settings sync isn't active, and every profile field is blank — because a genuinely-blank device is indistinguishable from one whose first real-time-sync attempt silently failed (a real bug present through v2.86.1). Offers a one-click **Retry Now** (`enableRealtimeBusinessSettings()`).

**Business Details card** — Business Name, GSTIN (auto-uppercased; auto-fills State via `stateFromGSTIN()`), State, City, Pincode, Phone, Email, Address. **Shop Logo** upload: `handleLogoUpload()` → `readAndCompressImage(file, 240, 0.85)` → saved as `settings.businessLogo`, shown in the sidebar and on printed bills; **Remove Logo** confirms then clears.

**Document Numbering card** — separate prefix + next-sequence pairs for Invoice (With-GST), Invoice **Without GST** (independently maintained so the GST series never skips a number), Quotation, Delivery Note, Credit Note, Debit Note. Format: `PREFIX/2627/0001`.

**Bank Details card** — Bank Name / Account Number / IFSC, printed on invoices.

**Save** → `saveSettingsForm()`: reads fields, trims, uppercases GSTIN, falls back to default prefixes (`INV`, `NGST`, `QUO`, `DN`, `CN`, `DBN`) and sequence 1 if invalid, saves, logs `settings_updated`, toasts.

**Backup & Restore card** — `exportAllData()` builds one JSON with every persisted data slice (settings through staffPayments — ~25 slices), downloaded as `wholesale-ledger-backup-<date>.json`. **Note:** the backup's own `version` field is hardcoded to `'2.16.0'` while `APP_VERSION` is `'2.86.1'` elsewhere on this same screen — these have drifted and the backup's stamped version is stale/misleading.
`importAllDataFile()`: confirms (replaces ALL current data), parses JSON, restores every slice with fallback defaults for missing/legacy data, migrates old product records lacking `altUnits`/`stockByLocation`, resets `currentLocationId` if invalid, alerts on success or on a parse/read error.

**WhatsApp Messaging card** ("Coming Soon") — Provider, API Key, Phone Number ID, Business Account ID, Notes. Explicit caveat that entering credentials doesn't turn sending on — needs a secure backend relay too.

**Cloud Sync card** ("Connected") — built-in/zero-config, tied to the login used at the login screen, offline-first with automatic merge on reconnect.
- Checkbox: store product photos in Firebase Storage instead of inside synced data (off by default).
- **Sync Every (minutes)**: Off/1/2 (recommended)/5/10/15/30/60 — per-device; first sign-in auto-sets to 2 with every real-time toggle on.
- **Save Cloud Sync Preferences** → `saveCloudSyncPrefs()` (sync-engine.js).
- **Sync Now** → `runSyncCycle(false)`, disabled/spinning mid-sync.
- Shows whether "This device" is the shop's primary device or a remote/admin session (`isPrimaryShopSession()`).
- Collapsible explainer: merges are per-record, not whole-file overwrite; stated limitation — the *same* record edited differently on two devices before either syncs has last-to-sync win with no field-level merge.
- Collapsible **Firestore security rules** (pasteable) — see §3.2.1 below for the full breakdown.
- Collapsible **Firebase Storage security rules**.
- Red **"Honestly"** caveat: built against Firebase's standard API but **never tested against a live Firebase project** — recommends a throwaway project/non-critical data first and keeping local backups regardless.

**Seven "Real-Time X Sync" cards** ("Experimental Pilot") — Customer, Supplier, Product, Invoice, Stock Movement, Business Settings, Location — each independently toggleable; see §5, §6, §7 for the mechanics and honest caveats of each.

**Danger Zone card** — **Reset All Data** → `resetAllData()`:
- Double confirmation; the first dialog lists exactly what's wiped and explicitly states it does **NOT** delete or sign out any Firebase account.
- Disables every active real-time listener **first**, before wiping local arrays — a still-live listener could otherwise repopulate data mid-reset.
- Wipes essentially every data slice, resetting categories/locations/chart-of-accounts to their defaults.
- **Deliberately leaves alone**: the signed-in Firebase session, and (per Stock Movement Sync's own docs) never deletes that collection's cloud copy, only this device's local copy.

**About card** — App name + `APP_VERSION` + a feature-summary paragraph.

#### 3.2.1 Firestore Security Rules (as pasted in Settings)

Helpers: `signedIn()`, `activeMember()`, `businessAdmin()`. Per-collection: `members` (self or active member read; only an admin can write another's, never their own); `data`/`settings` (any active member, full read/write); `customers`/`suppliers`/`products`/`invoices` (any active member read/create/update; **delete is admin/owner-only**); `stockMovements` (**create-only for everyone including admins — no update/delete ever**, matching the app's own never-rewrite behavior for stock movements). Documented caveats: (a) `role` on a membership doc is the same field the login screen itself uses to gate access; (b) the shared whole-document `data/main` rule technically still permits writing `products`/`invoices`/`stockMovements` fields through the legacy whole-document sync path — these new per-record restrictions don't fully close that gap, left open deliberately because other legacy parts of the app still depend on the shared document; (c) `locationName`/`tabs` restrictions on a membership doc are enforced only at the app layer, not by these rules — someone with raw Firebase credentials could bypass them via the API directly.

### 3.3 Locations screen

`renderLocations()` itself lives in `inventory.js`, not `admin.js` — see §4.2.

### 3.4 Staff & Payroll

`admin.js` provides only the screen shell: `renderUsers()` renders "Payroll & Activity" with a 3-way sub-tab switch (`payroll`/`staff`/`log`), explicitly noting that logins are managed as Firebase accounts via the Console, not this page. Only **Activity Log** is implemented here — `renderActivityLogSubTab()` lists the most recent 300 entries, filterable by account via a dropdown reconstructed from the log itself (a `Map` of `userId → username`), since there's no separate accounts list anymore. `renderPayrollSubTab()`/`renderStaffSubTab()` are implemented in `finance.js` (§8.6).

One payroll-adjacent helper is defined here: `locationSalesInRange(locationId, from, to)` — sums `grandTotal` for invoices whose own `locationId` (not who was logged in) falls in a date range, used by Staff Payroll commission calculations so commission is based on where a sale happened, not which account created it.

### 3.5 Shop Comparison / cross-location reporting — `renderShopComparison()`

Date-range filter (defaulting to start-of-month→today). Per location, figures come from the **double-entry accounting ledger**, not raw invoice sums (except bill count): `sales = accountBalanceInRange('acc-sales', from, to, loc.id)`, `cogs` similarly, `grossProfit = sales-cogs`, `expenseTotal` = sum of every expense-type account excluding `acc-cogs`, `netProfit = grossProfit-expenseTotal`. `billCount` alone is taken straight from `invoices`, not the ledger. A `combined` row sums all locations; a bar chart and full comparison table render alongside a note that this page deliberately pulls the same books as Accounting, whereas Dashboard/Sales Reports/Expenses/Cash Book only ever show one shop at a time.

### 3.6 PDF / print generation in this file

Only **Delivery Note** PDF/preview lives here (invoice/quotation/credit-debit-note PDFs are in `sales.js`). `downloadDnPDF()` uses the shared `pdfBlock()` helper (app.html) so wrapping/multi-line text never overlaps — this replaced an earlier hardcoded-Y-offset version that broke on long addresses. Item rows use `doc.autoTable()` with `pdfItemCode(it)` looked up live. Footer: "Goods dispatched under this delivery note. Not a tax invoice."

### 3.7 Other significant business logic / validation rules

- **Image compression** — `readAndCompressImage(file, maxDim, quality)`: generic canvas resize+JPEG-reencode, rejects non-image/unreadable files.
- **Payment recording** (`startRecordPayment`/`saveRecordedPayment`/`renderPaymentRecordModal`) — works against an invoice or purchase. Validates amount>0; confirms before over-recording past outstanding+0.5. Updates `paidAmount`, recomputes status, appends a `payments[]` entry, posts a journal line (invoice: Dr Cash/Bank via `cashOrBankAccount(mode)`, Cr Accounts Receivable; purchase: reverse), logs activity, optionally logs to Cash Book too.
- **Stock adjustment** (`saveAdjustment()`) — reads product/variant/direction/qty/category/note from raw DOM elements. Rejects qty≤0; confirms before going negative. Applies via `addVariantStock()`, logs via `logMovement()` with an `ADJ_CATEGORIES` reason label, logs activity.
- **Credit/Debit Note draft-line recompute** (`updateCnLine`/`updateDbnLine`) — clamp quantity to `[0, max]` (original invoiced quantity), patch via `patchCell()` rather than a full render. Credit Note lines recompute full tax via `computeLineForTaxType()` inheriting the original invoice's tax type; Debit Note lines only recompute a flat qty×rate amount.
- **WhatsApp campaign drafting** — full CRUD for drafts only; `attemptSendCampaign()` always alerts that sending isn't available yet (needs WhatsApp Business API access plus a secure backend relay), reassuring the draft is saved and ready.
- **GST CSV exports** — `downloadB2BCsv`/`downloadB2CCsv`/`downloadCdnrCsv`/`downloadHsnCsv`, all filtered to `gstApplicable!==false` and scoped by the same period filter as GST Filing (§8.5).
- **Sales Reports** (`renderReports()`) — scoped to `currentLocationId` only. Groups by day/week/month, last 14 periods. Top Products/Customers from invoice line items directly. "Shop / Account Performance" groups by `createdByUsername` — explicitly *account*, not named-employee, performance, distinct from Staff/Payroll commission tracking.
- **Export/backup completeness** — `exportAllData()`/`importAllDataFile()`/`resetAllData()` all enumerate the same ~25 data slices; any new persisted collection added elsewhere needs to be added to all three or it will silently be excluded from backup/restore/reset.

**Dead code / discrepancies found in this file** (flagged for the developer): `renderDashboard()` computes `alerts`/`recentActivity` but never renders either; the dashboard trend-chart legend advertises a "Number of Bills" series that's never actually plotted; `exportAllData()`'s backup JSON hardcodes a stale `version: '2.16.0'` that no longer matches live `APP_VERSION`.

---

## 4. Inventory, Locations & Stock Sync (inventory.js)

Full file read (2,124 lines). Cross-referenced with `logMovement()`, `readAndCompressImage()`, `saveAdjustment()` which live in `app.html`/`admin.js` respectively.

### 4.1 Products & Variants

**Data model** — a product is a plain object in the global `products` array:
```js
{
  id, name, category, hsn,
  wholesalePrice, gstRate, purchasePrice, unit, barcode,
  lowStockThreshold,          // 0/blank = "use default of 5"
  altUnits: [{name, factor}], // factor = base units per alt unit
  hasVariants: bool,
  variants: [{ id, size, color, stockByLocation: { [locationId]: qty } }]
}
```
Stock is never a flat number on the product — every variant (even a "no variants" product, which still gets one synthetic variant) carries its own `stockByLocation` map. Per-location and combined-location stock are always derived: `getVariantStock`/`setVariantStock`/`addVariantStock` (per-location get/set/increment), `variantStockAllLocations` (sum across locations), `productStockAt`/`productTotalStock` (sum across a product's variants, one location or all).

Product photos live in a separate `productImages` dict keyed by product id, persisted via `saveProductImages()` — either a local base64 data URL or an `https://...` Firebase Storage URL, with `isCloudPhotoUrl()` just regex-testing for `http(s)://` so display code never has to care which.

**Add/edit form logic**: `startEditProduct(id)` populates the form with stock shown only **at the current working location**. `saveProduct()` validation, in order: name required; barcode unique (case-insensitive); ≥1 variant; no duplicate (size,color) pairs if `hasVariants`; alt units de-duped, non-empty name+factor>0, no collision with the base unit name.
- Stock write semantics: each submitted variant's `stockByLocation` is copied forward from the previous record (preserving other locations untouched) and only the current-location entry is overwritten.
- Movement logging on save: new variant with stock>0 → `opening`; existing variant's current-location qty changed → `adjustment` ("Manual correction via Products form at <location>"); a removed variant with nonzero total stock across all locations → `adjustment` with a negative `qtyChange`.
- Photo handling: unchanged photo does nothing; new/changed local base64 with `productPhotosToStorage` on and not already cloud → uploaded via `uploadProductImageToStorage()`, base64 kept on upload failure; previous cloud photo being replaced → best-effort delete of the old Storage file; photo removed entirely → `productImages[id]` deleted and, if cloud, the Storage file deleted too.
- `deleteProduct(id)` — confirms, removes, best-effort deletes cloud photo, does **not** touch past bills.
- `saveQuickProduct()` — fast "add mid-billing" path; validates duplicate barcode and price>0, logs an `opening` movement if opening stock>0, immediately adds the product to the in-progress sale.

**Photo compression**: `handleProductImageUpload(input)` calls `readAndCompressImage(file, 500, 0.78)` (admin.js) — downscales to ≤500px long side, re-encodes JPEG q=0.78, always client-side regardless of whether cloud Storage upload is later used.

**Filtering/status**: `filteredProductList()` filters by free text (name/category/HSN/barcode), category, and a stock-status bucket (`out`/`low`/`healthy`) computed against `productStockAt()` + `lowStockThresholdFor()`.

**Reorder threshold**: `lowStockThresholdFor(product)` — the product's own value if positive, else a hardcoded default of 5, used consistently everywhere low-stock status is computed.

### 4.2 Multi-location stock & transfers

**Locations model**: `{ id, name, type: 'shop'|'warehouse', address, openingCashBalance, isDefault }`.

**`defaultLocations()`** seeds four hardcoded records with **fixed, deterministic ids** (`loc-baby-step`, `loc-cool-kids`, `loc-quency-culture`, `loc-hynish-wh`) rather than random ids. This matters because of when it runs: on first load, before any cloud pull, on every device. Because Cloud Sync's merge (`mergeCollectionById`) treats records as "the same" purely by id, random ids meant every never-synced device minted its own 4 seed records that all survived the merge as duplicates once synced (the bug fixed in v2.81.1). Fixed ids make every device's seed data collapse into the same 4 records instead.

**`saveLocationForm()`/`deleteLocationRecord()`** both branch on `locationsRealtimeActive`:
- Real-time active: write directly to Firestore; the local `locations` array is **not** touched in this branch — only updated when the `onSnapshot` listener fires. `deleteLocationRecord()` computes its post-delete fallback location id *before* issuing the delete, since reading `locations` right after could still see the just-deleted entry.
- Not real-time: mutate the local array directly and persist.
- `deleteLocationRecord()` refuses to delete the last remaining location, and warns (but allows) deleting one that still has stock recorded against it.

**Stock Transfer flow**: `renderStockTransfer()` keeps `fromLocationId` synced to the current working location only while the draft has no items yet — once items exist, switching locations no longer silently redirects the source. `saveTransfer()` validates destination required, source≠destination, ≥1 item, every qty>0; computes shortages and shows them in one confirm but still allows proceeding (stock can go negative via override). Execution: `addVariantStock(v, from, -qty)` then `addVariantStock(v, to, +qty)`, plus **two** `logMovement()` calls per item (`transfer_out` at source, `transfer_in` at destination), both referencing the same `transfer.id`.

### 4.3 Stock Movements ledger

`logMovement()` is defined in `app.html`; every call site is in `inventory.js`. Design rationale: Stock Movements are an **append-only, immutable-once-created audit ledger** — never edited or individually deleted (the only wholesale removal is Reset All Data). This is explicitly contrasted with Products/Invoices, which mutate in place and need full-body diffing for sync — because a movement never changes post-creation, its real-time push/pull is purely additive in both directions.

What triggers a movement: `opening` (new stock), `adjustment` (manual correction, Stock Ledger, or Physical Count reconciliation), `purchase`/`purchase_reversal`, `transfer_out`/`transfer_in`, and `sale`/`sale_reversal`/`delivery_out`/`delivery_return` (logged from billing/delivery code in `sales.js`).

The Stock Ledger UI (`renderStockLedger()`) filters by location/product/type/reason, and surfaces a "Wastage/Shrinkage this month" KPI from `category==='wastage'` movements valued at purchase price.

### 4.4 Barcodes

`barcodeValueFor(product, variant)`: base = the product's own `barcode` (trimmed/uppercased) if set, else the last 8 characters of the product id; if variant given and product `hasVariants`, suffixed with size+color (stripped/uppercased) or the last 4 chars of the variant id. `productCodeDisplay(p)` = `barcodeValueFor(p, null)`.

Printing: `barcodeSelections` (per product:variant print quantity), `setAllBarcodeQty(n)` bulk-sets for whatever the current filter shows. `generateBarcodeSheetPDF()` renders CODE128 via `JsBarcode` to an offscreen canvas (caching by value), lays out a 4×10 grid per A4 page, with a fallback that strips non-alphanumeric characters and retries (defaulting to `'NA'`) if the raw value throws. `printBarcodeSheet()` mirrors this via inline SVG into `#print-area` + `window.print()`.

Lookup: `findProductByBarcode()` for exact match; `handleProductCodeEntry()` for manual/keyboard-wedge scanning; `startBarcodeScanner()`/`handleBarcodeResult()`/`stopBarcodeScanner()` drive a ZXing-based camera scan, preferring a rear-facing camera, staying open on a non-match for retry.

### 4.5 Real-time sync implementations in this file

All four collections share the shape: a `*CollectionRef()` under `businesses/{businessCode}/{collection}`, an `enableRealtimeX(silent)`/`disableRealtimeX()` pair, a push path gated by an `XRealtimeActive` flag, and add/edit/delete call sites branching on that flag.

**Products**: does a real **merge**, not a one-way migration, since Products changes on nearly every operation. Pulls the whole cloud collection, merges via `mergeCollectionById(products, cloudProducts, lastPushedProductsSnapshot||[])`, saves locally, sets the new baseline snapshot. **`productsRealtimeActive=true` is set BEFORE calling `doPushProductsDelta()`** — an earlier version set it after, silently no-oping the initial push (it "worked by accident" via the `onSnapshot` listener's first fire, not by design; fixed to match the intended order). `onSnapshot` merges via the same `mergeCollectionById` (local wins on conflict) rather than blind-replace, so an uncommitted local edit to one product can't be clobbered by a change to a different product in the same snapshot event. Push (`pushProductsDelta`/`doPushProductsDelta`) is serialized via `productsPushLock` so concurrent `saveProducts()` calls never race each other's batch commits; diffs by `JSON.stringify` per id, batches at 450 ops (under Firestore's 500-op cap), and only updates the baseline snapshot **after** confirmed commit.

**Suppliers**: one-time migration gated on `snap.empty` (only uploads local suppliers if the cloud collection has zero docs). `onSnapshot` does a full replace — no merge needed for a small, low-churn collection. Add/edit/delete write directly to Firestore when active; `permission-denied` on delete gets a specific "needs owner/admin role" message.

**Stock Movements**: pure additive union (any remote id not already local gets appended; nothing is ever removed in either direction, even after restoring an older backup — treated as correct, not a bug). Same before/after-flag ordering issue as Products, but flagged as **not just latent** here: since the `onSnapshot` listener deliberately doesn't call `saveStockMovements()` on every fire, setting the flag after the push would mean pre-existing local-only movements never reach the cloud on enable at all. `doPushStockMovementsDelta()` marks each **chunk** confirmed as it commits (not just once at the end), so a failed later chunk doesn't cause redundant resends of earlier successful ones. Reset-All-Data-style mass deletion is structurally impossible here since this push path can never delete anything.

**Locations**: fixes the resurrection bug described in §7 by giving Locations its own real-time collection instead of relying on the whole-document blob. Migration is deliberately a **per-id existence check**, not a "cloud collection is empty" gate like Suppliers — because multiple fresh devices could race an empty-check within moments of each other during rollout, with an empty-gate letting whichever device wins the read migrate only its own list while every other device (including one with a manually-added location) silently adopts that first list and loses its own data. Checking existence per-id means every device just guarantees its own known locations exist regardless of run order. `onSnapshot` never applies an **empty** snapshot to local `locations` (the app assumes ≥1 location always exists), treating it as a transient in-between state rather than wiping to empty.

### 4.6 Purchases

- `newPurchaseDraft()` → `{date, supplierId, items:[], notes, status:'unpaid', paidAmount:'', dueDate:''}`. Supplier CRUD is embedded on the same screen, sharing the real-time-vs-local branching from §4.5.
- Draft-item helpers use `patchCell()` for live row totals without a full re-render.
- `savePurchase()` validates a supplier, ≥1 item, every qty>0. Converts entered qty/unit to base units via `toBaseQty()`. Builds the purchase record and posts a journal entry (`postJournal(...journalLinesForPurchase(purchase))`). Stock lands at `currentLocationId`; the product's `purchasePrice` is only updated if the purchase unit **is** the base unit (an alt-unit rate never overwrites base-unit cost). `logMovement(type:'purchase', ...)` per item, noting the original unit if it differed from base.
- `deletePurchase(id)`: confirms (naming the location whose stock reverses, warning separately about reversed payments), reverses stock per item with a `purchase_reversal` movement, removes the record, reverses its journal entry and every payment's journal entry.

### 4.7 Other significant business logic

- **Physical Stock Count** (`startStockCount`/`applyStockCount`): snapshots current-location stock, diffs counted vs. system quantity, requires confirmation naming the change count, applies via `setVariantStock()`, logs each as an `adjustment`/`correction` movement, appends a summary to `physicalCounts`. A count with zero differences is rejected.
- **Manual adjustments** initiate from the Stock Ledger UI here but `saveAdjustment()` itself is implemented in `admin.js`.
- **Reorder Planning**: for a location and a configurable sales-history window (7/30/60/90 days), computes units sold, daily velocity, `daysLeft`, and `suggestedQty = max(0, ceil(dailyVelocity*targetDays - currentStock))` for a target coverage (14/30/60 days). Rows included if any sale occurred or stock ≤5; flagged urgent when `daysLeft<thresholdDays`. Cross-checks warehouse-type locations' stock of the same variant and recommends transferring before purchasing fresh.
- **Location-restricted users**: `userIsLocationRestricted()`, `enforceHomeLocation()` (force-switches back if drifted), `switchLocation(id)` (defense-in-depth blocked for restricted users), `isPrimaryShopSession()` (identity signal only, not yet wired to behavior — intended to eventually support Without-GST bills created away from the shop safely queuing until the shop's own device can "claim" them; not built, open questions cited around invoice numbering and stock-deduction timing).
- **CSV exports**: `exportProductsCSV()`, `exportReorderCSV()`.
- **Product search/quick-entry at billing**: `computeProductSearchResults()` (matches name/barcode/variant barcode, capped 8), full keyboard nav in `handleProductSearchKeydown()`.

---

## 5. Sales, Billing & GST Logic (sales.js)

The GST calculation engine itself and a few shared helpers live in `app.html`, `finance.js`, `admin.js`, and `inventory.js` — noted inline below.

### 5.1 Customers

**Data model** (`saveCustomer()`): `{id, name, contactPerson, gstin (uppercased), state, city, phone, address, creditLimit}`. Blank `gstin` ⇒ B2C/cash buyer. A quick-add customer mid-billing defaults `state` to `settings.state` — silently assuming intra-state until edited.

**Credit limit** — warns, never blocks: `saveInvoice()` computes `projected = existingOutstanding + thisInvoiceUnpaid` (subtracting the bill's own prior unpaid contribution when editing, so it isn't double-counted) and confirms before allowing an over-limit save.

**Dues tracking**: `customerOutstandingBalance(customerId)` (finance.js) = `Σ max(0, grandTotal-paidAmount)`. `customerLedgerEntries(customerId)` builds a running-balance ledger: one debit per invoice, a credit for the invoice's *initial* paid amount, and a separate credit per later `payments[]` entry, sorted so same-day entries land billing→initial-payment→later-payment.

**Status badges**: Overdue (any invoice past due with a >0.5 gap) > Over Limit > Has Balance > Healthy.

**Add/Edit/Delete**: single `saveCustomer()` for create/update; delete doesn't touch existing bills (`customerSnapshot` is frozen at invoice time).

**Real-time Customer sync**: `customersCollectionRef()` → one-time migration if cloud is empty and local has data (chunked 450/batch); `onSnapshot` **fully replaces** the local array on every remote change (no diff-and-push here, unlike Invoices/Products — customer records don't need protection against clobbering an uncommitted mid-edit field). Save/delete write directly to Firestore when active.

### 5.2 Billing / New Invoice flow

**Draft shape**: `{invoiceNo, date, customerId, items:[], notes, status:'paid', paidAmount:0, dueDate, gstApplicable:false}`. Each item: `{productId, variantId, name, hsn, unit, gstRate, qty, rate, discountPct}`. `addOrIncrementDraftItem()` increments qty in place for a repeat scan/search hit.

**Product/code quick-entry**: live-filtered search (top 8), full keyboard nav, falling through to an exact-code `handleProductCodeEntry()` lookup (works with USB barcode scanners) if no dropdown match.

**GST calculation — the core logic.** Tax-type decision, `taxTypeFor(customerId)` (app.html): compares `settings.state` (seller) to the customer's `state`; **intra if equal or either blank**, else inter. This is a documented gap — a customer with no state set never gets IGST even if genuinely inter-state, until the state field is filled in.

Per-line math, `computeLineForTaxType(item, taxType)` — the one true engine shared by invoices/quotations/DNs/CN-DBNs: `taxable = gross - gross*disc/100`; intra ⇒ `cgst=sgst=taxable*rate/2/100`; inter ⇒ `igst=taxable*rate/100`. `computeLine(item)` is the New-Bill-specific wrapper: if `draft.gstApplicable` is false, zeroes cgst/sgst/igst and sets `total=taxable` — this is where "Without GST" bills get zero-tax treatment without touching the shared engine.

`gstRate` is snapshotted onto the draft item (and then the saved invoice item) from the product record at the moment it's added — **not** recalculated if the product's rate changes later. `suggestGstRate(price)` — `>2500 ⇒ 18%, else 5%` — is offered when editing a *product*, not per invoice line.

`totalsForCart(items, taxType)` (shared) and `draftTotals()` (New-Bill-specific, skips the GST engine entirely for `!gstApplicable`) both round to the nearest rupee via `Math.round()`, booking the difference as a `roundOff` line (shown on-screen, on the printed PDF, and in the Sales Revenue journal posting).

### 5.3 With-GST vs Without-GST invoice series

- `gstApplicable` set by the New Bill GST dropdown, persisted as `gstApplicable: draft.gstApplicable!==false` — so a missing/undefined value on an old record defaults to "GST applies."
- **Two entirely separate numbering series**: With-GST uses `nextInvoiceSeq`/`invoicePrefix`; Without-GST uses `nextInvoiceSeqNoGst`/`invoicePrefixNoGst` — per customer request, so the With-GST series stays perfectly unbroken for filing/audit purposes. Editing a bill never touches either counter.
- **Exclusion from cloud sync**: `syncableInvoices()` filters `gstApplicable!==false` before anything is diffed/pushed/merged, in every real-time sync function *and* the whole-document sync's `syncedCollections()` — a Without-GST invoice's id can never reach Firestore, never gets diffed as "changed," never gets treated as "deleted." Deliberately duplicated logic (not shared code) between the real-time path here and `syncRecordsForCollection()` in `sync-rules.js`, so each mechanism independently honors the rule.

### 5.4 Editing an existing invoice / payments against dues

- `startEditInvoice(id)` blocks editing across locations (must switch first), warns on a past-month bill ("may already have been filed for GST").
- On save, if editing: the **old** invoice's stock/journal effects are fully reversed first (`sale_reversal` movement, `reverseJournalForRef` for both the invoice and its COGS entry), then the new items are re-deducted and re-posted — an edit is "undo, then reapply," not a diff.
- **`paidAmount`/status never come from re-entering them on the edit form** — `alreadyReceived` is fixed to whatever it already was; status is derived by comparing that fixed amount to the new `grandTotal`. Received-so-far only changes via Outstanding Dues, preserved untouched across an items edit.
- **Avoiding double-counted cash** — `invoiceForJournalPosting(invoice, isEditing, oldInvoice)` (finance.js): when (re-)posting the invoice's own journal entry, subtracts everything already received via separately-recorded `payments[]` (each posted through its own `payment_in` entry) so the invoice's own line only ever books its original at-billing paid amount — never double-booking a later payment.
- **Recording a payment separately** (`saveRecordedPayment()`, admin.js): increments `paidAmount`, appends to `payments[]`, recomputes status, posts its own balanced `payment_in` entry, optionally logs to Cash Book. Warns (doesn't block) if the amount exceeds the outstanding balance by more than ₹0.5.
- **Deleting an invoice** restores stock (skipping items whose `skipStockDeduction` means stock actually left via a delivery note instead), reverses both the invoice and COGS journal entries plus every recorded payment's entry, and reverts a source quotation/delivery-note back to open/pending if this invoice was converted from one.

### 5.5 Quotations, Delivery Notes, Credit Notes, Debit Notes

**Quotations**: mirrors an invoice line-for-line, no `gstApplicable`/payment fields. Never touches stock or accounting. `convertQuoteToInvoice(id)` copies items into a fresh draft; on successful save the source quotation is marked `converted`; deleting that invoice reverts it to `open`.

**Delivery Notes / Challans**: "for goods leaving the shop before a tax invoice is raised" — stock deducted immediately (`delivery_out`). `items[].rate` is a Reference Value only — no GST computed on a DN at all. Lifecycle: `pending` → `invoiced` (via `convertDnToInvoice()`, building invoice items with `skipStockDeduction:true` so stock isn't deducted twice) → `returned` (restores stock, `delivery_return`). Only a `pending` DN can be edited/converted/marked-returned.

**Credit Notes**: issued against an existing invoice. `startCreditNote(invoiceId)` caps quantity via `sumCreditedQty()` so a line can't be credited past what was originally billed. `saveCreditNote()` uses the **original invoice's `taxType`** (never re-derives it), and zeroes tax if the original invoice was Without-GST. **What it reverses**: `Dr Sales Revenue`, `Cr Accounts Receivable`, `Dr GST Output Payable` (if taxed) — and, **only if `restock` is checked**, also `Dr Inventory / Cr COGS` plus a `sale_return` stock movement. A price-correction note (restock unchecked) only reverses revenue/tax/AR, never stock/COGS.

**Debit Notes**: issued against an existing purchase, no GST math (`amount = qty*rate` only). Mirrors the credit-note capping pattern. **Reverses**: `Dr Accounts Payable`, `Cr Inventory`; if `restock`, also removes stock units with a `purchase_return` movement.

### 5.6 PDF/print generation for invoices

`downloadInvoicePDF(id)` uses jsPDF + `autoTable`, built entirely around the shared `pdfBlock()` chained-Y layout primitive (app.html) — the documented fix history: the business name/address header used to be a fixed unwrapped line that a long name could run into the invoice-number column; the "Bill To" block is deliberately wrapped at **95mm** (not 110mm) so it can never reach the Payment Status column starting at x=120; the divider and item-table start position off whichever block (header/Bill-To/Payment-Status) actually ran longest, never a hardcoded guess. Item table columns differ by tax type (intra: separate CGST%/CGST, SGST%/SGST pairs; inter: a single IGST%/IGST pair). `pdfItemCode(it)` looks up the code live, blank if the product's since been deleted. The same `pdfBlock` approach is reused in `downloadQuotePDF`, `downloadCreditNotePDF`, `downloadDebitNotePDF`.

### 5.7 Real-time Invoice sync

`invoicesCollectionRef()`; `syncableInvoices()` is the single choke point every sync function uses. **Diff-and-push, not blind replace** (unlike Customers) — necessary because recording a payment mutates an existing invoice in place, and a blind full-replace on an incoming remote change could clobber an uncommitted local payment. `doPushInvoicesDelta()` computes `dirty` (JSON differs from the last-pushed snapshot) and `deletedIds`, batches at 450/commit, and only updates the baseline after a confirmed commit. `enableRealtimeInvoices()` does an initial two-way merge (local wins on conflict), sets the active flag **before** the initial push (same before/after-ordering fix pattern as Products elsewhere in the app).

**The honest limitation on invoice-number collisions** (documented at length in `app.html`): `nextInvoiceSeq`/`nextInvoiceSeqNoGst` are **per-device** counters. Real-time invoice sync makes an already-numbered invoice visible to other devices faster but does **not** make number *assignment* collision-safe — two devices billing independently offline (or within the same few seconds even online) can still produce the same invoice number, since there's no server-side atomic counter (would need Cloud Functions). Business Settings' real-time sync partially mitigates this via `max(local,remote)` merging so a counter can only move forward, never backward — a real improvement, but explicitly **not fully collision-proof**: two devices starting from the same not-yet-pushed counter value within the same few seconds can still pick the same next number.

### 5.8 Other significant business logic / validation rules

- **Stock-shortage warning on save** (invoices and DNs identically): compares requested qty (in base units) against location stock; when editing, first adds back the old version's contribution at that location so editing down to the same quantity never falsely looks like a new shortage. Confirm-to-override, not a hard block.
- **Location lock on edit**: refuses to open an edit form for a document created at a different location.
- **Past-month edit warning**: non-blocking.
- **Quantity validation**: rejects any line with qty≤0.
- **Journal balance guard**: `postJournal()` refuses to post (returns `null`, logs) if debits≠credits (0.01 tolerance); lines under ₹0.004 are dropped as noise.
- **GSTIN-driven state auto-suggestion**: the customer form's GSTIN field triggers `autoSuggestState()`, feeding directly into the CGST/SGST-vs-IGST decision in §5.2.
- **Sales Register / Customer Statement exports** — the same fields used in the GST/dues logic, for offline filing/audit use.
- **COGS posting** (`journalLinesForInvoiceCOGS`, finance.js): `Dr COGS / Cr Inventory` for `Σ(purchasePrice × baseQty)`, runs alongside every invoice save and is reversed identically to the revenue entry on edit/delete.

---

## 6. Accounting, Cash Book, Expenses & GST Filing (finance.js)

`finance.js` is the financial core: a full double-entry bookkeeping engine (Chart of Accounts, journal entries, Trial Balance, P&L, Balance Sheet, General Ledger), a separate informal Cash Book, a Daily Expenses tracker, Monthly GST Filing, Outstanding Dues rendering, and both shop-level and named-staff payroll flows. Nearly every other module calls into this file's `postJournal()`/`journalLinesFor*()` helpers to keep the books updated automatically — the business user never touches a debit/credit screen directly except in the Chart of Accounts itself.

### 6.1 Chart of Accounts & Double-Entry Accounting

#### 6.1.1 `defaultChartOfAccounts()`

Seeds a fixed 5-type chart: Assets (Cash in Hand `acc-cash`, Bank Account `acc-bank`, Accounts Receivable `acc-ar`, Inventory `acc-inventory`, GST Input Credit/ITC `acc-gst-input`), Liabilities (Accounts Payable `acc-ap`, GST Output Payable `acc-gst-output`, Loans Payable `acc-loans`), Equity (Owner's Capital `acc-capital`, Owner's Drawings `acc-drawings`), Income (Sales Revenue `acc-sales`, Other Income `acc-other-income`), Expense (Cost of Goods Sold `acc-cogs`, Other Expenses `acc-other-expense`). All flagged `isSystem:true`, cannot be deleted via the UI. **One expense account is auto-generated per expense category**, coded starting at 5100 in steps of 10, linked via `expenseCategoryId`.

Custom accounts can be added ad hoc via `addCustomAccount()`, auto-assigning a code (`max existing code of that type + 10`) if left blank.

#### 6.1.2 Deterministic IDs for expense categories/accounts

`expenseCategorySlug(name)` derives an id like `exp-cat-rent` — deliberately not random — because Cloud Sync's merge is by-id only (`mergeCollectionById`), so two never-synced devices independently creating the same category with random ids would produce duplicates (the same bug class as Locations, fixed in v2.81.1). `ensureExpenseAccount(category)` reuses the same deterministic slug for the account id (`acc-` + slug) for the same reason.

`defaultExpenseCategories()`: Rent, Electricity, Water, Staff Salary/Wages, Transport/Delivery, Packing Material, Stationery/Printing, Maintenance & Repairs, Marketing/Advertising, Tea/Refreshments, Bank Charges, Other.

#### 6.1.3 Journal entry model

```js
{ id, date, locationId, refType, refId, refLabel, lines: [{accountId, debit, credit}], createdAt }
```
`refType`/`refId` (e.g. `invoice`, `invoice_cogs`, `purchase`, `expense`, `payroll`, `staffpayroll`, `credit_note`, `credit_note_cogs`, `debit_note`, `payment_in`, `payment_out`) tie an entry back to its source document so it can be found and reversed.

#### 6.1.4 `postJournal(date, locationId, refType, refId, refLabel, lines)` — the single posting gateway

The **only** function that ever writes to `journalEntries`. Refuses (returns `null`, `console.error`s) if `|Σdebit - Σcredit| > 0.01` — "the books must never be allowed to drift out of balance." Drops any line with both debit and credit ≤0.004 (dust); if nothing survives, discards the whole entry rather than posting empty. `reverseJournalForRef(refType, refId)` is the companion — filters out every matching entry. **This is how every edit/delete is handled: delete the original entry(ies), re-post fresh ones — never an in-place adjustment.**

#### 6.1.5 What each business event posts

- **Invoice** (`journalLinesForInvoice`): Dr Cash for `paidNow=min(paidAmount,grandTotal)`, Dr AR for the remainder, Cr Sales Revenue for `subtotal+roundOff`, Cr GST Output Payable for the tax. Note: cash collected at invoice time always posts against `acc-cash` regardless of actual payment mode (only the later Record-Payment flow respects the real mode). `invoiceForJournalPosting()` — see §5.4 — corrects for cash already captured via later separate payments so it's never double-counted.
- **Invoice COGS** (`journalLinesForInvoiceCOGS`) — a separate entry (`invoice_cogs`) alongside every invoice: `Dr COGS / Cr Inventory` for `Σ purchasePrice×qty`; skipped entirely if the total is ~0.
- **Purchase** (`journalLinesForPurchase`): `Dr Inventory` for the total, `Cr Cash` for `paidNow`, `Cr Accounts Payable` for the remainder.
- **Expense** (`journalLinesForExpense`): `Dr` the category's expense account, `Cr` Cash-or-Bank per `cashOrBankAccount(mode)`. `saveExpenseForm()` always reverses any prior entry for that expense id before re-posting — a no-op for a fresh expense, correct for an edit.
- **Credit Note** (`journalLinesForCreditNote`): `Dr Sales Revenue`, `Cr Accounts Receivable`, `Dr GST Output Payable` if taxed. `journalLinesForCreditNoteCOGS` fires **only if `restock` is true**: `Dr Inventory / Cr COGS`.
- **Debit Note** (`journalLinesForDebitNote`): `Dr Accounts Payable / Cr Inventory`.
- **Payroll / Staff Payments**: `Dr` the relevant expense account (Staff Commission or Staff Salary/Wages), `Cr` Cash-or-Bank.
- **Payments received/made** (admin.js, via this file's `postJournal`): `payment_in` → `Dr Cash-or-Bank / Cr AR`; `payment_out` → `Dr AP / Cr Cash-or-Bank` — these respect the actual chosen payment mode.

All of the above funnel through `postJournal()`, so all are subject to the same balance-or-refused rule.

#### 6.1.6 `cashOrBankAccount(paymentMode)`

`(paymentMode==='Cash') ? acc-cash : acc-bank` — every non-Cash mode (Bank Transfer, UPI, Cheque, Card, Other) books to the single Bank Account; the Chart of Accounts doesn't distinguish them from each other.

#### 6.1.7 Account balance computation

`accountBalance(accId, asOfDate, locationId)` and `accountBalanceInRange(accId, from, to, locationId)` sum debit/credit across all journal lines up to/within the given bound, returning `debit-credit` for debit-normal accounts (asset/expense) or `credit-debit` for credit-normal ones (liability/equity/income). **Recomputed from the full journal-entry array on every call** — nothing is cached, which is exactly why the reverse-then-repost pattern is used everywhere instead of incremental adjustments. `customerOutstandingBalance`/`customerLedgerEntries` build a per-customer statement directly from `invoices`, not journal entries.

#### 6.1.8 Chart of Accounts management rules

`addCustomAccount()` blocks duplicate names (case-insensitive). `deleteCustomAccount(id)` **refuses** if the account has any journal entries posted against it. `deleteExpenseCategory(id)` does **not** rewrite past expenses — they keep their `categoryName` string regardless.

### 6.2 Financial Statements

All three are derived purely from `accounts` + `journalEntries` — there is no separate stored "statement data."

- **Trial Balance** (`renderTrialBalance()`): all-time, all-locations-combined balance per account, split Debit/Credit by sign+normal-side. Shows "Balanced ✓" if `|totalDebit-totalCredit|<0.02`, else a red "should never happen" warning (structurally unreachable except by a bug, since `postJournal` refuses unbalanced entries).
- **Profit & Loss** (`renderProfitLoss()`): defaults to current-month-to-date; Income minus COGS = Gross Profit; minus every other Operating Expense = Net Profit, colored green/red by sign.
- **Balance Sheet** (`renderBalanceSheet()`): a point-in-time snapshot ("As Of"); Assets/Liabilities/Equity balances plus **Retained Earnings** = cumulative lifetime `income-expense` as of that date folded into equity; same balanced check as Trial Balance.
- **General Ledger** (`renderGeneralLedger()`): per-account running balance sorted by date+createdAt.

### 6.3 Cash Book

A **separate, informal ledger** — `cashEntries` records never post as journal entries and never touch `accounts`/`journalEntries` (they're recorded in parallel by flows opting to "also log this in the Cash Book"). Model: `{id, date, locationId, type:'in'|'out', category, amount, paymentMode, reference, notes}`; `amount` must be >0.

Categories (`app.html`): **In** — Sales Collection (Cash), Customer Payment Received, Capital Introduced, Loan/Advance Received, Other Income. **Out** — Supplier Payment, Expense Payment, Staff Salary/Commission, Owner Drawings, Bank Deposit, Loan Repayment, Other.

**`cashBalanceAt(locationId)`** = each location's own `openingCashBalance` + all-time net of its `cashEntries` — cumulative, location-scoped; there's no combined all-locations cash balance in the Cash Book itself. `renderCashAnalysis()` shows Today/Month KPIs, a 14-bucket daily/weekly/monthly trend, and category breakdowns.

### 6.4 Daily Expenses

Model: `{id, date, categoryId, categoryName, amount, paymentMode, notes, locationId}`. `saveExpenseForm()` validates amount>0 and a chosen category, then **always** reverses any prior journal entry for that id before re-posting — the uniform pattern that keeps edits correctly reflected in the books. `deleteExpense()` reverses then removes.

Reporting: Today/Last-7-Days/current-month KPIs, "Net This Month" (month's sales minus month's expenses, colored by sign), a 14-bucket trend by day/week/month, and an all-time (non-period-filtered) "By Category" breakdown. All Daily Expenses views are scoped to `currentLocationId` only.

### 6.5 GST Filing

A **monthly** filing summary (`renderGst()`), filtered by month/year.

**Aggregation**: invoices split into `withoutGstList` (`gstApplicable===false` — excluded from taxable totals but shown separately with a CA-confirmation caveat) and the taxable `list`, further split into B2B (buyer has a GSTIN) and B2C. Totals are a manual reduce over already-computed per-invoice tax fields (CGST/SGST/IGST are summed, not recalculated here). `netTaxable`/`netTax` subtract the period's credit notes.

**HSN-wise summary**: groups every line item by `hsn|gstRate`, mirroring the GSTR-1 HSN table.

**Filing readiness checks** (explicitly framed as "not a substitute for review by a CA"): business's own GSTIN must be set; every B2B customer GSTIN is regex-validated against the standard 15-character pattern; any taxable invoice with a line item missing HSN is flagged. Also reminds the user, informationally, of typical GSTR-1/3B due dates.

**Outputs**: B2B/B2C/CDNR/HSN tables mapped directly onto standard GSTR-1 tables, plus the "Without GST" section shown separately. `downloadGstReportPDF()` builds a multi-section, paginated PDF via jsPDF+autoTable; separate CSV exports exist for each table. Nothing here writes to GST-portal infrastructure — it's purely a computation/export tool for a CA.

### 6.6 Payroll & Staff

Two **parallel, independently-tracked** flows that both post to the same underlying expense accounts, so they combine correctly in the books.

**Shop-level Payroll (`payrollEntries`)** — important note: `payrollForm.userId`/`payrollEntry.userId` actually holds a **location id, not a staff id** (payroll used to be tracked per individual staff member with local logins, retired in favor of one Firebase account per shop; the field name was kept as-is to avoid a data migration). `savePayrollEntry()` posts `Dr` Staff Commission or Staff Salary/Wages (by `type`), `Cr` Cash-or-Bank. **No automatic commission calculation exists** — the UI's own help text says it must be worked out manually from the shown sales figure and typed in. Optional Cash Book logging.

**Named Staff Directory & Payments (`staffMembers`/`staffPayments`)** — a newer, complementary system for tracking actual named individuals: `staffMembers` are reference cards with default payment type/mode; `staffPayments` are dated log entries. `saveStaffPayment()` mirrors the shop-payroll posting exactly. `deleteStaffMember(id)` warns that history is retained (frozen at time-of-payment) if the staff member has payment history, and recommends **Inactive** instead of deleting.

Both flows' history tables are independent and accumulate correctly into the same expense accounts without double-entry risk, since each posts its own distinct `refType`+`refId`.

### 6.7 Outstanding Dues

Both sub-tabs are computed live from `invoices`/`purchases` (not a separate dues table) and feed a shared Record Payment modal (admin.js) that posts through this file's `postJournal`.

**Receivables**: unpaid set = `(grandTotal-paidAmount)>0.5` — the same 50-paisa rounding threshold used throughout. KPIs: Total Outstanding, Overdue, Due in Next 7 Days, distinct-customers-with-dues. Grouped by customer, with `duesStatusBadge()`: No Due Date / Overdue / Due Soon (≤7 days) / Current.

**Payables**: exact mirror using `purchases`/suppliers.

### 6.8 Other notable business logic & validation rules

- **Deliberate, non-interchangeable floating-point tolerances**: `0.004` (line/amount effectively zero), `0.01` (journal balance), `0.02` (Trial Balance/Balance Sheet "balanced"), `0.5` (invoice/purchase "still outstanding").
- **Every deletion of a financial record reverses its journal entry first** — there's no reachable "orphaned journal entry" state through normal UI flows.
- **No account can be deleted once posted to.**
- **Deleting a category never rewrites historical records** — every expense/payment keeps a denormalized snapshot valid at the time.
- **Location-scoping is pervasive but inconsistent by design**: Cash Book, Daily Expenses, and payroll's Shop Earnings Summary are scoped to `currentLocationId`; Accounting statements and GST Filing aggregate across **all** locations combined (the parameter for location-filtering exists on `accountBalance`/`accountBalanceInRange` but isn't used by those renderers today — a developer adding per-location P&L/Balance Sheet would just need to pass it through).
- **Payment mode granularity is lost at the accounting layer**: the Chart of Accounts only distinguishes Cash vs. Bank, even though the UI captures 6 modes — a "by payment method" report would need to read `expenses`/`cashEntries`/`payments` directly, not the accounts layer.

---

## 7. Cloud Sync Architecture (sync-engine.js & sync-rules.js)

This is the shared cloud-sync core that both the whole-document sync and the older real-time collections (Customers, Suppliers, Business Settings) build on directly; Products/Invoices/Stock Movements/Locations extend the same patterns in their own files (§4.5, §5.7).

### 7.1 Firebase Initialization & Auth

**`initCloudSync()`** — no-ops if already initialized; returns `false` (not an error) if the Firebase SDK didn't load or the config is incomplete; idempotent `firebase.initializeApp()`; init errors are caught and turned into `return false` rather than propagating.

**`friendlyFirebaseError(e)`** — translates SDK error codes into actionable, shop-owner-facing sentences (network/firewall issues suggest trying a mobile hotspot to isolate the cause; wrong password; no such user; disabled account; rate-limited; Firestore unreachable; permission-denied suggests checking active-membership status and security rules), falling back to the raw message for anything else so nothing is silently swallowed.

**`verifyFirebaseMembership(user)`** — throws immediately for no user/anonymous user. Short-circuits if already verified this session (`firebaseMembershipVerifiedUid===user.uid`). Otherwise reads the membership doc; **if the read itself throws** (a network/transport failure), the error is tagged `e.isMembershipCheckNetworkError=true` and rethrown **without signing the user out** — a dropped connection is not the same thing as "this account isn't a member," and the tag lets the UI show an honest "couldn't verify, try again" instead of bouncing the user to the login screen as if the password were wrong. Only if the read *succeeds* and the doc is missing/inactive does it sign out and throw a real rejection.

**`ensureCloudAuth()`** — throws if not signed in, else delegates to `verifyFirebaseMembership()`. Called at the top of every sync operation.

### 7.2 The Whole-Document Sync Cycle

**`cloudDocRef()`** — `businesses/{businessCode}/data/main`, the single shared document for every interval-synced collection (subject to Firestore's 1 MiB document size limit).

**`syncedCollections()`** — returns `{key, get, set, save}` descriptors for: `products`, `customers`, `invoices` (special-cased, see below), `suppliers`, `purchases`, `stockMovements`, `physicalCounts`, `quotations`, `deliveryNotes`, `creditNotes`, `debitNotes`, `expenses`, `expenseCategories`, `locations`, `transfers`, `cashEntries`, `whatsappCampaigns`, `accounts`, `journalEntries`, `payrollEntries`, `staffMembers`, `staffPayments`, `activityLog`. Notably absent: `users`/`groups` (retired with local logins). Three collections (`products`, `invoices`, `stockMovements`) also have their own separate real-time per-record sync path, and running both simultaneously is a deliberate, documented-safe choice — the real-time paths are diff-based/additive, so an occasional redundant whole-document write is harmless.

**The `invoices` special case**: `get()` filters to `gstApplicable!==false`; `set(v)` reconstructs the full array by re-appending the untouched local Without-GST invoices. Because Without-GST invoices were never part of `lastSyncSnapshot`, they're structurally invisible to the deletion-detection logic, not just filtered at the edges. This rule is deliberately implemented **twice independently** — here and as `syncableInvoices()` in `sales.js` — so each mechanism independently honors it.

**`runSyncCycle(silent)`** — step by step: re-entrancy guard → config/library guard → offline guard (no network attempt if `navigator.onLine===false`) → `ensureCloudAuth()` → fetch the cloud doc → for every collection, `mergeCollectionById(local, cloud, lastSynced)` (all three run through `syncRecordsForCollection()` first) → persist locally → build the payload (merged collections + `settings` + `pushedAt`) → **size guard**: refuses with a clear error if the payload exceeds 900,000 bytes (deliberately below Firestore's real 1,048,576-byte limit, checked before the network write) → write the full document → update `lastSyncSnapshot` **only after a confirmed successful write** → update `lastSyncedAt`, alert if not silent, render. Any error is caught centrally, sets a "will retry automatically" status, and alerts (if not silent) with `friendlyFirebaseError(e)`.

**`restartAutoSync()`** — clears any existing timer, starts a new `setInterval(()=>runSyncCycle(true), minutes*60*1000)` only if `syncIntervalMinutes>0` and the config is present; background cycles are always silent.

### 7.3 `mergeCollectionById()` and Friends — the merge algorithm and its known limitation

Isolated in `sync-rules.js` specifically so it's unit-testable independent of any network call; exported as `window.WholesaleLedgerSync`.

**`mergeCollectionById(localArr, cloudArr, lastSyncedArr)`** — the exact algorithm:
```js
const lastSyncedIds = new Set(lastSyncedArr.map(r=>r&&r.id).filter(Boolean));
const localIds = new Set(localArr.map(r=>r&&r.id).filter(Boolean));
const locallyDeletedIds = new Set([...lastSyncedIds].filter(id=>!localIds.has(id)));
const byId = {};
cloudArr.forEach(r=>{ if(r && r.id && !locallyDeletedIds.has(r.id)) byId[r.id] = r; });
localArr.forEach(r=>{ if(r && r.id) byId[r.id] = r; });
return Object.values(byId);
```
`locallyDeletedIds` = ids present in the last-synced snapshot but no longer present locally — a deletion-detection heuristic entirely local to **this device**. The merge lays down cloud records (excluding those flagged locally-deleted), then unconditionally overwrites with every local record. So: local always wins on conflicts, a same-device deletion-since-last-sync is correctly dropped, and a cloud record never in `lastSyncedArr` (created elsewhere since this device's last sync) is picked up automatically.

**This is the root cause of this codebase's historical duplicate/resurrected-record bug class.** The only signal for "this record was deleted" is comparing *this device's own* local array against *its own* last-synced snapshot — there is no tombstone, no cloud-side deletion marker. Concretely: Device A deletes location X and syncs (cloud no longer has X; A's own snapshot no longer has X). Device B, which never independently deleted X, still has X locally (never removed from `localArr`), so X is **not** in B's `locallyDeletedIds` — B's deletion-detection is entirely blind to "the cloud/another device deleted this." On B's next merge, the final `localArr.forEach()` step unconditionally re-adds X, and B's next push resurrects X in the cloud. This is exactly the "shop location keeps reappearing" bug class, and it's why deletions only reliably propagate when the *deleting* device is the one that syncs. A real fix would need tombstone records propagated through the cloud document, not a call-site patch. (This is precisely why Locations was moved off this mechanism entirely onto its own real-time per-record sync — see §4.5.)

**`mergeProductImages(localMap, cloudMap)`** — a simple object-spread (`{...cloudMap, ...localMap}`): last-write-wins-by-local, additive-only, with **no deletion detection at all** — deleting a product image locally can never remove it from the cloud copy via this path.

**`syncRecordsForCollection(collectionKey, records)`** — normalizes non-array input to `[]`, and for `'invoices'` specifically filters `gstApplicable!==false`; applied to local/cloud/snapshot inputs symmetrically inside `runSyncCycle`'s merge loop.

### 7.4 Real-Time Business Settings Sync

A parallel, independent real-time channel — separate document (`businesses/{businessCode}/settings/main`), separate merge rule, layered on top of (not replacing) the interval sync's inclusion of `settings` in its payload.

**`syncableBusinessSettings(s)`** — the whitelisted subset: business profile fields (name/GSTIN/state/city/pincode/phone/email/address/logo), all six document-numbering prefix+sequence pairs, bank details. Deliberately **excludes** `settings.firebase.*` (per-device config) and `settings.whatsapp`.

**`BUSINESS_SETTINGS_COUNTER_FIELDS`** — the six numbering sequence counters — are merged with **`max(local, remote)`** everywhere, never last-write-wins, because a blind overwrite could move a counter *backward* and cause a document number to be reused/collide. Everything else uses ordinary last-write-wins.

**Push** (`pushBusinessSettingsDelta`/`doPushBusinessSettingsDelta`) is serialized through a lock promise (same pattern as Products' push lock) and diff-skips if nothing in the syncable subset actually changed — important because `saveSettings()` fires after essentially every settings-related save for any reason. The snapshot used for diffing is only ever updated after a confirmed successful write.

**`enableRealtimeBusinessSettings(silent)`** — the ordering here is explicitly called out as important and was gotten right from the start (unlike Products, where the same mistake had to be found and fixed after the fact): it captures `lastPushedBusinessSettingsSnapshot` from the current cloud doc **before** merging that doc into local settings, so the push immediately following can correctly detect what actually needs writing back.

### 7.5 Everything Else

Nothing in either file is uncovered by the above. One structural point worth restating for anyone extending this system: **`sync-rules.js` has no deletion-detection concept for `mergeProductImages`, and `mergeCollectionById`'s deletion detection is fundamentally single-device/single-snapshot-scoped** — any future fix for the resurrected-record bug class would need to change this algorithm's shape (tombstones propagated through the shared document), not just patch individual call sites. The `applyIncomingBusinessSettings` counter-merge rationale references a comment on `businessSettingsRealtimeActive` located in `app.html`, worth reading together with this section for full context.

---

## 8. PWA, Packaging & Deployment

### 8.1 Progressive Web App

**`manifest.json`** — standalone display mode, `start_url: "./app.html"`, dark theme colors (`#0F1626` background, `#172033` theme), 192×192 and 512×512 icons. Only takes effect when the app is served over HTTPS (or localhost); harmless as a local file or in Electron.

**`service-worker.js`** — `CACHE_NAME` is versioned in lockstep with `APP_VERSION` (currently `hynish-clothing-shell-v2.86.1`) and must be bumped on every release or old clients keep serving a stale cached shell. On `install`, precaches the app shell (`app.html`, manifest, icons, styles, every `src/*.js` file, every `vendor/*` script) file-by-file rather than via `cache.addAll()`, specifically so one missing/renamed file after an update can't take down offline caching for everything else. On `activate`, deletes any cache whose key isn't the current `CACHE_NAME`. On `fetch`: **only intercepts same-origin GET requests** — this is a fixed bug (v2.85.0): the service worker used to intercept every GET including cross-origin Firebase Auth/Firestore/Storage calls, and its offline-fallback `catch()` could substitute the app's own HTML as a fake "response" to a failed Firebase call, which the Firebase SDK then tried to parse as an auth response — occasionally surfacing as a bogus failure that signed a user straight back out seconds after a successful login. Now Firebase calls always reach the network exactly as if no service worker existed. For same-origin requests: cache-first, falling back to network-then-cache-the-response; on a network failure, only a full-page navigation falls back to the cached shell — any other failed same-origin request (a script file) fails honestly rather than silently receiving the HTML shell in its place (the same class of bug as the cross-origin case, just for this app's own files).

### 8.2 Firebase Hosting / Firestore / Storage deployment (`firebase.json`)

Hosting serves the project root (`.`), with an extensive `ignore` list excluding config files, rules files, markdown docs, screenshots, `node_modules`, `dist`, `tests`, and `package.json`/`package-lock.json`/`main.js` (the Electron-only files never need to ship to the web deployment). Rewrites `/` to `/app.html`. Sets `no-cache`/`no-store` headers on `service-worker.js` and `manifest.json` specifically, so a browser never serves a stale copy of the files that control caching itself. Firestore and Storage rules are pointed at `firestore.rules`/`storage.rules` respectively — both need `npx firebase-tools deploy --only firestore:rules` / `--only storage` whenever they change; a code edit alone does not deploy rules changes.

### 8.3 Storage security rules (`storage.rules`)

Mirrors the same "active member of this business" check as Firestore, but for Cloud Storage: product photos live at `businesses/{businessCode}/productImages/{fileName}.jpg` (see `productImageStorageRef()` in `inventory.js`, used when the "store photos in Cloud Storage" setting is on), and access requires `request.auth != null` plus a Firestore cross-reference confirming the signed-in user's membership doc exists and is `active`. Every other path is default-deny (`allow read, write: if false`). Without this file, the comment notes the bucket would either default-deny everything (buckets created after June 2024) or be wide open to anyone with the project's public config (older default rules) — this file is what makes Storage enforce the same membership check Firestore already enforces.

### 8.4 Electron desktop packaging

`package.json` defines the Windows desktop build: `electron` + `electron-builder` (NSIS installer and a portable .exe, both x64), `electron-updater` as a runtime dependency for auto-update support, and a `files` list for the packaged app (`main.js`, `app.html`, `styles.css`, icons, `package.json`, everything under `src/**` and `vendor/**`). The `publish` block points at a GitHub-releases provider (placeholder owner/repo — needs real values before auto-update publishing works). `npm run dist` builds via `electron-builder --win`; `npm start` runs the unpacked app via `electron .`. `npm test` runs `node tests/run-all.js`. The app's `version` field must be kept in lockstep with `APP_VERSION` (app.html) and `CACHE_NAME` (service-worker.js) on every release — this is a manual, three-place bump with no single source of truth enforced in code.

---

## 9. Known Limitations & Honest Caveats

This section consolidates every gap, open issue, or explicitly-flagged limitation surfaced across the six modules above — pulled directly from the code's own comments, not inferred. None of these are secret; they're documented in-place in the source, but gathered here so a developer sees the whole risk picture in one place.

**Sync & data integrity**

- **Invoice-number collisions across devices are not fully solved.** `nextInvoiceSeq`/`nextInvoiceSeqNoGst` are per-device counters. Real-time sync makes an already-numbered invoice visible to other devices faster, and Business Settings' `max(local,remote)` counter merge stops a counter moving backward, but two devices billing within the same few seconds — before either has pushed — can still generate the same invoice number. A real fix needs a server-side atomic counter (Cloud Functions), which doesn't exist in this stack.
- **`mergeCollectionById`'s deletion detection is single-device-scoped**, with no tombstone mechanism. A deletion is only detectable by the device that performed it, only for as long as it remembers the record via its own `lastSyncSnapshot`. Any collection still relying on this mechanism (everything in `syncedCollections()` that hasn't been migrated to its own real-time collection) can still exhibit the "resurrected record" bug class that was fixed for Locations in v2.86.0 — Products, Invoices, and Stock Movements were migrated to real-time sync specifically to escape this; anything else added to `syncedCollections()` in the future inherits the same risk until it gets the same treatment.
- **`mergeProductImages` has no deletion detection at all** — it's a pure additive object-spread. Deleting a product photo locally can never remove it from the cloud copy through the whole-document sync path.
- **The Firestore security rules gap is deliberate, not accidental**: the shared `data/main` document's rule still technically permits writing `products`/`invoices`/`stockMovements` fields through the legacy whole-document sync path, even though those collections now have stricter per-record rules (e.g. delete is admin-only). This wasn't closed because other legacy parts of the app still depend on the shared document being writable.
- **`locationName`/`tabs` restrictions on a membership doc are app-layer only** — not enforced by Firestore security rules. Someone with the raw Firebase project credentials could bypass a shop account's tab/location restriction by talking to the Firestore API directly.
- **Cloud Sync has never been tested against a live Firebase project** by the person who wrote this code (per the code's own "Honestly" disclaimer in Settings) — it's built correctly against Firebase's documented API surface, but recommend testing against a throwaway project with non-critical data first, and keeping local backups regardless of Cloud Sync being enabled.
- **Stock Movement real-time sync's first-time enable downloads the entire historical ledger** — for a shop with years of history, this could be tens of thousands of documents, counting fully against Firestore's read quota on that one enable.
- **A same-field edit on two devices before either syncs is last-write-wins with no field-level merge** (e.g. one customer's phone number edited differently on two offline devices) — only true for edits to an *existing* record; new records created independently are never at risk of being lost this way.

**Accounting**

- **Payment mode granularity is lost at the accounting layer.** The Chart of Accounts only distinguishes Cash vs. Bank (`cashOrBankAccount()`); UPI, Card, Cheque, Bank Transfer, and Other all collapse into "Bank." A "sales by payment method" report needs to read `expenses`/`cashEntries`/`payments` records directly — that data isn't reconstructable from the journal/accounts layer.
- **Trial Balance / P&L / Balance Sheet are not location-scoped**, even though `accountBalance`/`accountBalanceInRange` already accept a `locationId` parameter — the renderers simply don't pass it. A developer wanting per-location financial statements can extend the existing renderers rather than the underlying functions.
- **No automatic commission calculation** for shop-level payroll — the UI's own help text says this used to be computed from an individual staff member's rate before local per-staff logins were retired, and now must be worked out manually and typed in as the payment amount.

**GST / tax**

- **A customer with no `state` set is always treated as intra-state** (`taxTypeFor()` defaults to `"intra"` if either the business's or the customer's state is blank), even if the customer is genuinely in another state — this silently produces CGST+SGST instead of IGST until the customer's state field is filled in.
- **A line's GST rate is snapshotted at the moment it's added to a bill** and is never recalculated if the product's rate changes later — correct for historical accuracy, but worth knowing if a rate change doesn't seem to be reflected on an in-progress draft.
- **GST Filing's readiness checks are explicitly "not a substitute for review by a CA"** — they catch the most common data-quality issues (missing business GSTIN, malformed customer GSTINs, missing HSN codes) but don't validate against actual GST law.

**Miscellaneous / dead code**

- **`exportAllData()`'s backup JSON stamps a hardcoded `version: '2.16.0'`**, unrelated to and far behind the live `APP_VERSION` (`2.86.1` as of this writing) shown elsewhere on the same Settings screen — don't trust a backup file's stamped version to reflect the app version that produced it.
- **`renderDashboard()` computes `alerts` and `recentActivity` but never renders either** — leftover dead code from an earlier layout.
- **The Dashboard sales-trend chart legend advertises a "Number of Bills" series that is never actually plotted** — only daily total sales value is charted.
- **`isPrimaryShopSession()` is an identity signal only, not yet wired to any behavior.** It's meant to eventually support Without-GST bills created away from the shop safely queuing in the cloud until the shop's own device can "claim" them — the code explicitly flags this as unbuilt, citing open questions around invoice-numbering and stock-deduction timing that would need to be resolved first.
- **The Electron app's version, `APP_VERSION` in app.html, and `CACHE_NAME` in the service worker are three separate manual bumps** with no single source of truth enforced anywhere in code — a past release once shipped with the sidebar footer two versions behind because one of the three was forgotten.

---

## 10. Where to Go From Here

Every version's exact change history — what was fixed, why, the root cause, what was deliberately left alone, and what's honestly still open — is recorded in `CHANGELOG.md` in this same project, in a consistent Why/Root cause/What changed/Explicitly NOT changed/Tested/Honestly still open format for every release from the app's early history through the current v2.86.1. That file is the right place to look for the story behind any specific past fix; this document is the right place to look for how the system works today, end to end.
