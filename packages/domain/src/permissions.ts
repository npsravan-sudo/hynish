/**
 * Centralized permission model (SECURITY-ARCHITECTURE §5).
 * Used by route guards, UI gating, Firestore rules generation and Cloud Functions,
 * so UI and server can never disagree (BR-PRM-09).
 *
 * Phase 1 defines the model. Phase 2 wires it to real membership. Roles beyond
 * owner/admin/shop (manager/accountant/staff) are provisional pending OQ-02.
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

/** Legacy roles are owner/admin/shop (BR-PRM-02..04). The rest are provisional (OQ-02). */
export const ROLES = ['owner', 'admin', 'shop', 'manager', 'accountant', 'staff'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Permissions never granted to any non-admin role, even via overrides (BR-PRM-03).
 * Admin-only deletes are also here so a shop override cannot grant them (BR-PRM-05).
 */
const HARD_EXCLUDED_FOR_NON_ADMIN: ReadonlySet<Permission> = new Set<Permission>([
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

export interface PermissionActor {
  role: Role;
  /** Per-member overrides (legacy `tabs`). true grants, false explicitly denies. */
  overrides?: Partial<Record<Permission, boolean>> | null;
}

export function isAdminRole(role: Role): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Resolve whether an actor holds a permission (SECURITY §5.2).
 * Admins hold everything. Non-admins: hard exclusions win; then an explicit override;
 * then the default shop set (unless explicitly denied by an override).
 */
export function can(actor: PermissionActor, permission: Permission): boolean {
  if (isAdminRole(actor.role)) return true;
  if (HARD_EXCLUDED_FOR_NON_ADMIN.has(permission)) return false;
  const override = actor.overrides?.[permission];
  if (override === true) return true;
  if (override === false) return false;
  return DEFAULT_SHOP_PERMISSIONS.has(permission);
}
