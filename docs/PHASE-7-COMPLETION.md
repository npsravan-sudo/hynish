# Phase 7 — Completion Report

Accounting, Ledger, Journals & Financial Management. Chart of Accounts, one authoritative posting
gateway (reused, not duplicated), General Ledger, Trial Balance, P&L, Balance Sheet, Receivables,
Payables, Cash Book, GST Input/Output visibility. Server-authoritative, atomic, idempotent.
Browser/PWA only — no Electron/.exe/installer.

## Architecture

```
Sales/Purchases/Payments ──┐
                            ▼
                    postJournalTx (txn)  ──▶ journalEntries (+ derived accountIds)
                            ▲
Cash Book (logCashEntry) ───┘  (never reaches postJournalTx — separate, informal ledger)

journalEntries ──▶ useLedgerAggregate (bounded, capped fetch) ──▶ General Ledger / Trial Balance /
                                                                    P&L / Balance Sheet / Receivables
```

`postJournalTx` (built in Phase 5, extended this phase) remains the ONE place a journal entry is
ever written. Phase 7 adds no second posting path: it adds the Chart of Accounts that the fixed
account ids already referenced, a derived `accountIds` field so entries are queryable per account,
and read-only financial statements computed live over the existing journal.

## Where it lives

| Layer | Location | Contents |
|---|---|---|
| Domain | `packages/domain/src/accounting.ts` | `accountBalance`, reconciliation helpers (`findUnbalancedEntries`, `findDuplicatePostedRefs`, `findOrphanAccountRefs`) |
| Domain schemas | `packages/domain/src/schemas/finance.ts` | `createAccountSchema`; `journalEntrySchema` + `accountIds` |
| Posting gateway | `functions/src/accounting/post-core.ts` | `postJournalTx` (now derives + stores `accountIds`), `readPostedJournalsForRef`, `voidEntries` — unchanged contract, reused by Sales/Purchases |
| Accounting callables | `functions/src/accounting/{seed-accounts,save-account,delete-account,cash-book}.ts` | seed/save/delete Chart of Accounts; log a Cash Book entry |
| Web services/hooks | `apps/web/src/services/accounting.service.ts`, `features/accounting/use-ledger-aggregate.ts`, `use-accounts.ts`, `statement-helpers.ts` | the only write paths; the bounded full-ledger read pattern shared by every statement page |
| Web UI | `apps/web/src/features/accounting/*` | Chart of Accounts, Journal list/detail, General Ledger, Trial Balance, P&L, Balance Sheet, Payables, Cash Book |
| Rules/indexes | `firestore.rules`, `firestore.indexes.json` | client writes denied; `accountIds`+`date` (array-contains, ascending) and other journal/cash-entry indexes |

## Chart of Accounts (BR-ACC-06, TD §6.1.1)

The 14 default system accounts (Assets: Cash in Hand, Bank Account, Accounts Receivable,
Inventory, GST Input Credit; Liabilities: Accounts Payable, GST Output Payable, Loans Payable;
Equity: Owner's Capital, Owner's Drawings; Income: Sales Revenue, Other Income; Expense: Cost of
Goods Sold, Other Expenses) are the exact fixed ids journal postings have referenced by literal
string since Phase 5 (`acc-cash`, `acc-sales`, `acc-gst-output`, …). Until this phase no
`Account` document existed for them — `seedChartOfAccounts` is the first writer, and it is
idempotent (a per-doc existence check, so a retry or repeated admin click never duplicates or
overwrites one). Custom (non-system) accounts are created by `saveAccount`, which rejects a
duplicate name (case-insensitive) and auto-assigns a code (max existing code of the same type + 10)
when the caller leaves it blank — mirroring the legacy `addCustomAccount()` behavior. Only creation
is supported; the source has no "edit account" flow. `deleteAccount` refuses a system account and
refuses any account still referenced by a journal entry (checked via the `accountIds`
array-contains index), so a balance can never be silently orphaned.

