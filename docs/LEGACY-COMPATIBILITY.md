# Legacy Compatibility Inventory

> **Phase 0 deliverable.** Inventory of every feature, default, setting, validation and business behavior in the legacy **Hynish Clothing — Wholesale Ledger ERP v2.86.1**. The rebuild must keep all of them unless this document says otherwise and gives a reason.

## How to use this document

- **Source of truth:** `docs/legacy/TECHNICAL-DOCUMENTATION.md` ("TD"), written from the legacy source. References look like `TD §5.2`.
- **Legacy source code was not available in this repository in Phase 0.** Anything the TD doesn't state explicitly is marked **NOT VERIFIED**. Where it matters, it is tracked in `docs/OPEN-QUESTIONS.md` (`OQ-xx`).
- **Status markers**
  - `VERIFIED`: stated explicitly in the TD.
  - `PARTIAL`: the behavior is stated, but some details (exact lists, labels, defaults) are not.
  - `NOT VERIFIED`: inferred or absent. Don't implement it as a business rule without a decision.
- **New implementation requirement** tells later phases what to build. `BR-*` refers to `docs/BUSINESS-RULES.md`, and `DM` refers to `docs/DATA-MODEL.md`.
- **Compatibility principle:** keep the **business behavior**. Replace an **implementation** only where the legacy one is unsafe. Every replacement says **why**.

### Feature item format

Each feature item (`LC-<section>.<n>`) lists:
**Behavior** (existing behavior) · **Default** (existing default) · **Validation** · **Depends on** (dependencies) · **User sees** (user-visible behavior) · **New** (new implementation requirement) · **Status**

---

## 1. Application Defaults

Every default below must be kept. "Superseded" means the default only applied to a legacy mechanism that the new architecture replaces. The reason is given in each case.

| ID | Default | Legacy value | Source | New requirement |
|---|---|---|---|---|
| DEF-001 | GST invoice prefix | `INV` | TD §2.3, §3.2 | Preserve as settings default |
| DEF-002 | GST invoice next sequence | `1` | TD §2.3 | Preserve; server counter initial value |
| DEF-003 | Without-GST invoice prefix | `NGST` | TD §2.3 | Preserve |
| DEF-004 | Without-GST invoice next sequence | `1` | TD §2.3 | Preserve; separate server counter |
| DEF-005 | Quotation prefix | `QUO` | TD §2.3 | Preserve |
| DEF-006 | Quotation next sequence | `1` | TD §2.3 | Preserve |
| DEF-007 | Delivery Note prefix | `DN` | TD §2.3 | Preserve |
| DEF-008 | Delivery Note next sequence | `1` | TD §2.3 | Preserve |
| DEF-009 | Credit Note prefix | `CN` | TD §2.3 | Preserve |
| DEF-010 | Credit Note next sequence | `1` | TD §2.3 | Preserve |
| DEF-011 | Debit Note prefix | `DBN` | TD §2.3 | Preserve |
| DEF-012 | Debit Note next sequence | `1` | TD §2.3 | Preserve |
| DEF-013 | Invalid/blank prefix or sequence on Settings save | falls back to DEF-001..012 | TD §3.2 | Preserve (server-side validation too) |
| DEF-014 | Document number format | `PREFIX/<FY>/<seq padded to 4>` e.g. `INV/2627/0001` | TD §3.2, §2.7 | Preserve exactly. Sequence reset behaviour at FY change is **NOT VERIFIED** (OQ-03) |
| DEF-015 | Financial year | starts in April; label is two 2-digit years, e.g. `2425` | TD §2.7 | Preserve (`fyLabel`) |
| DEF-016 | **New Bill GST mode** | **Without GST** (`draft.gstApplicable:false`) | TD §5.2 | **Preserve. New Bill opens as Without GST.** |
| DEF-017 | New Bill payment status | `'paid'` | TD §5.2 | Preserve (interaction with paidAmount: OQ-18) |
| DEF-018 | New Bill paid amount | `0` | TD §5.2 | Preserve |
| DEF-019 | Stored invoice with missing `gstApplicable` | treated as **GST applicable** (`!==false`) | TD §5.3 | Preserve in migration/readers |
| DEF-020 | Repeat scan/search of same product+variant | increments qty of the existing line | TD §5.2 | Preserve |
| DEF-021 | Line GST rate source | snapshotted from the product when the line is added | TD §5.2, §9 | Preserve |
| DEF-022 | New Purchase draft | `status:'unpaid'`, `paidAmount:''`, `dueDate:''` | TD §4.6 | Preserve |
| DEF-023 | Low-stock threshold | `5` when product threshold is 0/blank | TD §2.7, §4.1 | Preserve via single helper |
| DEF-024 | GST rate list | `0, 0.25, 3, 5, 12, 18, 28, 40` (%) | TD §2.1 | Preserve |
| DEF-025 | Suggested GST rate (product form only) | price > 2500 → 18 %, else 5 % (suggestion, not enforced) | TD §2.7, §5.2 | Preserve |
| DEF-026 | Units | `Pcs, Set, Pair, Mtr, Kg, Box, Dozen` | TD §2.1 | Preserve |
| DEF-027 | GST state codes | all 38 GST state/UT codes → names | TD §2.1 | Preserve (exact table: port from legacy source, OQ-11) |
| DEF-028 | Quick-add customer state | business's own state | TD §5.1 | Preserve |
| DEF-029 | Tax type when seller or buyer state blank | **intra** (CGST+SGST) | TD §5.2, §9 | Preserve (OQ-22 on warning) |
| DEF-030 | Seed locations | 4 fixed-id records `loc-baby-step`, `loc-cool-kids`, `loc-quency-culture`, `loc-hynish-wh` | TD §4.2 | Preserve for Hynish migration; applicability to new businesses (OQ-09) |
| DEF-031 | Current working location fallback | first location | TD §2.7 | Preserve |
| DEF-032 | Legacy expense without `locationId` | backfilled to first location | TD §2.7 | Preserve in migration |
| DEF-033 | Expense categories | Rent, Electricity, Water, Staff Salary/Wages, Transport/Delivery, Packing Material, Stationery/Printing, Maintenance & Repairs, Marketing/Advertising, Tea/Refreshments, Bank Charges, Other | TD §6.1.2 | Preserve |
| DEF-034 | Chart of Accounts | 14 system accounts (see §30) | TD §6.1.1 | Preserve ids + types |
| DEF-035 | Auto expense account per category | code 5100, step 10 | TD §6.1.1 | Preserve |
| DEF-036 | Custom account code when blank | max code of same type + 10 | TD §6.1.1 | Preserve |
| DEF-037 | Deterministic ids | category `exp-cat-<slug>`, account `acc-<slug>` | TD §6.1.2 | Preserve id scheme |
| DEF-038 | Cash In categories | Sales Collection (Cash), Customer Payment Received, Capital Introduced, Loan/Advance Received, Other Income | TD §6.3 | Preserve |
| DEF-039 | Cash Out categories | Supplier Payment, Expense Payment, Staff Salary/Commission, Owner Drawings, Bank Deposit, Loan Repayment, Other | TD §6.3 | Preserve |
| DEF-040 | Payment modes | Cash, Bank Transfer, UPI, Cheque, Card, Other; non-Cash books to Bank Account | TD §6.1.6 | Preserve (default selected mode NOT VERIFIED) |
| DEF-041 | At-billing paid amount posting | always Dr Cash in Hand regardless of mode | TD §6.1.5 | Preserve (OQ-07) |
| DEF-042 | Tab access | owner/admin: all tabs; shop: `DEFAULT_SHOP_TABS` unless membership `tabs` set | TD §2.4 | Preserve concept |
| DEF-043 | Hard-blocked for non-admins | Settings, Users, Locations | TD §2.4 | Preserve (server-enforced) |
| DEF-044 | `DEFAULT_SHOP_TABS` | day-to-day billing/stock; **never** Settings, Users, Locations, Accounting, Cash Book, Expenses, Dues, GST Filing | TD §2.4 | Preserve exclusions; exact inclusion list **NOT VERIFIED** (OQ-10) |
| DEF-045 | Re-auth max age | 30 days | TD §2.4 | Preserve |
| DEF-046 | Landing tab after interactive login | Dashboard | TD §2.4 | Preserve |
| DEF-047 | Theme preference | `light` / `dark` (default value **NOT VERIFIED**) | TD §2.3 | Expand to Light/Dark/System (OQ-08) |
| DEF-048 | Sync interval | 2 min (Off/1/2/5/10/15/30/60) | TD §3.2 | **Superseded**: interval sync replaced by per-record realtime |
| DEF-049 | Store product photos in Firebase Storage | off | TD §3.2 | **Superseded**: photos always go to Storage (base64 in data docs is unsafe/oversized) |
| DEF-050 | First connect enables every realtime collection | on | TD §2.5 | **Superseded**: realtime is always on |
| DEF-051 | Dashboard trend range | 14 / 30 / 90 days (initial choice NOT VERIFIED) | TD §3.1 | Preserve options |
| DEF-052 | Dashboard lists | Recent invoices top 4; Low-stock table 4 rows; 6 quick actions | TD §3.1 | Preserve counts |
| DEF-053 | Shop Comparison range | start-of-month → today | TD §3.5 | Preserve |
| DEF-054 | Profit & Loss range | current month-to-date | TD §6.2 | Preserve |
| DEF-055 | Sales Reports grouping | day/week/month, last 14 periods | TD §3.7 | Preserve |
| DEF-056 | Cash analysis & expense trend | 14 buckets (day/week/month) | TD §6.3, §6.4 | Preserve |
| DEF-057 | Reorder planning | history 7/30/60/90 days; target 14/30/60 days; include if any sale or stock ≤ 5 (initial selections NOT VERIFIED) | TD §4.7 | Preserve |
| DEF-058 | Global search | max 5 per category | TD §2.7 | Preserve |
| DEF-059 | Product search at billing | max 8 results | TD §4.7, §5.2 | Preserve |
| DEF-060 | Activity log view | most recent 300 | TD §3.4 | Preserve (paged beyond) |
| DEF-061 | Logo compression | ≤ 240 px long side, JPEG q 0.85 | TD §3.2 | Preserve |
| DEF-062 | Product photo compression | ≤ 500 px long side, JPEG q 0.78 | TD §4.1 | Preserve |
| DEF-063 | Barcode sheet | CODE128, 4 × 10 labels per A4 | TD §4.4 | Preserve |
| DEF-064 | Barcode value fallbacks | product: last 8 chars of id; variant suffix: size+color or last 4 chars of variant id; render fallback `NA` | TD §4.4 | Preserve (id-derived fallback: see BR-BAR-02) |
| DEF-065 | Tolerances | 0.004 (zero), 0.01 (journal balance), 0.02 (TB/BS balanced), 0.5 (outstanding) | TD §6.8 | Preserve semantics in paise (DM §2) |
| DEF-066 | "Due Soon" window | ≤ 7 days | TD §6.7 | Preserve |
| DEF-067 | Grand total rounding | nearest rupee, delta booked as `roundOff` | TD §5.2 | Preserve |
| DEF-068 | Valid date input years | 1990–2200 | TD §2.7 | Preserve |
| DEF-069 | Backup file name | `wholesale-ledger-backup-<date>.json` | TD §3.2 | Preserve naming pattern |
| DEF-070 | Location types | `shop` / `warehouse` | TD §4.2 | Preserve |
| DEF-071 | PWA manifest | standalone; background `#0F1626`; theme `#172033`; icons 192/512 | TD §8.1 | Preserve standalone + icon sizes; colors follow new theme |
| DEF-072 | Business code | hardcoded `hh-erp-2026` | TD §2.3 | **Superseded** by `businessId`; migration maps it |
| DEF-073 | CN/DBN `restock` checkbox | exists (initial state NOT VERIFIED) | TD §5.5 | Preserve option |
| DEF-074 | Invoice/DN stock shortage | confirm-to-override, not a block | TD §5.8 | Preserve |
| DEF-075 | Customer credit limit exceeded | confirm, not a block | TD §5.1 | Preserve |
| DEF-076 | Dashboard scoping | sales & dues KPIs **all locations**; low stock **current location** | TD §3.1 | Preserve (OQ-23 for restricted users) |

