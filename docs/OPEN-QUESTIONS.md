# Open Questions

> **Phase 0 deliverable.** Only requirements that are **genuinely unresolved** after a full review of `docs/legacy/TECHNICAL-DOCUMENTATION.md`. The legacy source code wasn't available in this repository during Phase 0. Every item is **REQUIRES DECISION** unless marked otherwise. Recommendations are proposals only. They must not be implemented until the owner decides.
>
> Format: **Question** · **Evidence** · **Why unresolved** · **Options** · **Recommendation** · **Blocks phase**.

---

### OQ-01 — Where do Without-GST invoices live, and who can see them? — **REQUIRES DECISION**
- **Evidence:** legacy Without-GST invoices are **never synced to Firestore** (TD §5.3, §7.2). They exist only on the device that created them and are excluded from sync by two independent mechanisms. `isPrimaryShopSession()` was meant to support a future "claim" flow and was never built (TD §4.7).
- **Why unresolved:** the TD explains *how* they're excluded, but not the business *reason*. Server-authoritative numbering, stock deduction and accounting (spec §19) all require the invoice to exist on the server.
- **Options:**
  - (a) Store them in Firestore like GST invoices, with the separate NGST series and the same visibility.
  - (b) Store them in Firestore in a separate collection (`invoicesNoGst`) readable only by permission `sales.noGst.view` (for example owner/admin plus the creating location).
  - (c) Keep them device-local (not compatible with server-authoritative stock and accounting).
- **Recommendation:** (b). It keeps the separation and privacy intent while making stock, accounting and numbering correct.
- **Also decide:** whether Dashboard, Sales Reports, Shop Comparison and Dues include Without-GST bills. In legacy they're included only on the originating device.
- **Blocks:** Phase 3.