## Journal architecture & posting gateway (BR-ACC-01..05, §12, §53)

Unchanged from Phase 5/6, reused rather than duplicated: `postJournalTx` validates
`Σdebit === Σcredit` exactly in paise via `validateJournal()`, prunes zero lines, and refuses to
persist anything that doesn't balance — server-side, inside the caller's transaction, never
trusting a client-supplied total. Edits/deletes never adjust a posted entry in place; they void
the prior posted entries for `(refType, refId)` and re-post (BR-ACC-05). This phase's only change
to the gateway itself: it now also computes and stores `accountIds` — the distinct set of
accountIds referenced by the entry's lines — so General Ledger and `deleteAccount` can query by
account without a second index structure.

## Financial statements (TD §6.2) — computed live, nothing cached

- **General Ledger** (BR-ACC-16): per-account running balance, sorted by date then createdAt.
  Queries `journalEntries` by `accountIds array-contains {id}`; the running balance is accumulated
  client-side line-by-line via `accountBalance()`.
- **Trial Balance** (BR-ACC-13): all-time, all locations. Each account's balance is split into a
  Debit or Credit column by sign + normal side (a normal/non-negative balance lands in its own
  normal-side column; an abnormal/negative one lands in the opposite column). Shows
  "Balanced ✓" or a critical integrity alert if debits ≠ credits (structurally unreachable since
  `postJournalTx` refuses unbalanced entries — a hit here would be a real data-integrity bug).
- **Profit & Loss** (BR-ACC-14): defaults to month-to-date, all locations. Income − COGS = Gross
  Profit; Gross Profit − every other expense account = Net Profit, shown with both a color and an
  icon/text label ("Profit"/"Loss") — never color alone.
- **Balance Sheet** (BR-ACC-15): as-of-date snapshot. Assets / Liabilities / Equity, with
  Retained Earnings computed as cumulative lifetime income − expense up to that date; same
  balanced check as Trial Balance.
- **Receivables / Payables**: Receivables (Dues) already existed from Phase 5; Payables mirrors it
  exactly, sourced from `purchases` (supplierBillNo/supplierSnapshot) instead of invoices.
- All of the above read through `useLedgerAggregate` — a bounded (capped at 5000 entries),
  cursor-paginated full fetch that surfaces a `truncated` flag in the UI. This honestly preserves
  the source's own "recompute live from the full array, nothing cached" behavior while still
  respecting the phase's own guidance not to download an unbounded history — the cap is a stated,
  visible limit rather than a silent one.

## Cash Book (BR-CASH-01..04, TD §6.3)

A deliberately separate, informal ledger — `logCashEntry` never calls `postJournalTx` and no Cash
Book entry ever produces a journal entry. Balance at a location = that location's own
`openingCashBalancePaise` + the all-time net of its entries; there is no combined all-locations
cash balance (BR-CASH-03). The `source: {type, id}` shape anticipated in Phase 5/6 now has its
`'manual'` variant populated by user-entered rows (`source: {type: 'manual', id: null}`).

## Accounting integrations (§37/§38, unchanged from Phase 5/6)

Sales, Purchases, Payments and COGS integrations were built in earlier phases and are reused
as-is: Phase 7 adds no new integration point, no new tax treatment, and no new valuation method.
GST Input (`acc-gst-input`) is still never posted on purchases (BR-PUR-08/OQ-06, unchanged).

## Security (§24, §49, §53, §61)

All accounting writes are server-authoritative callables running App Check + auth + Zod →
`resolveActor` → `assertPermission` → `assertLocationAccess` (Cash Book entries are
location-scoped). `accounts.manage` gates Chart of Accounts mutations; `cashbook.manage` gates
Cash Book entries; `accounting.view`/`cashbook.view` gate reads, matching Firestore rules exactly.
Firestore rules deny all client writes to `accounts`, `journalEntries`, `cashEntries`; reads are
permission-gated (+ location for `cashEntries`). Reconciliation helpers
(`findUnbalancedEntries`, `findDuplicatePostedRefs`, `findOrphanAccountRefs`, §49) are
detection-only — pure functions that return findings for review; nothing in this codebase calls
them to auto-repair the ledger.