---

## 2. Business Settings

**LC-2.1 — Business identity**
- **Behavior:** Business Name, GSTIN, Address, City, State, Pincode, Phone, Email, Business Logo, License key (`licenseKey`).
- **Default:** blank.
- **Validation:** fields trimmed; GSTIN auto-uppercased; typing a GSTIN auto-fills State via `stateFromGSTIN()` (first 2 digits → `GST_STATE_CODES`).
- **Depends on:** GST engine (seller state), printed documents, GST Filing readiness (seller GSTIN required), sidebar logo.
- **User sees:** "Setup needed" banner on Dashboard when name or state is missing. Every tab except Settings shows a non-blocking warning banner when business name is empty.
- **New:** `settings/business` doc (DM §6.4), edited by owner/admin via server callable. Preserve GSTIN→State auto-fill, both banners and `licenseKey` (meaning: OQ-26).
- **Status:** VERIFIED (TD §2.3, §3.2, §2.7).

**LC-2.2 — Document numbering settings**
- **Behavior:** separate prefix + next-sequence for GST Invoice, Without-GST Invoice, Quotation, Delivery Note, Credit Note, Debit Note. Format `PREFIX/2627/0001`.
- **Default:** DEF-001…DEF-014.
- **Validation:** invalid prefix or sequence falls back to the default on save.
- **Depends on:** every document-creation flow.
- **User sees:** Document Numbering card in Settings.
- **New:** keep the card with all 12 fields. The prefix is stored in settings. The sequence is shown from, and edited through, the server counter (BR-NUM-*). Counters are only ever *assigned* by server transactions.
- **Status:** VERIFIED.

**LC-2.3 — Bank details**
- **Behavior:** Bank Name, Account Number, IFSC, printed on invoices.
- **Default:** blank.
- **Validation:** NOT VERIFIED (no IFSC format check documented).
- **Depends on:** invoice PDF.
- **User sees:** Bank Details card, and bank block on the printed invoice.
- **New:** preserve all three fields and print them. Don't add IFSC format blocking without a decision (a non-blocking hint is allowed).
- **Status:** VERIFIED.

**LC-2.4 — Theme preference**
- **Behavior:** `settings.theme` is `light` or `dark`.
- **Default:** NOT VERIFIED.
- **Depends on:** UI.
- **User sees:** theme toggle.
- **New:** Light/Dark/System, stored per user and per device (UI-UX §3.4). Default: OQ-08.
- **Status:** PARTIAL.

**LC-2.5 — WhatsApp settings**
- **Behavior:** `whatsapp:{provider, apiKey, phoneNumberId, businessAccountId, notes}`. Card is labelled "Coming Soon". Entering credentials does **not** enable sending.
- **Default:** blank.
- **Depends on:** WhatsApp campaign drafts (§45).
- **User sees:** card with caveat text.
- **New:** preserve the settings concept. The **API key must never be stored in a client-readable Firestore doc**. Store it in Secret Manager or a server-only doc (SECURITY §9). Scope: OQ-14.
- **Status:** VERIFIED.

**LC-2.6 — Cloud Sync settings**
- **Behavior:** sync interval, Sync Now, product-photos-to-Storage toggle, 7 realtime toggles, pasteable security rules, "Honestly" caveat, primary-device indicator.
- **Default:** DEF-048…DEF-050.
- **User sees:** Cloud Sync card + 7 realtime cards.
- **New:** **superseded.** The new model is always-realtime Firestore with server writes, so there is nothing for the user to toggle. Replace the card with a read-only **Connection & Sync status** panel (online/offline, last server contact, pending writes). Security rules are deployed via CI, not pasted.
- **Status:** VERIFIED (superseded, see §42/§43).

**LC-2.7 — Save behavior**
- **Behavior:** `saveSettingsForm()` trims, uppercases GSTIN, applies fallbacks, saves, logs `settings_updated`, shows a toast.
- **New:** same, done server-side in the callable, with an activity log entry.
- **Status:** VERIFIED.

**LC-2.8 — "Business details likely not loaded" banner**
- **Behavior:** shown when realtime Business Settings isn't active and every profile field is blank. Offers Retry Now.
- **New:** keep the *intent*: never show a blank business profile silently. Show a loading state until the settings snapshot arrives, and an error + retry state if it fails. The legacy trigger condition no longer applies.
- **Status:** VERIFIED (mechanism superseded).

**LC-2.9 — About card**
- **Behavior:** app name + `APP_VERSION` + feature summary.
- **New:** preserve. Version comes from a single build-time source (fixes the legacy three-place version bump).
- **Status:** VERIFIED.

**LC-2.10 — Danger Zone: Reset All Data**
- **Behavior:** double confirmation, listing exactly what is wiped. Does NOT delete or sign out Firebase accounts. Disables listeners first. Re-seeds categories, locations and accounts. Never deletes the cloud stock-movement copy.
- **User sees:** red card.
- **New:** preserve as a server operation gated by the `data.reset` permission (owner and admin by default, legacy parity; narrowing to owner-only is OQ-02). It requires re-authentication, a typed confirmation and an automatic pre-reset backup. It is audited. The server performs the wipe. It never deletes auth accounts or memberships. It does not hard-delete stock movements: they are archived with the rest of the wiped data under the reset id (BR-ADM-03).
- **Status:** VERIFIED.

---

## 3. Authentication

