# Permissions & Role Matrix

> **Phase 2 deliverable** (Phase 2 §16). The authoritative role → permission matrix. It is
> **generated from** `packages/domain/src/permissions.ts` (the single source of truth used by
> the client UI, Cloud Functions and Firestore rules), so this table cannot drift from the code
> that enforces it. Regenerate after changing the domain permission model.
>
> **Legend:** ✅ granted · `·` denied. Owner and Admin hold every permission.
>
> **Provisional roles (OQ-02):** `owner`, `admin` and `shop` are the verified legacy roles.
> `manager`, `accountant` and `staff` and their grants below are **provisional** and require a
> business decision before they are considered final.

## Principles

- **Least privilege.** Non-admin roles start from a small base set; administrators grant more
  via per-member permission overrides (the legacy `tabs` concept).
- **Hard exclusions.** Some permissions are *never* granted to a non-admin role, even by an
  override (see the list under the matrix). This is enforced identically in the client, in
  Cloud Functions, and in Firestore rules.
- **UX vs. security.** The client uses this matrix to hide UI; it is **not** the security
  boundary. Every operation is independently authorized by Firestore rules and/or Cloud
  Functions (Phase 2 §49).
- **Location scope.** Orthogonal to permissions: a member with `locationIds` set may only read
  or act on documents at those locations (fails closed). `null` = all locations. Owner/Admin are
  never location-restricted.
- **Business isolation.** Every check is scoped to the member's business; a member of one
  business can never read or write another's data.

## Matrix

| Permission | Owner | Admin | Manager | Accountant | Shop | Staff |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `dashboard.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `sales.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `sales.create` | ✅ | ✅ | ✅ | · | ✅ | ✅ |
| `sales.edit` | ✅ | ✅ | ✅ | · | ✅ | · |
| `sales.delete` | ✅ | ✅ | · | · | · | · |
| `quotations.view` | ✅ | ✅ | ✅ | ✅ | ✅ | · |
| `quotations.manage` | ✅ | ✅ | ✅ | · | ✅ | · |
| `deliveryNotes.view` | ✅ | ✅ | ✅ | ✅ | ✅ | · |
| `deliveryNotes.manage` | ✅ | ✅ | ✅ | · | ✅ | · |
| `creditNotes.manage` | ✅ | ✅ | · | · | · | · |
| `debitNotes.manage` | ✅ | ✅ | · | · | · | · |
| `customers.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `customers.manage` | ✅ | ✅ | ✅ | · | ✅ | ✅ |
| `customers.delete` | ✅ | ✅ | · | · | · | · |
| `suppliers.view` | ✅ | ✅ | ✅ | ✅ | · | · |
| `suppliers.manage` | ✅ | ✅ | ✅ | · | · | · |
| `suppliers.delete` | ✅ | ✅ | · | · | · | · |
| `products.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `products.manage` | ✅ | ✅ | · | · | · | · |
| `products.delete` | ✅ | ✅ | · | · | · | · |
| `barcodes.print` | ✅ | ✅ | ✅ | · | ✅ | ✅ |
| `stock.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `stock.adjust` | ✅ | ✅ | ✅ | · | ✅ | · |
| `stock.count` | ✅ | ✅ | ✅ | · | ✅ | · |
| `stock.transfer` | ✅ | ✅ | ✅ | · | ✅ | · |
| `reorder.view` | ✅ | ✅ | ✅ | · | ✅ | · |
| `stock.overrideNegative` | ✅ | ✅ | ✅ | · | ✅ | · |
| `credit.overrideLimit` | ✅ | ✅ | ✅ | · | ✅ | · |
| `purchases.view` | ✅ | ✅ | ✅ | ✅ | · | · |
| `purchases.manage` | ✅ | ✅ | ✅ | · | · | · |
| `purchases.delete` | ✅ | ✅ | · | · | · | · |
| `payments.record` | ✅ | ✅ | ✅ | ✅ | · | · |
| `dues.view` | ✅ | ✅ | ✅ | ✅ | · | · |
| `accounting.view` | ✅ | ✅ | · | ✅ | · | · |
| `accounts.manage` | ✅ | ✅ | · | · | · | · |
| `cashbook.view` | ✅ | ✅ | ✅ | ✅ | · | · |
| `cashbook.manage` | ✅ | ✅ | ✅ | ✅ | · | · |
| `expenses.view` | ✅ | ✅ | ✅ | ✅ | · | · |
| `expenses.manage` | ✅ | ✅ | ✅ | ✅ | · | · |
| `gst.view` | ✅ | ✅ | · | ✅ | · | · |
| `payroll.view` | ✅ | ✅ | · | · | · | · |
| `payroll.manage` | ✅ | ✅ | · | · | · | · |
| `reports.view` | ✅ | ✅ | ✅ | ✅ | · | · |
| `shopComparison.view` | ✅ | ✅ | ✅ | ✅ | · | · |
| `activity.view` | ✅ | ✅ | · | · | · | · |
| `settings.manage` | ✅ | ✅ | · | · | · | · |
| `numbering.manage` | ✅ | ✅ | · | · | · | · |
| `members.manage` | ✅ | ✅ | · | · | · | · |
| `locations.manage` | ✅ | ✅ | · | · | · | · |
| `backup.create` | ✅ | ✅ | · | · | · | · |
| `restore.execute` | ✅ | ✅ | · | · | · | · |
| `data.reset` | ✅ | ✅ | · | · | · | · |

HARD_EXCLUDED_FOR_NON_ADMIN: `settings.manage`, `numbering.manage`, `members.manage`, `locations.manage`, `backup.create`, `restore.execute`, `data.reset`, `sales.delete`, `customers.delete`, `suppliers.delete`, `products.delete`

## Hard exclusions (never grantable to a non-admin, even via overrides)

`settings.manage`, `numbering.manage`, `members.manage`, `locations.manage`, `backup.create`,
`restore.execute`, `data.reset`, `sales.delete`, `customers.delete`, `suppliers.delete`,
`products.delete`.

This preserves the legacy rules: administrative screens and deletes are admin/owner-only
(BR-PRM-03, BR-PRM-05), and restore/reset default to owner+admin (narrowing to owner-only is
OQ-02).

## Owner protection

- Only an **owner** may create an owner, change any member to/from the owner role, or
  deactivate an owner (Phase 2 §30). An admin cannot escalate themselves or others to owner.
- No member — of any role — may modify **their own** membership (role, permissions, active,
  locations). All member changes go through the audited `members.*` Cloud Functions; direct
  client writes to member documents are denied by Firestore rules (BR-PRM-07).

## Enforcement points

| Layer | What it checks | Source |
|---|---|---|
| Client UI | Hides nav/actions the user lacks | `can()` via `usePermission` / `PermissionGate` |
| Firestore rules | Read gating by permission + location; server-only writes | `firestore.rules` (mirrors `can()`) |
| Cloud Functions | Every mutation: auth → active member → permission → location → step-up | `functions/src/auth/authorize.ts` |
| Storage rules | Business-isolated, member-gated, image type/size | `storage.rules` |

All four consult the same permission model, verified for parity by the emulator rule tests in
`tests/rules/` and the unit tests in `functions/src/auth/authorize.test.ts`.