## §65 — deliberately not built (do not invent)

TD §6.1 states explicitly: **"the business user never touches a debit/credit screen directly
except in the Chart of Accounts itself."** Reading this together with §65's mandate not to invent
new reversal rules or new payment behavior, this phase deliberately does **not** build:

- A generic manual-journal-entry UI or callable. Every journal entry in this system is produced by
  a specific business event (an invoice, a purchase, a payment) through code that already exists;
  there is no free-form "post a journal" screen in the source, so building one would be new
  functionality, not preserved behavior.
- A generic `reverseJournal` callable. The source's only reversal mechanism is edit/delete
  triggering void-then-repost on the owning document (BR-ACC-05) — already implemented in Phase 5
  for Sales and Phase 6 for Purchases. A standalone "reverse this journal entry" action would be an
  invented workflow the source doesn't have.

Both were checked against the TD, the previous phase docs, and left undocumented nowhere; there was
no OQ needed because the source is explicit on this point.

## Tests

- **Domain** (`accounting.test.ts`, 16 tests): `validateJournal` balance/empty/invalid-line cases;
  the 14-account Chart of Accounts (ids + `isSystem`); `normalSide`/`accountBalance` for every
  account type including abnormal (negative) balances; `cashOrBankAccountId`; `createAccountSchema`
  validation (empty name, unknown type, non-positive code); `findUnbalancedEntries`,
  `findDuplicatePostedRefs`, `findOrphanAccountRefs` (§49 reconciliation, detection-only).