**LC-3.1 — Email/password login**
- **Behavior:** Firebase email/password, one account per device/shop. No in-app sign-up. Accounts are created in the Firebase Console.
- **Validation:** email and password must both be non-empty. `friendlyFirebaseError()` translates error codes into plain messages (network/hotspot hint, wrong password, no user, disabled, rate-limited, Firestore unreachable, permission-denied).
- **User sees:** login screen. Nothing else renders until sign-in succeeds.
- **New:** Firebase Auth email/password. No public sign-up (preserve). Friendly error mapping preserved. Member provisioning path: OQ-02.
- **Status:** VERIFIED (TD §2.4, §7.1).

**LC-3.2 — Membership gate**
- **Behavior:** access requires `businesses/{code}/members/{uid}` with `active:true`. If the membership read fails because of the **network**, the user is **not** signed out and sees "couldn't verify, try again". If the doc is missing or inactive, the user is signed out.
- **New:** preserve both branches. Membership is enforced in Firestore rules **and** in every callable (SECURITY §4).
- **Status:** VERIFIED.

**LC-3.3 — Forced re-authentication**
- **Behavior:** a restored session older than 30 days since the last interactive login is signed out with "Your sign-in has expired." A fresh interactive login is never affected.
- **Default:** 30 days.
- **New:** preserve. Enforce server-side as well, using the ID token `auth_time`, so a direct API caller can't bypass it (SECURITY §3).
- **Status:** VERIFIED.

**LC-3.4 — Login/logout activity**
- **Behavior:** interactive login logs `login` and lands on Dashboard. Logout logs `logout`, clears state and re-renders.
- **New:** preserve. On sign-out, also clear any local persistent cache (PWA §10, SECURITY §14).
- **Status:** VERIFIED.

**LC-3.5 — Concurrent sign-in race fix**
- **Behavior:** the `interactiveSignInInFlight` flag prevents a double `applySignedInFirebaseUser`, which could otherwise sign a brand-new login straight back out.
- **New:** preserve the guarantee (a fresh login is never treated as an expired restored session) with a single auth state machine in the auth store.
- **Status:** VERIFIED.

---

## 4. User Roles