### OQ-02 — Roles beyond owner/admin/shop, and member management — **REQUIRES DECISION**
- **Evidence:** legacy roles are `owner`, `admin`, and non-admin (`shop`) (TD §2.4). The spec asks to account for **Manager, Accountant, Staff**, which the TD doesn't mention. Members are created by hand in the Firebase Console. There is no in-app member management (TD §3.4).
- **Decide:**
  1. The permission set for Manager, Accountant and Staff (if they're wanted).
  2. Whether owner/admin get an in-app **Members** screen (invite, activate/deactivate, role, locations, permission overrides), or provisioning stays Console-only.
  3. Whether `restore.execute` and `data.reset` narrow to **owner only**. Legacy allowed any admin.
  4. Who may override negative stock and credit limit. Legacy allowed anyone who could bill.
- **Recommendation:** (2) in-app Members screen for owner/admin, with an invite link. (3) owner only. (1) Manager = shop + purchases + expenses + dues + reports; Accountant = view-all + accounting, cash book, expenses, GST, payments, no stock changes; Staff = sales.create + customers.view + products.view at the home location.
- **Blocks:** Phase 1 (permission core) and Phase 2 (members).

### OQ-03 — Does numbering reset every financial year? Which date sets the FY label? — **REQUIRES DECISION**
- **Evidence:** the format is `PREFIX/2627/0001` (TD §3.2) and `fyLabel()` exists (TD §2.7). The TD never says whether `next*Seq` resets on 1 April, or whether the FY comes from the document date or today's date.
- **Options:** (a) one continuous sequence, where only the FY label changes; (b) the sequence resets to 1 per FY per series.
- **Recommendation:** confirm from the legacy source (OQ-11). If absent, use (a) to match the documented single counter per series. Use the document date for the FY label.
- **Blocks:** Phase 2 (numbering service).

### OQ-04 — Offline billing — **REQUIRES DECISION**
- **Evidence:** legacy is fully offline-first: local storage with merge on reconnect (TD §1, §3.2 "offline-first"). The spec requires server-authoritative numbering and stock, which need connectivity at save time.
- **Options:**
  - (a) Online-only commands. Drafts persist offline. Save waits for the connection. (Simplest and safest.)
  - (b) An offline queue with **provisional** numbers (e.g. `DRAFT-…`) that become final when synced. Stock conflicts are resolved at sync time.
  - (c) Pre-allocated number blocks per device. Gaps are possible, which the GST series must avoid.
- **Also decide:** whether a Firestore persistent cache ("trusted device" mode) is allowed on shop devices.
- **Recommendation:** (a) for Phase 3, and revisit (b) for Without-GST bills only if the shops lose connectivity often. Persistent cache opt-in per device.
- **Blocks:** Phase 1 (cache policy) and Phase 3.

### OQ-05 — Paise rounding granularity — **REQUIRES DECISION**
- **Evidence:** legacy computes each line's tax in floats and rounds only the grand total to the rupee (TD §5.2). It doesn't say whether line tax is rounded before summing.
- **Options:** (a) round taxable, CGST, SGST and IGST per line to the paise, then sum; (b) keep full precision (rational/BigInt) per line and round only the invoice-level tax heads.
- **Recommendation:** (a). Printed line amounts then add up exactly to printed totals, and CGST = SGST always. The grand total is still rounded to the rupee with a round-off line (legacy parity).
- **Blocks:** Phase 1 (domain money/GST).

### OQ-06 — GST on purchases (input tax credit) — **REQUIRES DECISION**
- **Evidence:** the `acc-gst-input` account exists (TD §6.1.1), but the documented purchase posting is Dr Inventory / Cr Cash/AP with no tax (TD §6.1.5). Purchase line fields aren't documented. Debit notes have "no GST math".
- **Why unresolved:** we can't tell whether purchases capture supplier GST at all.
- **Recommendation:** check the legacy source (OQ-11). If purchases have no GST, preserve that exactly and keep `acc-gst-input` unused. Adding ITC would be a new feature.
- **Blocks:** Phase 4.

### OQ-07 — Payment mode for amounts paid at billing — **REQUIRES DECISION**
- **Evidence:** the amount paid at billing always posts to **Cash in Hand**, whatever the actual mode. Only Record Payment respects the mode (TD §6.1.5).
- **Options:** (a) preserve exactly (New Bill has no payment-mode field); (b) add a payment-mode selector to New Bill that posts to Cash or Bank accordingly.
- **Recommendation:** (a) for parity in Phase 3. Offer (b) as an explicit enhancement.
- **Blocks:** Phase 3.

### OQ-08 — Default theme — **REQUIRES DECISION**
- **Evidence:** `settings.theme` supports `light`/`dark`, but the default value isn't documented (TD §2.3). The manifest uses dark colors.
- **Recommendation:** default **System** for new users. Migrated users keep their legacy value.
- **Blocks:** Phase 1.

### OQ-09 — Seed locations for new businesses — **REQUIRES DECISION**
- **Evidence:** legacy seeds four Hynish-specific locations with fixed ids on every device (TD §4.2).
- **Options:** (a) the migrated Hynish business keeps them (via migration). A new business is seeded with a single "Main Shop". (b) Every new business is seeded with the four Hynish locations.
- **Recommendation:** (a). This is only relevant if the platform will ever host more than one business (OQ-17).
- **Blocks:** Phase 2.

### OQ-10 — Exact legacy tab lists — **REQUIRES DECISION / SOURCE NEEDED**
- **Evidence:** `DEFAULT_SHOP_TABS`, `TOGGLEABLE_TABS`, `TAB_LABELS` and `NAV_GROUPS` are referenced but not enumerated (TD §2.1, §2.4, §2.7). Only the exclusions are stated.
- **Needed:** the exact lists from `app.html` (lines ~205–214) to build the default shop permission set and the `tabs` → permission migration map.
- **Blocks:** Phase 1.

### OQ-11 — Legacy details not stated in the TD (source code needed) — **SOURCE NEEDED**
Please provide the legacy repository (`app.html`, `src/*.js`, `CHANGELOG.md`, `tests/`) so the following can be verified instead of guessed:
1. `ADJ_CATEGORIES` (the full list of adjustment reasons).
2. `ACTIVITY_LABELS` (about 25 action codes and labels).
3. The exact `GST_STATE_CODES` names (needed to map legacy state strings).
4. Numeric codes of the 14 system accounts.
5. Supplier record fields.
6. The default line `rate` (`wholesalePrice`?), default `qty` and default `discountPct` when a product is added to a bill, and the default bill `date`.
7. Whether sales lines allow alternate-unit selection.
8. The New Bill `dueDate` default. How `status:'paid'` interacts with `paidAmount:0` (see OQ-18).
9. The default payment mode in Record Payment, Expenses and Cash Book.
10. CSV column sets: Products, Reorder, Sales Register, Customer Statement, GST B2B/B2C/CDNR/HSN.
11. The meaning of Reorder `thresholdDays`, and the default history window and target coverage.
12. Credit note rounding and round-off. The COGS unit cost used for CN restock. Whether invoice lines from a DN (`skipStockDeduction`) post COGS. Which location receives CN-restocked stock.
13. Payroll `type` values.
14. The date display format (`fmtDate`, `fmtDateShort`).
15. Whether any standalone payment edit or delete exists.
16. Whether an invoice with zero lines is rejected. Whether customer name is required. Whether a `creditLimit` of 0 means "no limit".
17. The stock "out" boundary (`≤ 0`?).
18. Whether purchases carry a supplier bill number.
19. WhatsApp campaign fields.
20. The legacy calculation code, to port as migration reference implementations (MIGRATION-PLAN §8).
- **Blocks:** the corresponding phases. Until resolved, each item stays NOT VERIFIED and isn't implemented as a rule.

### OQ-12 — Origin of the "Staff Commission" expense account — **SOURCE NEEDED**
- **Evidence:** payroll posts to "Staff Commission" or "Staff Salary/Wages" (TD §6.1.5, §6.6). "Staff Salary/Wages" is a default expense category. "Staff Commission" isn't in the default categories or the system chart.
- **Needed:** is it created on demand, seeded elsewhere, or mapped to another account?
- **Blocks:** Phase 5.

### OQ-13 — Approval of libraries outside the technology contract — **REQUIRES DECISION**
Legacy features that must be preserved need libraries the contract doesn't list:

| Need | Legacy | Proposed |
|---|---|---|
| PDF invoices, quotations, notes, GST report (LC-46) | jsPDF + autoTable | **jsPDF + jspdf-autotable** (keeps legacy layout parity) |
| Barcode label rendering (LC-10.2) | JsBarcode | **JsBarcode** |
| Camera barcode scanning (LC-10.3) | ZXing | native `BarcodeDetector` where available + **@zxing/browser** fallback (iOS Safari has no BarcodeDetector) |
| Timezone-safe business dates (BR-DAT-03) | — | **date-fns-tz** (or `@date-fns/tz`) |
| PWA build | hand-written SW | **vite-plugin-pwa / Workbox** (build-time) |
| Self-hosted Manrope | — | **@fontsource-variable/manrope** |
| Mobile drawers | — | **vaul** (shadcn Drawer dependency) |
| Toasts | — | **sonner** (shadcn default) |
| Dev/test only | — | Vitest, Testing Library, Playwright, @axe-core/playwright, @firebase/rules-unit-testing, Lighthouse CI, ESLint, Prettier |

- **Recommendation:** approve all of them. They are feature-preserving or tooling, not frameworks.
- **Blocks:** Phase 1 (tooling) and Phase 3 (PDF/barcode).

### OQ-14 — WhatsApp messaging scope — **REQUIRES DECISION**
- **Evidence:** a settings card and campaign drafts exist. Sending is never enabled, because it needs a backend relay (TD §3.2, §3.7).
- **Decide:** keep it as drafts-only (legacy parity), or build real sending through Cloud Functions (a new feature). The API key must go to Secret Manager in either case.
- **Recommendation:** drafts-only parity. Sending is a separately scoped later phase.
- **Blocks:** Phase 6.

### OQ-15 — Firebase projects and region — **REQUIRES DECISION**
- **Why:** the Firestore location **can't be changed** after creation.
- **Recommendation:** new projects `hynish-dev`, `hynish-staging`, `hynish-prod`, with Firestore and Functions in **`asia-south1` (Mumbai)**. Confirm billing (Blaze plan, required for Functions).
- **Blocks:** Phase 1.

### OQ-16 — Windows desktop (Electron) build — **REQUIRES DECISION**
- **Evidence:** legacy ships an Electron NSIS installer and a portable exe with auto-update (TD §8.4). Electron isn't in the new tech contract.
- **Options:** (a) drop it and use the installed PWA on Windows (Chrome/Edge "Install app"); (b) keep an Electron wrapper.
- **Recommendation:** (a).
- **Blocks:** Phase 1 (packaging).

### OQ-17 — Single business or multi-business platform — **REQUIRES DECISION**
- **Evidence:** legacy hardcodes one business (`hh-erp-2026`).
- **Decide:** will the new app only ever serve Hynish Clothing, or should it support onboarding other businesses (and one user belonging to several)? The data model supports both. The difference is onboarding UI and a business switcher.
- **Recommendation:** architect for multi-business (already done). Ship the single-business UX first.
- **Blocks:** Phase 1 (auth bootstrap).

### OQ-18 — New Bill `status:'paid'` with `paidAmount:0` — **SOURCE NEEDED**
- **Evidence:** the draft defaults to `status:'paid', paidAmount:0` (TD §5.2), yet status is derived from paid vs total (BR-PAY-02).
- **Why unresolved:** we can't tell whether choosing "Paid" auto-fills the paid amount with the grand total, or whether `status` is just a UI selector.
- **Blocks:** Phase 3.

### OQ-19 — Showing the invoice number before saving — **REQUIRES DECISION**
- **Evidence:** the legacy draft holds `invoiceNo` (TD §5.2), so the next number is presumably shown while billing.
- **Why:** with server numbering, the number is only final on save.
- **Options:** (a) show "Next: INV/2627/0042 (assigned on save)" from the counter, updated live; (b) show "Assigned on save".
- **Recommendation:** (a). It's almost always accurate, it's labelled honestly, and the final number is shown on the success screen and the print.
- **Blocks:** Phase 3.

### OQ-20 — Restore target semantics — **REQUIRES DECISION**
- **Evidence:** legacy restore "replaces ALL current data" on that device (TD §3.2).
- **Options:** (a) replace the whole business in place (after an automatic backup), with no partial merge; (b) restore only into a **new** business (sandbox), then promote; (c) both, where in-place needs owner step-up re-authentication.
- **Also decide:** whether scheduled automatic daily backups (a new feature) are wanted, and their retention.
- **Recommendation:** (c), plus daily scheduled backups with 30-day retention.
- **Blocks:** Phase 6.

### OQ-21 — Changing GST mode while editing a saved bill — **REQUIRES DECISION**
- **Evidence:** editing never touches counters (TD §5.3). Invoice and Without-GST bills use different series.
- **Why:** if a user switches a saved bill between GST and Without GST, its number would belong to the wrong series. The legacy behavior isn't documented.
- **Options:** (a) the GST mode is locked after the first save; (b) allowed, keeping the old number (it would break the series' meaning); (c) allowed by deleting and re-creating with a new number from the other series.
- **Recommendation:** (a), with the UI explaining how to cancel and re-bill.
- **Blocks:** Phase 3.

### OQ-22 — Warning for customers with a blank state — **REQUIRES DECISION**
- **Evidence:** a blank customer state always produces intra-state tax (TD §9 "documented gap").
- **Recommendation:** preserve the tax behavior exactly, and add a **non-blocking** hint on New Bill: "Customer state missing — CGST+SGST applied". This is a UI-only change.
- **Blocks:** Phase 3.

### OQ-23 — Cross-location KPIs for location-restricted users — **REQUIRES DECISION**
- **Evidence:** the Dashboard's Today/Month sales and Outstanding Dues are **not** location-scoped (TD §3.1). In legacy every device held all invoices.
- **Decide:** should a restricted shop account still see all-location totals (legacy parity, served as aggregates only), or only its own location's totals?
- **Recommendation:** legacy parity through an aggregate-only callable, controlled by a permission flag the owner can switch off.
- **Blocks:** Phase 6.

### OQ-24 — Transfer destination authorization — **REQUIRES DECISION**
- **Evidence:** legacy shop users could transfer stock to any location (TD §4.2).
- **Decide:** may a restricted user transfer *to* locations outside their assignment? Recommended: yes (legacy parity), with the source required to be one of their locations.
- **Blocks:** Phase 4.

### OQ-25 — GST mode after converting a quotation or DN to an invoice — **SOURCE NEEDED**
- **Evidence:** quotations always compute GST (TD §5.5). Conversion copies the items into a "fresh draft", and a fresh draft defaults to Without GST.
- **Why:** we can't tell whether conversion sets `gstApplicable:true` or keeps the default. The totals may differ from the quotation.
- **Blocks:** Phase 4.

### OQ-26 — Meaning of `licenseKey` — **SOURCE NEEDED**
- **Evidence:** `licenseKey` is a business identity field (TD §2.3). No licensing check is documented.
- **Decide:** is it a legal or registration identifier to print on documents (for example a trade licence number), or a software licence? It's preserved as a field either way.
- **Blocks:** Phase 2.

### OQ-27 — Duplicate legacy document numbers found during migration — **REQUIRES DECISION**
- **Evidence:** per-device counters could collide (TD §5.7, §9). Without-GST counters were never synced, so duplicate NGST numbers across devices are practically certain.
- **Options:** (a) keep both, flagged as duplicates (default in MIGRATION-PLAN §9); (b) renumber the later **NGST** duplicates only, never GST ones; (c) owner decides case by case from the report.
- **Recommendation:** (b) for NGST, and (c) for any GST duplicates.
- **Blocks:** Phase 7.

### OQ-28 — Bank Operations / Cash-Bank fund transfer — **CONFIRMED ABSENT, not built (Phase 8)**
- **Evidence:** TD documents only `cashOrBankAccount(mode)` (§6.1.6) — every non-Cash payment mode
  (Bank Transfer, UPI, Cheque, Card, Other) books to a single Bank Account; the Chart of Accounts
  never distinguishes them further. There is no bank transaction ledger, no bank reconciliation
  screen, and no fund-transfer operation (Cash↔Bank) anywhere in `finance.js`, `admin.js`, or the
  Cash Book model (§6.3) — "Bank Deposit" is only a Cash Book **out-category label**, not a linked
  double entry against a bank ledger.
- **Why listed here rather than just in the completion doc:** §68 requires an explicit gap record
  whenever the source doesn't define a requested behavior, even when the honest answer is "this
  doesn't exist" rather than "undecided."
- **Decision needed:** none — this isn't a design choice pending an owner call, it's a confirmed
  absence in the source. No Cloud Function, UI screen, or Firestore collection was built for
  Bank Operations or a Cash/Bank transfer in Phase 8.
- **Blocks:** nothing — flagged as a non-blocking, permanent scope boundary unless a future phase's
  source review finds documentation this analysis missed.

---

**Total open questions: 28**. 22 are REQUIRES DECISION, 6 are SOURCE NEEDED (OQ-10 is counted in
both), and 1 (OQ-28) is a confirmed absence recorded for completeness rather than a pending decision.