- **Emulator** (`accounting.emu.test.ts`, new): `postJournalTx` derives and stores the correct
  distinct `accountIds` set; the General Ledger's `accountIds array-contains` + `date` query
  returns only entries referencing the queried account, in chronological order; an account with no
  referencing entries reads as empty (the shape `deleteAccount`'s safety check relies on).
- **Rules** (`accounting.test.ts` under `tests/rules/`, new): client writes denied for
  `accounts`/`cashEntries` (create/update/delete all fail); `accounts` reads require
  `accounting.view`; `cashEntries` reads require `cashbook.view` AND are further gated by
  location; a member of a different business cannot read or write any of `accounts` /
  `journalEntries` / `cashEntries` (cross-business isolation). `journalEntries` write-denial and
  `accounting.view`-gated reads were already covered by `sales.test.ts` and are unchanged.
- **Not independently emulator-tested at the callable-invocation layer**: `seedChartOfAccounts`,
  `saveAccount`, `deleteAccount`, `logCashEntry` are each a single-purpose `defineCallable` (no
  shared transaction core, matching the codebase convention that only logic reused by multiple
  callers is extracted into a `-core.ts` module — see `post-core.ts`/`stock-core.ts`/
  `reserve-core.ts` for the pattern this deliberately does not force here). Invoking a
  `defineCallable`-wrapped function requires the full App Check + callable-auth harness, which no
  test in this repo does for any single-purpose callable (the same is true of Phase 4's masterdata
  save/delete callables). Their business logic (duplicate-name rejection, auto-code computation,
  system-account/referenced-account refusal, idempotency-by-requestId) was verified by code review
  against BR-ACC-06/18 and by the domain/rules tests above, which cover the pure logic
  (`createAccountSchema`) and the data shape those callables produce and depend on
  (`accountIds`-based referenced-account detection).

## Verification (Definition of Done)

- `npm run typecheck` (domain+web+functions) ✅ · `npm run lint` ✅ (0 errors, pre-existing
  fast-refresh warnings only) · `npm test` — domain 109 / web 28 / functions 19 ✅ ·
  `npm run test:rules` — 70 passed (Firestore emulator, includes the 9 new Phase 7 tests) ✅ ·
  `npm run build` ✅

## Unresolved source gaps (documented, not invented)

- OQ-11: numeric account codes (1000/1010/1100/…) are NOT VERIFIED from the source; they are a
  conventional layout defined once in `DEFAULT_CHART_OF_ACCOUNTS` — unchanged from when this was
  first flagged.
- GST Input/Output "visibility" this phase means: the two accounts (`acc-gst-input`,
  `acc-gst-output`) are ordinary Chart-of-Accounts/General-Ledger entries like any other — no
  separate GST Filing report was built (that is Phase 9, per the existing `accounting-pages.tsx`
  placeholder comment); building one now would be inventing a report the TD does not define for
  this phase's scope.

---

LEGACY COMPATIBILITY CHECK

Chart of Accounts
- Existing default accounts preserved: all 14 system accounts (Assets/Liabilities/Equity/Income/Expenses), exact ids and names journal postings already referenced (BR-ACC-06).
- Existing account-creation behavior preserved: duplicate name rejected case-insensitively; auto-code = max(code of same type) + 10 when blank (BR-ACC-18).
- Existing account-deletion safety preserved: system accounts and referenced accounts cannot be deleted (no data loss / no orphaned journal lines).

Journal
- Existing entry shape preserved: date, locationId, refType, refId, refLabel, lines[] — no fields removed or renamed.
- Existing invariant preserved: debit = credit, enforced server-side before persistence, never trusting client totals (BR-ACC-01/02/03, §12).
- Existing posting gateway preserved and NOT duplicated: one `postJournalTx`, reused by every module (§53).
- Existing edit/delete behavior preserved: void-then-repost, never an in-place adjustment (BR-ACC-05).

Accounting integrations
- Sales/Purchase/Payment/COGS/Inventory/GST-Input/GST-Output postings preserved unchanged from Phase 5/6 — no new integration point added.
- Receivables preserved (Phase 5); Payables added this phase mirrors it exactly from Purchases data.
- Cash Book preserved as a separate, non-journal-posting ledger (BR-CASH-01..04).

Existing calculations preserved
- Trial Balance debit/credit split by sign + normal side (BR-ACC-13) — covered by domain balance-math tests.
- P&L Income − COGS = Gross Profit; Gross Profit − other expenses = Net Profit, month-to-date default (BR-ACC-14).
- Balance Sheet Assets/Liabilities/Equity + Retained Earnings = cumulative lifetime income − expense, as-of-date (BR-ACC-15).
- General Ledger running balance sorted by date then createdAt (BR-ACC-16).

Existing permissions preserved
- accounts.manage gates Chart of Accounts mutation; cashbook.manage (+ location) gates Cash Book entries; accounting.view/cashbook.view gate reads — unchanged permission model (Phase 4).

Existing document behavior / reports preserved
- No new document types invented. Financial statements are the ones the TD defines (Trial Balance, P&L, Balance Sheet, General Ledger); no additional report was added.

Existing user-visible behavior preserved
- Net Profit/Loss shown with icon + text label, not color alone (§55, accessibility).
- "Balanced ✓" / critical-alert badge on Trial Balance and Balance Sheet.

Deviations (with reason / OQ ref)
- Account numeric codes are a conventional layout, NOT VERIFIED from source (OQ-11) — the one place they're defined, easy to correct once confirmed.
- Ledger reads are capped at 5000 entries with a visible "truncated" indicator rather than truly unbounded, to avoid downloading an entire business's history client-side (§35/§56); the source itself recomputes from "the full array" with no such cap documented, so this is a bounded approximation of that behavior, disclosed in the UI rather than silent.
- No generic manual-journal-entry UI/callable and no generic `reverseJournal` callable were built — a deliberate §65 do-not-invent decision, not a gap; see the dedicated section above.

NOT VERIFIED items touched
- Account numeric codes (OQ-11, unchanged from Phase 5).
- GST Filing / GST Input-Output dedicated report is out of this phase's scope (deferred to Phase 9 per the existing placeholder).