**LC-4.1 — Legacy roles**
- **Behavior:** membership `role` is `owner`, `admin` or `shop` (anything that isn't owner/admin is treated as non-admin). `isAdmin = owner || admin`.
- **User sees:** admins see everything. Shop accounts see a tab subset.
- **New:** preserve owner/admin/shop semantics exactly. The requested **Manager, Accountant, Staff** roles **do not exist in the legacy app (NOT VERIFIED)**. Their permissions require a decision (OQ-02). The permission model is centralized and data-driven so adding roles doesn't change code paths (SECURITY §5).
- **Status:** VERIFIED for owner/admin/shop.

**LC-4.2 — Staff directory is not a login**
- **Behavior:** `staffMembers` are payroll records only and have no auth relationship.
- **New:** preserve the separation. Staff ≠ Member.
- **Status:** VERIFIED (TD §2.4).

---

## 5. Permissions

**LC-5.1 — Tab access**
- **Behavior:** `canAccessTab(tab)`: false with no user. True for admins. Settings/Users/Locations are blocked for non-admins. The virtual `stock` tab is granted if any of `ledger`/`stockcount`/`reorder` is granted. Otherwise `currentUser.tabs[tab]` decides.
- **Default:** DEF-042…DEF-044.
- **User sees:** sidebar groups filtered, and empty groups dropped.
- **New:** preserve the per-member `tabs` override concept as **permission grants**, enforced in rules and callables, not only in the UI. The exact `TOGGLEABLE_TABS`/`DEFAULT_SHOP_TABS`/`NAV_GROUPS` lists are OQ-10.
- **Status:** PARTIAL.

**LC-5.2 — Delete restrictions (cloud)**
- **Behavior:** Firestore rules allow delete on customers/suppliers/products/invoices for admin/owner only. Stock movements are create-only for everyone. A permission-denied error on supplier delete shows a "needs owner/admin role" message.
- **New:** preserve the admin-only delete and the immutable stock movements. Show a friendly permission message.
- **Status:** VERIFIED (TD §3.2.1, §4.5).

**LC-5.3 — Membership doc write rules**
- **Behavior:** a member can read their own doc, and any active member can read members. Only an admin can write *another* member's doc, never their own.
- **New:** preserve. Role and permission changes go through a server callable and are audited.
- **Status:** VERIFIED.

**LC-5.4 — Known gap: restrictions are app-layer only**
- **Behavior:** `locationName` and `tabs` are not enforced by rules.
- **New:** **fix**: enforce server-side (SECURITY §6).
- **Status:** VERIFIED limitation.

---

## 6. Locations

**LC-6.1 — Location model**
- **Behavior:** `{id, name, type:'shop'|'warehouse', address, openingCashBalance, isDefault}`.
- **Default:** DEF-030, DEF-031.
- **Validation:** can't delete the last location. Deleting a location with stock gives a warning but is allowed.
- **Depends on:** stock, cash book (opening balance), expenses, payroll, reports.
- **New:** preserve all fields and both validations. Stable ids. Deletion becomes a **soft delete (archive)**, so stock/journal references stay valid and there is no resurrection bug.
- **Status:** VERIFIED (TD §4.2).

**LC-6.2 — Working location switch**
- **Behavior:** a sidebar `<select>` sets `currentLocationId`. Restricted users see a fixed label instead, and `switchLocation()` blocks them (defense in depth).
- **New:** preserve. Restricted users can only select their allowed locations. The server rejects operations at any other location.
- **Status:** VERIFIED.

**LC-6.3 — Home location resolution**
- **Behavior:** membership `locationName` is matched case- and whitespace-insensitively to `locations[].name`. If nothing matches, it logs a console warning and the account is left **unrestricted**.
- **New:** **fix**: the membership stores `locationIds` (references), not a free-text name. An invalid reference fails closed (no location access) rather than open. The migration maps names to ids and reports any that don't match.
- **Status:** VERIFIED (the legacy fail-open is a weakness).

**LC-6.4 — Location deletion fallback**
- **Behavior:** when the working location is deleted, a fallback id is computed before the delete.
- **New:** preserve: if the working location is archived, fall back to the first allowed location.
- **Status:** VERIFIED.

---

## 7. Products

**LC-7.1 — Product model**
- **Behavior:** `{id, name, category, hsn, wholesalePrice, gstRate, purchasePrice, unit, barcode, lowStockThreshold, altUnits[], hasVariants, variants[]}`.
- **Default:** `lowStockThreshold` 0/blank means use 5.
- **Validation (in this order):** name required; barcode unique (case-insensitive); at least 1 variant; no duplicate (size,color) when `hasVariants`; alt units de-duplicated, with non-empty name, factor > 0 and no collision with the base unit name.
- **New:** preserve all fields and the validations in the same order. Barcode uniqueness is enforced server-side with a barcode index doc inside a transaction.
- **Status:** VERIFIED (TD §4.1).

**LC-7.2 — Product save stock semantics**
- **Behavior:** the form shows and edits stock **at the current location only**. Other locations are left untouched. Movements: new variant with stock > 0 → `opening`; changed current-location quantity → `adjustment` "Manual correction via Products form at <location>"; removed variant with non-zero total stock → `adjustment` with a negative change.
- **New:** preserve. Performed by the `products.save` callable, which writes the product, stock levels and movements in one transaction.
- **Status:** VERIFIED.

**LC-7.3 — Quick add product mid-billing**
- **Behavior:** `saveQuickProduct()` checks for a duplicate barcode and price > 0, logs `opening` if opening stock > 0, and immediately adds the product to the current sale.
- **New:** preserve (a bottom sheet on mobile).
- **Status:** VERIFIED.

**LC-7.4 — Delete product**
- **Behavior:** asks for confirmation, removes the product, deletes the cloud photo on a best-effort basis, and does **not** touch past bills.
- **New:** preserve, as a soft delete (archive). Past documents keep their line snapshots. Admin/owner only (LC-5.2).
- **Status:** VERIFIED.

**LC-7.5 — Product list filtering**
- **Behavior:** free text (name/category/HSN/barcode), category, and stock status `out`/`low`/`healthy` at the current location.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-7.6 — GST rate suggestion**
- **Behavior:** DEF-025, offered only in the product form.
- **New:** preserve, suggestion only.
- **Status:** VERIFIED.

**LC-7.7 — Products CSV export**
- **Behavior:** `exportProductsCSV()`.
- **New:** preserve. The column set is NOT VERIFIED (OQ-11).
- **Status:** PARTIAL.

**LC-7.8 — Purchase price update rule**
- **Behavior:** a purchase updates `purchasePrice` only when the purchase unit is the base unit.
- **New:** preserve (BR-PUR-05).
- **Status:** VERIFIED.

---

## 8. Product Variants

**LC-8.1 — Variants**
- **Behavior:** `variants:[{id,size,color,stockByLocation}]`. A product without variants still gets one synthetic variant (legacy migration id `default`).
- **Validation:** no duplicate size+color.
- **New:** preserve. Variant ids stay stable, and the synthetic `default` variant is kept for non-variant products. Stock moves out of the product doc into `stockLevels` (DM §6.8).
- **Status:** VERIFIED.

**LC-8.2 — Legacy flat-stock migration**
- **Behavior:** pre-variant products with a flat `stock` are migrated to a `default` variant.
- **New:** handled in MIGRATION-PLAN §5.
- **Status:** VERIFIED.

---

## 9. Units

**LC-9.1 — Base units**
- **Behavior:** unit list per DEF-026.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-9.2 — Alternate units**
- **Behavior:** `altUnits:[{name,factor}]`, where factor = base units per alternate unit. `toBaseQty()` converts entered quantities to base units for stock.
- **Validation:** name non-empty, factor > 0, de-duplicated, never equal to the base unit name.
- **Depends on:** purchases (entry in an alt unit), stock deduction.
- **New:** preserve. The conversion lives only in `packages/domain`.
- **Status:** VERIFIED. Alt-unit selection on **sales** lines is NOT VERIFIED (the TD only shows the invoice line `unit` field and uses `toBaseQty` for shortage checks). See OQ-11.

---

## 10. Barcodes

**LC-10.1 — Barcode value**
- **Behavior:** DEF-064. The product barcode is trimmed and uppercased. Variant suffix = size+color (non-alphanumerics stripped, uppercased) or the last 4 characters of the variant id.
- **New:** preserve the exact algorithm in `packages/domain/barcode.ts`.
- **Status:** VERIFIED.

**LC-10.2 — Barcode label printing**
- **Behavior:** per product:variant print quantity; "set all" for the current filter; CODE128 PDF, 4×10 grid per A4, value cache, alphanumeric fallback then `NA`; an alternative SVG `window.print()` path.
- **New:** preserve both PDF and print. Library approval: OQ-13.
- **Status:** VERIFIED.

**LC-10.3 — Barcode lookup/scan**
- **Behavior:** exact match `findProductByBarcode()`. Keyboard-wedge/USB scanner entry. ZXing camera scan that prefers the rear camera and stays open on no match.
- **New:** preserve all three. Camera scanning must work on mobile PWA.
- **Status:** VERIFIED.

---

## 11. Inventory

**LC-11.1 — Location-aware stock**
- **Behavior:** stock per (product, variant, location). Derived values: per-location, all-locations, per-product.
- **New:** stock is stored as a `stockLevels` doc per (product, variant, location). It is **written only by Cloud Functions** and every change comes with a stock movement.
- **Status:** VERIFIED.

**LC-11.2 — Low stock**
- **Behavior:** `lowStockThresholdFor(p)` (default 5) is used by Dashboard, notifications and the Products list. Low means `qty ≤ threshold` at the current location.
- **New:** a single domain helper used everywhere (BR-STK-04).
- **Status:** VERIFIED.

**LC-11.3 — Negative stock**
- **Behavior:** allowed through a confirm-to-override on sale, DN, transfer and adjustment.
- **New:** preserve the override. The server accepts `allowNegative:true` only when the caller holds the permission (OQ-02). By default all current roles that can bill may override (legacy parity).
- **Status:** VERIFIED.

---

## 12. Stock Movements

**LC-12.1 — Immutable ledger**
- **Behavior:** append-only. Types: `opening`, `adjustment`, `purchase`, `purchase_reversal`, `transfer_out`, `transfer_in`, `sale`, `sale_reversal`, `delivery_out`, `delivery_return`, `sale_return` (CN restock), `purchase_return` (DBN restock). Adjustment reasons come from `ADJ_CATEGORIES` (includes `wastage` and `correction`; full list NOT VERIFIED, OQ-11).
- **New:** preserve all types. Create-only, by server only. Never updated or deleted.
- **Status:** VERIFIED (types), PARTIAL (reasons).

**LC-12.2 — Stock Ledger UI**
- **Behavior:** filter by location/product/type/reason. "Wastage/Shrinkage this month" KPI = wastage movements valued at purchase price.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-12.3 — Manual adjustment**
- **Behavior:** product/variant/direction/qty/category/note. Rejects qty ≤ 0. Confirms before going negative. Logs a movement and an activity entry.
- **New:** `stock.adjust` callable.
- **Status:** VERIFIED.

---

## 13. Stock Transfers

**LC-13.1 — Transfer**
- **Behavior:** the source follows the working location only while the draft is empty.
- **Validation:** destination required; source ≠ destination; at least 1 item; every qty > 0.
- **Behavior on shortage:** shortages are listed in one confirm and the transfer can proceed (negative allowed).
- **Effect:** `transfer_out` at the source and `transfer_in` at the destination, both referencing `transfer.id`.
- **New:** `transfers.create` callable, atomic across both locations. A restricted user must be allowed at the **source** location. Destination rule: OQ-24.
- **Status:** VERIFIED.

---

## 14. Stock Counts

**LC-14.1 — Physical count**
- **Behavior:** snapshot current-location stock → enter counts → diff → confirm naming the change count → set stock → `adjustment`/`correction` movements → append a summary to `physicalCounts`.
- **Validation:** a count with zero differences is rejected.
- **New:** preserve. The server recomputes the diff against **live** stock at apply time and reports if the system quantity changed since the snapshot.
- **Status:** VERIFIED.

---

## 15. Reorder Planning

**LC-15.1 — Reorder suggestions**
- **Behavior:** for a location and a history window: units sold, daily velocity, `daysLeft`, `suggestedQty = max(0, ceil(velocity × targetDays − stock))`. A row is included if it had any sale or stock ≤ 5. It is urgent if `daysLeft < thresholdDays`. Warehouse stock of the same variant is cross-checked and "transfer before purchase" is recommended.
- **Default:** DEF-057.
- **New:** preserve the formula exactly. The meaning of `thresholdDays` is NOT VERIFIED (OQ-11). CSV export `exportReorderCSV()` is preserved.
- **Status:** PARTIAL.

---

## 16. Customers

**LC-16.1 — Customer model**
- **Behavior:** `{id, name, contactPerson, gstin (uppercased), state, city, phone, address, creditLimit}`. A blank GSTIN means a B2C/cash buyer.
- **Validation:** GSTIN auto-suggests the state (`autoSuggestState()`). Name required is NOT VERIFIED.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-16.2 — Quick add customer**
- **Behavior:** state defaults to the business state.
- **New:** preserve (DEF-028).
- **Status:** VERIFIED.

**LC-16.3 — Credit limit**
- **Behavior:** a warning, never a block. `projected = outstanding + this bill's unpaid part` (subtracting the bill's own previous unpaid part when editing). Asks for confirmation when over the limit.
- **New:** preserve. The server returns a `CREDIT_LIMIT_EXCEEDED` warning that the client must confirm.
- **Status:** VERIFIED.

**LC-16.4 — Customer status badges**
- **Behavior:** in priority order Overdue > Over Limit > Has Balance > Healthy.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-16.5 — Customer ledger/statement**
- **Behavior:** running balance: a debit per invoice, a credit for the invoice's initial paid amount, and a credit per later payment. Same-day order: bill → initial payment → later payment. Customer Statement export.
- **New:** preserve the ordering rule exactly.
- **Status:** VERIFIED.

**LC-16.6 — Delete customer**
- **Behavior:** existing bills are untouched (`customerSnapshot` was frozen on the invoice).
- **New:** soft delete (archive). Invoices keep their snapshot. Admin-only.
- **Status:** VERIFIED.

---

## 17. Suppliers

**LC-17.1 — Supplier CRUD**
- **Behavior:** embedded on the Purchases screen. Delete is admin-only in the cloud.
- **Fields:** NOT VERIFIED; assumed to mirror customers (name, gstin, state, phone, address). See OQ-11.
- **New:** preserve the embedded CRUD. Payables mirror receivables.
- **Status:** PARTIAL.

---

## 18. New Bill

**LC-18.1 — Draft defaults**
- **Behavior:** `{invoiceNo, date, customerId, items:[], notes, status:'paid', paidAmount:0, dueDate, gstApplicable:false}`.
- **Default:** **Without GST**, status Paid, paid amount 0 (DEF-016…018). Date initialised to today: NOT VERIFIED (a `todayISO` helper exists).
- **User sees:** New Bill opens in Without-GST mode.
- **New:** **must open as Without GST.** The invoice number is shown as a *preview* and assigned by the server on save (OQ-19).
- **Status:** VERIFIED.

**LC-18.2 — Line items**
- **Behavior:** `{productId, variantId, name, hsn, unit, gstRate, qty, rate, discountPct}`. A repeat hit increments qty. The GST rate is snapshotted when the line is added. `rate` presumably defaults to `wholesalePrice`: NOT VERIFIED.
- **Validation:** qty ≤ 0 is rejected.
- **New:** preserve. Line snapshot fields per DM §6.14.
- **Status:** VERIFIED (default rate source NOT VERIFIED; OQ-11).

**LC-18.3 — Product quick-entry**
- **Behavior:** live search (top 8) with full keyboard navigation. If there's no dropdown match, it falls through to an exact-code lookup (USB scanner). Camera scan.
- **New:** preserve, including keyboard-only billing on desktop.
- **Status:** VERIFIED.

**LC-18.4 — GST dropdown**
- **Behavior:** "GST Applicable" / "Without GST". Without GST zeroes all tax on the draft only.
- **New:** preserve (BR-GST-06).
- **Status:** VERIFIED.

**LC-18.5 — Save validations**
- **Behavior:** stock shortage → confirm (when editing, the old quantity at that location is added back first). Credit limit → confirm. qty > 0.
- **New:** preserve. The server re-validates and returns structured warnings. The client re-submits with the confirmation flags.
- **Status:** VERIFIED.

**LC-18.6 — Edit bill**
- **Behavior:** blocked if the bill belongs to a different location (the user must switch first). Past-month bill → non-blocking "may already have been filed for GST". An edit is "undo then reapply": `sale_reversal`, reverse invoice + COGS journals, re-deduct, re-post. `paidAmount` is fixed to what was already received, and status is re-derived. Neither counter is touched.
- **New:** preserve the semantics, done server-side in one transaction. GST↔NGST switch while editing: OQ-21.
- **Status:** VERIFIED.

**LC-18.7 — Delete bill**
- **Behavior:** restores stock (skipping `skipStockDeduction` lines), reverses the invoice, COGS and every payment's journals, and reverts the source quotation/DN to open/pending.
- **New:** preserve, as a soft delete plus reversal, admin-only (LC-5.2). The number is never reused (BR-NUM-07).
- **Status:** VERIFIED.

**LC-18.8 — Mobile billing**
- **Behavior:** legacy has a `billing-mode` class on the app.
- **New:** a full mobile workflow is required (UI-UX §11).
- **Status:** VERIFIED (class only).

---

## 19. GST

**LC-19.1 — Tax type**
- **Behavior:** `taxTypeFor`: seller state vs. customer state. Intra if equal **or either is blank**, otherwise inter.
- **New:** preserve exactly (BR-GST-01/02).
- **Status:** VERIFIED.

**LC-19.2 — Line math**
- **Behavior:** `taxable = gross − gross·disc/100`. Intra: `cgst = sgst = taxable·rate/2/100`. Inter: `igst = taxable·rate/100`. Tax is exclusive (added on top of the rate).
- **New:** a single engine in `packages/domain/gst.ts`, run authoritatively on the server and for preview on the client. Integer-paise rounding: OQ-05.
- **Status:** VERIFIED.

**LC-19.3 — Cart totals and round off**
- **Behavior:** sum taxable and tax, round the grand total to the nearest rupee, and store the delta as `roundOff`. `roundOff` is shown on screen and on the PDF, and posted to Sales Revenue.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-19.4 — Shared engine usage**
- **Behavior:** used by invoices, quotations and CN. DN computes **no** GST. DBN has no GST math.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-19.5 — State from GSTIN**
- **Behavior:** first two digits → state.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-19.6 — Rate snapshot**
- **Behavior:** see LC-18.2.
- **Status:** VERIFIED.

---

## 20. Without-GST Billing

**LC-20.1 — Zero-tax bill**
- **Behavior:** `gstApplicable:false` means zero CGST/SGST/IGST and `total = taxable`. `draftTotals()` skips the engine.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-20.2 — Separate numbering**
- **Behavior:** the NGST series is independent, so the GST series never skips a number.
- **New:** preserve, with a separate server counter.
- **Status:** VERIFIED.

**LC-20.3 — Excluded from cloud sync**
- **Behavior:** Without-GST invoices **never reach Firestore**. They stay local to the device and are excluded from the delete-detection snapshot.
- **New:** **REQUIRES DECISION** (OQ-01). Server-side numbering and stock need the invoice on the server. The underlying intent (privacy? audit separation?) is not documented.
- **Status:** VERIFIED behavior, intent NOT VERIFIED.

**LC-20.4 — GST Filing treatment**
- **Behavior:** excluded from taxable totals and from all GST CSV exports. Shown in a separate "Without GST" section with a caveat to confirm with a CA.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-20.5 — Primary-shop claim concept**
- **Behavior:** `isPrimaryShopSession()` is an identity signal only, and not wired to anything.
- **New:** not implemented (unbuilt in legacy). Recorded for OQ-01.
- **Status:** VERIFIED (unbuilt).

---

## 21. Invoice Numbering

**LC-21.1 — Assignment**
- **Behavior:** per-device counters (`nextInvoiceSeq`, `nextInvoiceSeqNoGst`, …). A `max(local, remote)` merge stops counters going backward, but numbers can still collide.
- **New:** **fix**: server-authoritative atomic counters in a Firestore transaction, with a uniqueness reservation doc per issued number (BR-NUM-*).
- **Status:** VERIFIED limitation.

**LC-21.2 — Editing never consumes a number**
- **New:** preserve.
- **Status:** VERIFIED.

**LC-21.3 — Manual next-sequence edit in Settings**
- **Behavior:** allowed.
- **New:** preserve for owner/admin. Setting it backward is allowed only if the resulting numbers aren't already issued (the reservation check prevents duplicates).
- **Status:** VERIFIED.

---

## 22. Payments

**LC-22.1 — Record payment**
- **Behavior:** against an invoice (in) or a purchase (out).
- **Validation:** amount > 0. Confirm if it exceeds outstanding + 0.5.
- **Effect:** `paidAmount += amount`, status re-derived, `payments[]` appended, journal `payment_in` (Dr Cash/Bank by mode, Cr AR) or `payment_out` (Dr AP, Cr Cash/Bank), activity log, optional Cash Book entry.
- **New:** `payments.record` callable, atomic. Payments become a first-class collection that still references the invoice/purchase (DM §6.15).
- **Status:** VERIFIED.

**LC-22.2 — Payment status badge**
- **Behavior:** due ≤ 0.5 → Paid. Paid > 0 → Partial. Otherwise Unpaid.
- **New:** preserve (BR-PAY-02).
- **Status:** VERIFIED.

**LC-22.3 — No double-counted cash**
- **Behavior:** `invoiceForJournalPosting` subtracts later payments when re-posting an invoice.
- **New:** preserve the invariant (BR-ACC-09).
- **Status:** VERIFIED.

**LC-22.4 — Deleting payments**
- **Behavior:** no standalone payment delete or edit is documented. Payments are reversed only when their parent is deleted.
- **New:** don't add payment delete/edit without a decision (OQ-11).
- **Status:** NOT VERIFIED.

---

## 23. Customer Dues

**LC-23.1 — Outstanding Dues (Receivables)**
- **Behavior:** computed live. Unpaid = gap > 0.5. KPIs: Total Outstanding, Overdue, Due in Next 7 Days, customers with dues. Grouped by customer. Badges: No Due Date / Overdue / Due Soon (≤ 7 d) / Current.
- **New:** preserve. The server maintains the denormalized `outstandingPaise` on each invoice, and customer aggregates are maintained by functions.
- **Status:** VERIFIED.

**LC-23.2 — Payables**
- **Behavior:** an exact mirror of receivables, over purchases and suppliers.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-23.3 — Overdue definition**
- **Behavior:** gap > 0.5 and `dueDate` in the past. Shared by the bell, Dashboard and Dues.
- **New:** a single domain helper.
- **Status:** VERIFIED.

---

## 24. Quotations

**LC-24.1 — Quotation**
- **Behavior:** mirrors an invoice line for line, but has no `gstApplicable` or payment fields. Uses the full GST engine. Never touches stock or accounting. Status `open` → `converted`, and reverts to `open` if the resulting invoice is deleted. PDF `downloadQuotePDF`.
- **Default:** prefix QUO.
- **New:** preserve. Conversion copies the lines into a New Bill draft. The draft keeps the DEF-016 default unless the user changes it: NOT VERIFIED whether conversion forces GST mode (OQ-25).
- **Status:** VERIFIED.

---

## 25. Delivery Notes

**LC-25.1 — Delivery note / challan**
- **Behavior:** stock is deducted immediately (`delivery_out`). `rate` is a reference value only, with **no GST**. Lifecycle: `pending` → `invoiced` (converted with lines `skipStockDeduction:true`) → `returned` (stock restored with `delivery_return`). Only a pending DN can be edited, converted or returned. Shortage → confirm. PDF footer "Goods dispatched under this delivery note. Not a tax invoice."
- **Default:** prefix DN.
- **New:** preserve everything.
- **Status:** VERIFIED.

**LC-25.2 — DN accounting**
- **Behavior:** no journal is documented for a DN itself.
- **New:** don't invent a DN journal. COGS is posted when the invoice is created (NOT VERIFIED whether the invoice from a DN posts COGS; the TD says COGS runs "alongside every invoice save"). Preserve that.
- **Status:** PARTIAL.

---

## 26. Credit Notes

**LC-26.1 — Credit note**
- **Behavior:** issued against an invoice. Quantity is capped per line by `sumCreditedQty()` (clamped to [0, max]). Uses the **original invoice's tax type**. Zero tax if the original was Without GST. Journal: Dr Sales Revenue, Dr GST Output (if taxed), Cr AR. If `restock` is checked: Dr Inventory / Cr COGS plus a `sale_return` movement. A price-correction note never touches stock or COGS. PDF.
- **Default:** prefix CN.
- **New:** preserve. Stock returns go to the original invoice's location: NOT VERIFIED (OQ-11).
- **Status:** VERIFIED.

---

## 27. Debit Notes

**LC-27.1 — Debit note**
- **Behavior:** issued against a purchase. No GST: `amount = qty × rate`. Quantity capped the same way as credit notes. Journal: Dr AP / Cr Inventory. If `restock` is checked, stock is removed with a `purchase_return` movement. PDF.
- **Default:** prefix DBN.
- **New:** preserve.
- **Status:** VERIFIED.

---

## 28. Purchases

**LC-28.1 — Purchase**
- **Validation:** supplier required; at least 1 item; qty > 0.
- **Behavior:** quantities converted to base units. Stock lands at the **current location**. `purchasePrice` is updated only for base-unit lines. A `purchase` movement is logged, noting the original unit. Journal: Dr Inventory (total), Cr Cash (paid now), Cr AP (remainder).
- **Default:** DEF-022.
- **New:** preserve. GST on purchases is not documented: OQ-06.
- **Status:** VERIFIED.

**LC-28.2 — Delete purchase (purchase return)**
- **Behavior:** confirmation names the location whose stock reverses and warns separately about reversed payments. `purchase_reversal` movements, then the purchase and every payment journal are reversed.
- **New:** preserve. The "Purchase Return" workflow in the legacy app is the **Debit Note with restock** (LC-27.1) plus full deletion. There is no separate purchase-return document (NOT VERIFIED beyond this).
- **Status:** VERIFIED.

**LC-28.3 — Supplier payments**
- **Behavior:** see LC-22.1.
- **Status:** VERIFIED.

---

## 29. Accounting

**LC-29.1 — Double entry**
- **Behavior:** every financial event goes through `postJournal()`. It refuses if |Σdr − Σcr| > 0.01, drops lines ≤ 0.004, and discards an empty entry.
- **New:** preserve, server-only. Balance is checked **exactly** in integer paise (BR-ACC-01).
- **Status:** VERIFIED.

**LC-29.2 — Edits and deletes reverse**
- **Behavior:** `reverseJournalForRef` deletes the originals and re-posts. No in-place adjustment.
- **New:** preserve the effect. The originals are marked `voided` (kept for audit, excluded from balances) instead of hard-deleted (BR-ACC-05).
- **Status:** VERIFIED.

**LC-29.3 — Financial statements**
- **Behavior:** Trial Balance (all-time, all locations; "Balanced ✓" if < 0.02). P&L (Income − COGS = Gross, − other expenses = Net, coloured by sign). Balance Sheet (as of date; Retained Earnings = lifetime income − expense). General Ledger (running balance sorted by date + createdAt). All computed live from the journal.
- **New:** preserve. Computed server-side on demand. Not location-scoped (legacy parity). A location filter is possible later (OQ-11).
- **Status:** VERIFIED.

**LC-29.4 — Shop Comparison**
- **Behavior:** per location from the **ledger**: sales, COGS, gross profit, expenses (all expense accounts except COGS), net profit. Bill count comes from invoices. Combined row, bar chart and table.
- **New:** preserve.
- **Status:** VERIFIED.

---

## 30. Chart of Accounts

**LC-30.1 — System accounts**
- **Behavior:**
  - Assets: `acc-cash` Cash in Hand, `acc-bank` Bank Account, `acc-ar` Accounts Receivable, `acc-inventory` Inventory, `acc-gst-input` GST Input Credit/ITC.
  - Liabilities: `acc-ap` Accounts Payable, `acc-gst-output` GST Output Payable, `acc-loans` Loans Payable.
  - Equity: `acc-capital` Owner's Capital, `acc-drawings` Owner's Drawings.
  - Income: `acc-sales` Sales Revenue, `acc-other-income` Other Income.
  - Expense: `acc-cogs` Cost of Goods Sold, `acc-other-expense` Other Expenses.
  - All are `isSystem`, and none can be deleted.
- **New:** preserve the ids exactly. Numeric codes for the system accounts: NOT VERIFIED (OQ-11).
- **Status:** VERIFIED.

**LC-30.2 — Expense category accounts**
- **Behavior:** one per category, code from 5100 in steps of 10, linked via `expenseCategoryId`. Deterministic ids.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-30.3 — Custom accounts**
- **Behavior:** duplicate names blocked (case-insensitive). Code auto-assigned. Delete refused once the account has postings.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-30.4 — Staff Commission account**
- **Behavior:** payroll posts to "Staff Commission" or "Staff Salary/Wages". The origin of the commission account is NOT VERIFIED (OQ-12).
- **Status:** NOT VERIFIED.

---

## 31. Journal

**LC-31.1 — Entry model**
- **Behavior:** `{id, date, locationId, refType, refId, refLabel, lines[{accountId, debit, credit}], createdAt}`. refTypes: `invoice`, `invoice_cogs`, `purchase`, `expense`, `payroll`, `staffpayroll`, `credit_note`, `credit_note_cogs`, `debit_note`, `payment_in`, `payment_out`.
- **New:** preserve the refTypes.
- **Status:** VERIFIED.

**LC-31.2 — Manual journal entry**
- **Behavior:** the user "never touches a debit/credit screen directly except in the Chart of Accounts". A manual journal entry screen is **not documented**.
- **New:** don't add one without a decision.
- **Status:** VERIFIED (absent).

---

## 32. COGS

**LC-32.1 — COGS posting**
- **Behavior:** a separate `invoice_cogs` entry: Dr COGS / Cr Inventory for Σ(purchasePrice × baseQty). Skipped if ~0. Reversed with the invoice. The cost basis is the product's **current** `purchasePrice` at save time (last base-unit purchase price, not a weighted average).
- **New:** preserve. The unit cost is snapshotted onto each invoice line at posting, so a later reversal is exact (BR-COGS-02).
- **Status:** VERIFIED.

---

## 33. Cash Book

**LC-33.1 — Informal cash ledger**
- **Behavior:** `{id, date, locationId, type:'in'|'out', category, amount, paymentMode, reference, notes}`. amount > 0. **Never posts to the journal.** Other flows can optionally "also log in Cash Book".
- **Default:** DEF-038/039.
- **New:** preserve its separation from the journal.
- **Status:** VERIFIED.

**LC-33.2 — Cash balance**
- **Behavior:** `cashBalanceAt(loc)` = opening cash balance + all-time net. Per location only.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-33.3 — Cash analysis**
- **Behavior:** Today/Month KPIs, 14-bucket trend, category breakdowns. Scoped to the current location.
- **New:** preserve.
- **Status:** VERIFIED.

---

## 34. Expenses

**LC-34.1 — Daily expense**
- **Behavior:** `{id, date, categoryId, categoryName, amount, paymentMode, notes, locationId}`.
- **Validation:** amount > 0; category required.
- **Journal:** Dr category account / Cr Cash-or-Bank. Edit = reverse then re-post. Delete reverses.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-34.2 — Expense reporting**
- **Behavior:** Today / Last 7 Days / Month KPIs; Net This Month = month sales − month expenses; 14-bucket trend; all-time By Category. Current location only.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-34.3 — Categories**
- **Behavior:** deleting a category doesn't rewrite past expenses (they keep `categoryName`).
- **New:** preserve.
- **Status:** VERIFIED.

---

## 35. GST Filing

**LC-35.1 — Monthly summary**
- **Behavior:** month/year filter. Without-GST list shown separately. Taxable invoices split into B2B (buyer has a GSTIN) and B2C. Tax fields are **summed from stored values**, not recalculated. Net figures subtract the period's credit notes. HSN summary by `hsn|gstRate`.
- **New:** preserve. Computed server-side from stored snapshots.
- **Status:** VERIFIED.

**LC-35.2 — Readiness checks**
- **Behavior:** business GSTIN set; B2B GSTINs match the 15-character regex; no taxable line missing an HSN. GSTR-1/3B due-date reminders (informational). Everything is framed as "not a substitute for a CA".
- **New:** preserve.
- **Status:** VERIFIED.

**LC-35.3 — Exports**
- **Behavior:** B2B/B2C/CDNR/HSN CSVs and a multi-section PDF. Nothing is submitted to the GST portal.
- **New:** preserve. Exact CSV columns: OQ-11.
- **Status:** PARTIAL.

---

## 36. Payroll

**LC-36.1 — Shop payroll**
- **Behavior:** `payrollEntries`, whose `userId` field actually holds a **location id**. Type selects the Staff Commission or Staff Salary/Wages account. Cr Cash/Bank. **No automatic commission calculation**: the user reads the shown sales figure (`locationSalesInRange`) and types the amount. Optional Cash Book entry. Shop Earnings Summary is location-scoped.
- **New:** preserve. Rename the field to `locationId` (the migration maps `userId` → `locationId`).
- **Status:** VERIFIED.

**LC-36.2 — Named staff directory**
- **Behavior:** `staffMembers` (default payment type/mode, Active/Inactive) and `staffPayments` (dated, posted like payroll). Deleting a staff member with history warns and recommends Inactive instead.
- **New:** preserve.
- **Status:** VERIFIED.

---

## 37. Reports

**LC-37.1 — Sales Reports**
- **Behavior:** current location only. Day/week/month, last 14 periods. Top Products/Customers from line items. "Shop / Account Performance" by `createdByUsername`.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-37.2 — Shop Comparison**
- **Behavior:** see LC-29.4.
- **Status:** VERIFIED.

**LC-37.3 — Exports**
- **Behavior:** Sales Register, Customer Statement, Products CSV, Reorder CSV, GST CSVs and PDF.
- **New:** preserve.
- **Status:** PARTIAL (columns).

**LC-37.4 — Financial statements**
- **Behavior:** see LC-29.3.
- **Status:** VERIFIED.

---

## 38. Dashboard

**LC-38.1 — Dashboard**
- **Behavior:** time-of-day greeting, user, location, date. KPIs: Today's Sales + bill count + vs-yesterday % (only when yesterday > 0); Month vs last month; Outstanding Dues + customer count; Low Stock (location-scoped). Setup banner. Multi-shop sync banner (superseded). Trend chart 14/30/90 days. Recent invoices (4). Low stock (4). 6 quick actions.
- **Default:** DEF-051, 052, 076.
- **New:** preserve all KPIs and scoping. **Fix:** the chart legend must not advertise an unplotted "Number of Bills" series. Either plot it or remove the legend entry (plotting it is recommended, since it's clearly the intent). Recent invoices sort by a true date + createdAt, not a string.
- **Status:** VERIFIED.

---

## 39. Activity Log

**LC-39.1 — Activity log**
- **Behavior:** about 25 action codes → labels (`ACTIVITY_LABELS`). View of the last 300, filterable by account (userId → username map built from the log).
- **New:** preserve. Entries are written **server-side** by functions (so they can't be forged) and are immutable. Full code list: OQ-11.
- **Status:** PARTIAL.

---

## 40. Backup

**LC-40.1 — Export all data**
- **Behavior:** a JSON file with about 25 slices (settings through staffPayments), named per DEF-069. Its `version` field is hardcoded `2.16.0` (a bug).
- **New:** preserve the full-export capability. The server generates the backup with `schemaVersion`, `appVersion` (real), `businessId`, `createdAt`, `createdBy` and a checksum. Owner/admin only. Stored in Storage and downloadable (BR-BAK-*).
- **Status:** VERIFIED.

---

## 41. Restore

**LC-41.1 — Import all data**
- **Behavior:** confirm ("replaces ALL"), parse, restore each slice with defaults, migrate old products, reset the location if invalid.
- **New:** preserve the capability, made safe: `restore.execute` permission (owner and admin by default, legacy parity; OQ-02), re-auth, validation against the schema, version-aware transforms, dry-run diff, automatic pre-restore backup, audited, and never a blind overwrite (BR-BAK-*). Target semantics: OQ-20.
- **Status:** VERIFIED.

---

## 42. Cloud Sync

**LC-42.1 — Whole-document interval sync**
- **Behavior:** `data/main` 3-way merge. Deletion detection only works on the deleting device (resurrection bug). 900 KB guard. Last write wins on the same record.
- **New:** **do not reproduce.** Use per-record collections, server transactions and soft-delete tombstones (`deletedAt`) so deletes propagate. Legacy data is used only as a migration source.
- **Status:** VERIFIED limitation.

**LC-42.2 — Offline-first operation**
- **Behavior:** the whole app works offline on local storage and merges when back online.
- **New:** **REQUIRES DECISION** (OQ-04). Server-authoritative numbering and stock conflict with offline billing.
- **Status:** VERIFIED.

---

## 43. Realtime Sync

**LC-43.1 — Realtime listeners**
- **Behavior:** `onSnapshot` on customers, suppliers, products, invoices, stock movements, business settings, locations. Each has its own conflict strategy. First connect enables all of them, with retries. Every login reconnects them. An empty locations snapshot is ignored.
- **New:** realtime by default for operational data (ARCHITECTURE §8). Server writes remove the need for client merge strategies. Keep the "never show an empty location list" guarantee: at least one location always exists, enforced server-side.
- **Status:** VERIFIED.

**LC-43.2 — Settings counter max-merge**
- **Behavior:** counters are merged with `max()`.
- **New:** superseded by server counters (the behavior is guaranteed: counters never move backward automatically).
- **Status:** VERIFIED.

---

## 44. PWA

**LC-44.1 — Manifest**
- **Behavior:** DEF-071, `start_url ./app.html`.
- **New:** new manifest (PWA-ARCHITECTURE §2).
- **Status:** VERIFIED.

**LC-44.2 — Service worker**
- **Behavior:** a versioned cache. Precaches file by file. Deletes old caches on activate. Intercepts **same-origin GET only** (fix for the Firebase auth breakage). Cache-first. Only navigations fall back to the shell.
- **New:** preserve all the safety properties (PWA §4).
- **Status:** VERIFIED.

**LC-44.3 — Hosting headers**
- **Behavior:** `no-cache` on `service-worker.js` and `manifest.json`. `/` rewrites to the app.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-44.4 — Electron desktop build**
- **Behavior:** Windows NSIS + portable, with auto-update.
- **New:** not in the new tech contract (OQ-16).
- **Status:** VERIFIED.

---

## 45. Notifications

**LC-45.1 — System alerts bell**
- **Behavior:** low-stock count at the current location plus overdue invoices, using the same logic as Dashboard and Dues.
- **New:** preserve, with a single shared helper.
- **Status:** VERIFIED.

**LC-45.2 — Toasts and confirm modal**
- **Behavior:** toasts render independently of the main render (so they never wipe input). The confirm modal is async, restores focus, traps focus and closes on Escape.
- **New:** preserve the behavior with shadcn `Sonner`/`AlertDialog` (accessible by default).
- **Status:** VERIFIED.

**LC-45.3 — WhatsApp campaigns**
- **Behavior:** full CRUD for drafts only. Send always alerts "not available yet".
- **New:** preserve the drafts. Sending stays disabled (OQ-14).
- **Status:** VERIFIED.

**LC-45.4 — Push notifications**
- **Behavior:** none.
- **New:** don't add without a decision.
- **Status:** VERIFIED (absent).

---

## 46. Document / PDF generation

**LC-46.1 — Invoice PDF**
- **Behavior:** jsPDF + autoTable. Chained-Y `pdfBlock` layout. Bill-To wraps at 95 mm so it never reaches Payment Status at x = 120. The table starts below the longest block. Columns: intra has CGST%/CGST and SGST%/SGST; inter has IGST%/IGST. Round-off line. Amount in words (Indian Crore/Lakh). Bank details. Logo.
- **New:** preserve the layout guarantees and content. Library: OQ-13.
- **Status:** VERIFIED.

**LC-46.2 — Quotation / CN / DBN / DN PDFs**
- **Behavior:** same approach. DN footer text per LC-25.1.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-46.3 — Live item code on PDFs**
- **Behavior:** `pdfItemCode` reads the **current** product code, blank if the product was deleted.
- **New:** **preserve** (the legacy behavior is intentional). Also store the code snapshot on the line so a soft-deleted product still prints.
- **Status:** VERIFIED.

**LC-46.4 — GST report PDF**
- **Behavior:** multi-section, paginated.
- **New:** preserve.
- **Status:** VERIFIED.

**LC-46.5 — Amount in words**
- **Behavior:** Indian numbering (Crore/Lakh/Thousand/Hundred).
- **New:** preserve in `packages/domain`.
- **Status:** VERIFIED.

---

## 47. Images

**LC-47.1 — Logo**
- **Behavior:** compressed per DEF-061. Shown in the sidebar and on bills. Remove needs confirmation.
- **New:** store in Storage `businesses/{b}/branding/logo.jpg`. Keep compression client-side and validate server-side.
- **Status:** VERIFIED.

**LC-47.2 — Product photos**
- **Behavior:** compressed per DEF-062. Base64 or Storage URL. Replacing or removing deletes the old Storage object (best effort).
- **New:** always Storage (`businesses/{b}/products/{productId}/{imageId}.jpg`). Delete the old object on replace or remove. Security rules per SECURITY §8.
- **Status:** VERIFIED.

**LC-47.3 — Image deletion sync gap**
- **Behavior:** `mergeProductImages` never propagates deletes.
- **New:** **fix**: image references live on the product doc and delete through the server.
- **Status:** VERIFIED limitation.

---

## 48. Firebase

**LC-48.1 — Project**
- **Behavior:** `hh-erp-2026`; hardcoded config; Auth, Firestore, Storage, Hosting.
- **New:** new project(s) per environment (dev/staging/prod). Config comes from env at build time. Firestore region: OQ-15.
- **Status:** VERIFIED.

**LC-48.2 — Security rules**
- **Behavior:** see LC-5.2/5.3. Storage requires an active member. Default deny.
- **New:** a full rewrite (SECURITY §7/§8), tested with the emulator.
- **Status:** VERIFIED.

**LC-48.3 — No backend code**
- **Behavior:** no Cloud Functions.
- **New:** Cloud Functions v2 become authoritative for critical operations.
- **Status:** VERIFIED.

---

## 49. Known Limitations

Each limitation in TD §9 and how the rebuild treats it:

| # | Legacy limitation | Treatment |
|---|---|---|
| KL-01 | Invoice number collisions across devices | **Fix** (server counters) |
| KL-02 | Single-device deletion detection / resurrection | **Fix** (per-record docs + soft-delete tombstones) |
| KL-03 | `mergeProductImages` never deletes | **Fix** |
| KL-04 | `data/main` rule allows bypassing per-record rules | **Fix** (no shared whole document) |
| KL-05 | `locationName`/`tabs` app-layer only | **Fix** (rules + functions) |
| KL-06 | Sync never tested against live Firebase | **Fix** (emulator + integration tests in CI) |
| KL-07 | Stock movement first enable downloads whole ledger | **Fix** (paged queries; stock read from `stockLevels`) |
| KL-08 | Same-field concurrent edit is last-write-wins | **Mitigate** (server `updatedAt` precondition, optimistic concurrency; the user is told about a conflict) |
| KL-09 | Payment mode collapses to Cash/Bank in accounts | **Preserve** accounting behavior; the new `payments` collection keeps the mode for reporting |
| KL-10 | Statements not location-scoped | **Preserve** (legacy parity); an optional filter is an enhancement (OQ-11) |
| KL-11 | No automatic commission | **Preserve** (not a bug; no rule exists to implement) |
| KL-12 | Blank customer state → intra | **Preserve** tax behavior (OQ-22) |
| KL-13 | GST rate snapshot | **Preserve** (intended) |
| KL-14 | GST readiness checks aren't a CA review | **Preserve** the caveat |
| KL-15 | Backup version hardcoded `2.16.0` | **Fix** |
| KL-16 | Dashboard dead code (alerts/recentActivity) | **Fix** (don't port dead code) |
| KL-17 | Trend legend advertises an unplotted series | **Fix** (LC-38.1) |
| KL-18 | `isPrimaryShopSession` unwired | Not built (OQ-01) |
| KL-19 | Three manual version bumps | **Fix** (single version source) |
| KL-20 | Home location fail-open on name mismatch | **Fix** (fail closed, LC-6.3) |
| KL-21 | Recent invoices sorted by date string | **Fix** (true sort) |
| KL-22 | `uid()` not cryptographically unique | **Fix** (Firestore auto-ids / `crypto.randomUUID`) |
| KL-23 | At-billing cash always posts to Cash in Hand | **Preserve** by default (OQ-07) |

---

## 50. Existing UI behaviors

**LC-50.1 — Focus preservation**
- **Behavior:** the cursor and selection survive re-renders.
- **New:** inherent in React (controlled inputs). Must not regress: no remounting of inputs while typing.
- **Status:** VERIFIED.

**LC-50.2 — Enter-as-Tab**
- **Behavior:** Enter moves to the next field, except in product-code and global-search inputs.
- **New:** preserve on desktop data entry forms (bill, purchase, product). On mobile, use the keyboard `enterKeyHint="next"`.
- **Status:** VERIFIED.

**LC-50.3 — Ctrl/Cmd+K**
- **Behavior:** focuses global search. Escape closes overlays.
- **New:** preserve (command palette).
- **Status:** VERIFIED.

**LC-50.4 — Click outside closes**
- **Behavior:** search, notifications, profile menu and product dropdown close on an outside click.
- **New:** preserve (Radix default).
- **Status:** VERIFIED.

**LC-50.5 — Date sanitization**
- **Behavior:** an invalid date (year outside 1990–2200) is cleared.
- **New:** preserve with Zod validation.
- **Status:** VERIFIED.

**LC-50.6 — Global search**
- **Behavior:** products, customers, invoices, quotations and purchases; case-insensitive substring; 5 per category.
- **New:** preserve. Server-backed or indexed search tokens. Substring semantics: see ARCHITECTURE §8.4.
- **Status:** VERIFIED.

**LC-50.7 — Navigation**
- **Behavior:** `setTab` is the only entry point. It re-checks access, initializes drafts lazily, resets view state on leave, closes the drawer and scrolls to top. Collapsible sidebar groups. Skip link.
- **New:** React Router route guards plus the same behavior. The skip link is preserved.
- **Status:** VERIFIED.

**LC-50.8 — Deferred render**
- **Behavior:** `render()` is deferred so clicks aren't lost.
- **New:** not applicable in React. The guarantee (no lost clicks on blur) must hold.
- **Status:** VERIFIED.

**LC-50.9 — Draft persistence per document**
- **Behavior:** drafts for invoice, purchase, quote, DN, CN, DBN and transfer live in memory, with saved/viewing/editing state per type.
- **New:** drafts are kept in Zustand, persisted **per device** to IndexedDB/localStorage for crash recovery (only non-sensitive draft data, cleared on sign-out).
- **Status:** VERIFIED (in-memory); persisting drafts is an enhancement.

**LC-50.10 — Sidebar location label**
- **Behavior:** restricted users see a fixed label.
- **New:** preserve.
- **Status:** VERIFIED.

---

## Counts (Phase 0)

- Feature items (`LC-*`): **156**
- Application defaults (`DEF-*`): **76**
- Known limitations assessed (`KL-*`): **23**

---

## Phase 3 compatibility check

The domain foundation preserves every audited default and rule (see `docs/PHASE-3-COMPLETION.md`
for the full checklist and test references): numbering prefixes/sequences, the six independent
series, GST intra/inter/without-GST behavior and the rate suggestion, the low-stock default of 5,
shortage-as-warning, the 14-account chart with preserved ids, the journal debit=credit invariant,
and all business-settings fields. Legacy limitations were **not** reproduced: server-authoritative
atomic numbering replaces per-device counters (verified collision-free), normalized collections
replace `data/main`, and repositories are read-only client-side with server-authoritative writes.

## Phase 4 — Master data parity (implemented)

Preserved: free-text product categories (no invented entity), the barcode field and its uniqueness
intent (now enforced server-side, case-insensitively — fixing the legacy client-only check),
product variants and alternate units, GSTIN upper-casing with state derived from the GSTIN, the
low-stock default of 5, and client-side substring search over loaded lists (BR-RPT-08).

Legacy limitations **not** reproduced: product-image orphaning on replace (KL-03) is fixed by
server-side deletion of the previous object; master-data writes are server-authoritative (client
writes denied) instead of direct-to-`data/main`; and archiving is soft-delete so invoices, stock and
journal references keep their frozen details instead of breaking.

## Phase 5 — Sales parity (implemented)

Preserved: New Bill Without-GST default (DEF-016), six independent numbering series with legacy
prefixes (INV/NGST/QUO), PREFIX/FY/seq format, frozen customer/seller snapshots, the exact GST math
(intra CGST+SGST, inter IGST, Without-GST=0), round-to-rupee roundOff booked to Sales Revenue, the
invoice/COGS/payment journal shapes (BR-ACC-08/09, BR-COGS-01, BR-PAY-03/04), edit = undo-then-reapply
keeping the amount received, delete reverting stock/journals + source, stock-shortage / over-payment /
past-month as non-blocking warnings, and INR formatting.

Legacy limitations NOT reproduced: per-device counters (KL-01) → server-authoritative atomic numbering
(verified collision-free under concurrency); direct client writes to `data/main` → server-only
callables with balance-or-refuse posting; hard invoice delete → soft-delete keeping the number
reserved; non-idempotent saves → requestId idempotency.
