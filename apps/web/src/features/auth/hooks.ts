/**
 * Auth/business context hooks (Phase 2 §45). Thin selectors over the single authoritative
 * auth store — no duplicated auth state.
 */
import { useAuthStore } from '@/stores/auth-store';
import type { Permission } from '@hynish/domain';

export function useAuth() {
  return useAuthStore((s) => ({
    status: s.status,
    user: s.user,
    signIn: s.signIn,
    signOut: s.signOutUser,
    signingIn: s.signingIn,
    signInError: s.signInError,
  }));
}

export function useBusiness() {
  return useAuthStore((s) => ({ businessId: s.businessId, businessName: s.businessName }));
}

export function useMembership() {
  return useAuthStore((s) => s.membership);
}

/** A single permission check (re-renders only when the result could change). */
export function usePermission(permission: Permission): boolean {
  return useAuthStore((s) => s.hasPermission(permission));
}

/** The permission checker function (stable) for checking several permissions. */
export function usePermissions() {
  return useAuthStore((s) => s.hasPermission);
}

export function useCurrentLocation() {
  return useAuthStore((s) => ({
    locations: s.locations,
    currentLocationId: s.currentLocationId,
    allowedLocationIds: s.allowedLocationIds,
    canAccessAllLocations: s.allowedLocationIds === null,
    setCurrentLocation: s.setCurrentLocation,
  }));
}
