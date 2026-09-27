/**
 * Business/session context (Phase 1 §45–§47).
 *
 * IMPORTANT: this phase does NOT implement authentication. There is no fake login and no
 * pretend credentials. This store holds a typed, clearly-flagged PLACEHOLDER context
 * (`isPlaceholder: true`) so the shell — navigation, permission gating, location selector —
 * can be exercised and proven. Phase 2 replaces the placeholder with real Firebase Auth,
 * Firestore membership, permission resolution and location authorization.
 *
 * The placeholder uses the documented legacy seed locations (DEF-030) purely to demonstrate
 * the multi-location concept; it is not persisted and carries no real business data.
 */
import { create } from 'zustand';
import { can, type Permission, type Role } from '@hynish/domain';

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
}

export interface SessionLocation {
  id: string;
  name: string;
  type: 'shop' | 'warehouse';
}

export type SessionStatus = 'loading' | 'unauthenticated' | 'ready';

interface SessionState {
  status: SessionStatus;
  isPlaceholder: boolean;
  businessId: string | null;
  businessName: string | null;
  user: SessionUser | null;
  role: Role | null;
  /** null = unrestricted (all locations); otherwise the allowed location ids. */
  allowedLocationIds: string[] | null;
  locations: SessionLocation[];
  /** null represents the "All locations" selection where the user is unrestricted. */
  currentLocationId: string | null;

  hasPermission: (permission: Permission) => boolean;
  setCurrentLocation: (id: string | null) => void;
}

// --- Phase 1 placeholder context (removed in Phase 2) --------------------------------
const PLACEHOLDER_LOCATIONS: SessionLocation[] = [
  { id: 'loc-baby-step', name: 'Baby Step', type: 'shop' },
  { id: 'loc-cool-kids', name: 'Cool Kids', type: 'shop' },
  { id: 'loc-quency-culture', name: 'Quency Culture', type: 'shop' },
  { id: 'loc-hynish-wh', name: 'Hynish Warehouse', type: 'warehouse' },
];

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'ready',
  isPlaceholder: true,
  businessId: 'placeholder-business',
  businessName: 'Hynish Clothing',
  user: { uid: 'placeholder', email: 'not-signed-in@hynish.local', displayName: 'Preview User' },
  role: 'owner',
  allowedLocationIds: null,
  locations: PLACEHOLDER_LOCATIONS,
  currentLocationId: null,

  hasPermission: (permission) => {
    const role = get().role;
    if (!role) return false;
    return can({ role }, permission);
  },
  setCurrentLocation: (id) => set({ currentLocationId: id }),
}));
