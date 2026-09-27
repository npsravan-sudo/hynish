import type { ReactNode } from 'react';
import type { Permission, Role } from '@hynish/domain';
import { useAuthStore } from '@/stores/auth-store';

/**
 * UX-only permission/role gates (Phase 2 §17, §49). These hide UI a user cannot use; they are
 * NOT the security boundary — Firestore rules and Cloud Functions still enforce every operation.
 */
export function PermissionGate({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const allowed = useAuthStore((s) => s.hasPermission(permission));
  return <>{allowed ? children : fallback}</>;
}

export function RoleGate({
  roles,
  fallback = null,
  children,
}: {
  roles: Role[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const role = useAuthStore((s) => s.role);
  return <>{role && roles.includes(role) ? children : fallback}</>;
}
