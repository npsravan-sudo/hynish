/**
 * Centralized permission model (SECURITY-ARCHITECTURE §5).
 * Single source of truth used by route guards, UI gating, Firestore-rule logic and
 * Cloud Functions, so UI and server can never disagree (BR-PRM-09).
 *
 * Roles owner/admin/shop are the verified legacy roles (BR-PRM-02..04). Roles
 * manager/accountant/staff and their permission sets are PROVISIONAL pending OQ-02 —
 * they are wired end-to-end but their exact grants require a business decision. They are
 * marked here and in docs/PERMISSIONS.md; do not treat them as final.
 */

export const PERMISSIONS = [
  'dashboard.view',
  'sales.view', 'sales.create', 'sales.edit', 'sales.delete',
  'quotations.view', 'quotations.manage',
  'deliveryNotes.view', 'deliveryNotes.manage',
  'creditNotes.manage', 'debitNotes.manage',
  'customers.view', 'customers.manage', 'customers.delete',
  'suppliers.view', 'suppliers.manage', 'suppliers.delete',
  'products.view', 'products.manage', 'products.delete', 'barcodes.print',
  'stock.view', 'stock.adjust', 'stock.count', 'stock.transfer', 'reorder.view',
  'stock.overrideNegative', 'credit.overrideLimit',
  'purchases.view', 'purchases.manage', 'purchases.delete',
  'payments.record', 'dues.view',
  'accounting.view', 'accounts.manage',
  'cashbook.view', 'cashbook.manage',
  'expenses.view', 'expenses.manage',
  'gst.view',
  'payroll.view', 'payroll.manage',
  'reports.view', 'shopComparison.view', 'activity.view',
  'settings.manage', 'numbering.manage', 'members.manage', 'locations.manage',
  'backup.create', 'restore.execute', 'data.reset',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Legacy roles are owner/admin/shop; the rest are provisional (OQ-02). */
export const ROLES = ['owner', 'admin', 'manager', 'accountant', 'shop', 'staff'] as const;
export type Role = (typeof ROLES)[number];

const ALL_PERMISSIONS: ReadonlySet<Permission> = new Set(PERMISSIONS);

/**
 * Permissions never granted to any non-admin role, even via overrides (BR-PRM-03).
 * Admin-only deletes are also here so a non-admin override cannot grant them (BR-PRM-05).
 */
export const HARD_EXCLUDED_FOR_NON_ADMIN: ReadonlySet<Permission> = new Set<Permission>([
  'settings.manage', 'numbering.manage', 'members.manage', 'locations.manage',
  'backup.create', 'restore.execute', 'data.reset',
  'sales.delete', 'customers.delete', 'suppliers.delete', 'products.delete',
]);

/**
 * Default shop permission set (BR-PRM-04). Provisional until the exact legacy
 * DEFAULT_SHOP_TABS list is confirmed (OQ-10). Never includes Accounting, Cash Book,
 * Expenses, Dues or GST Filing.
 */
export const DEFAULT_SHOP_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'dashboard.view',
  'sales.view', 'sales.create', 'sales.edit',
  'quotations.view', 'quotations.manage',
  'deliveryNotes.view', 'deliveryNotes.manage',
  'customers.view', 'customers.manage',
  'products.view', 'barcodes.print',
  'stock.view', 'stock.adjust', 'stock.count', 'stock.transfer', 'reorder.view',
  'stock.overrideNegative', 'credit.overrideLimit',
]);

/** PROVISIONAL (OQ-02): a fuller operational role — shop plus purchases/expenses/dues/reports. */
const MANAGER_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  ...DEFAULT_SHOP_PERMISSIONS,
  'suppliers.view', 'suppliers.manage',
  'purchases.view', 'purchases.manage',
  'payments.record', 'dues.view',
  'expenses.view', 'expenses.manage',
  'cashbook.view', 'cashbook.manage',
  'reports.view', 'shopComparison.view',
]);

/** PROVISIONAL (OQ-02): books-focused, view-heavy, no stock mutation. */
const ACCOUNTANT_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'dashboard.view',
  'sales.view', 'quotations.view', 'deliveryNotes.view',
  'customers.view', 'suppliers.view', 'products.view', 'stock.view',
  'purchases.view', 'payments.record', 'dues.view',
  'accounting.view', 'cashbook.view', 'cashbook.manage',
  'expenses.view', 'expenses.manage', 'gst.view',
  'reports.view', 'shopComparison.view',
]);

/** PROVISIONAL (OQ-02): minimal counter staff — create bills, look up products/customers. */
const STAFF_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'dashboard.view',
  'sales.view', 'sales.create',
  'customers.view', 'customers.manage',
  'products.view', 'barcodes.print',
  'stock.view',
]);

/** Base permission set per role, before per-member overrides. */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  accountant: ACCOUNTANT_PERMISSIONS,
  shop: DEFAULT_SHOP_PERMISSIONS,
  staff: STAFF_PERMISSIONS,
};

export interface PermissionActor {
  role: Role;
  /** Per-member overrides (legacy `tabs`). true grants, false explicitly denies. */
  overrides?: Partial<Record<Permission, boolean>> | null | undefined;
}

export function isAdminRole(role: Role): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Resolve whether an actor holds a permission (SECURITY §5.2).
 * Admins hold everything. Non-admins: hard exclusions win; then an explicit override;
 * then the role's base set (unless explicitly denied by an override).
 */
export function can(actor: PermissionActor, permission: Permission): boolean {
  if (isAdminRole(actor.role)) return true;
  if (HARD_EXCLUDED_FOR_NON_ADMIN.has(permission)) return false;
  const override = actor.overrides?.[permission];
  if (override === true) return true;
  if (override === false) return false;
  return ROLE_PERMISSIONS[actor.role].has(permission);
}

/** All permissions an actor effectively holds (for UI capability lists and debugging). */
export function resolvePermissions(actor: PermissionActor): Permission[] {
  return PERMISSIONS.filter((p) => can(actor, p));
}
