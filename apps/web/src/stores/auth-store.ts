/**
 * Authoritative client auth/session state (Phase 2 §7, §10, §11, §44, §45).
 *
 * ONE source of truth: Firebase Auth session + the business membership document. There is no
 * fake authentication and no parallel session system. Authorization shown here is UX only —
 * Firestore rules and Cloud Functions remain authoritative (§49).
 *
 * Flow (§44): configured? -> auth state -> membership -> status. The shell only renders once
 * status is resolved, so authenticated content never flashes before authorization is known.
 */
import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, getIdTokenResult } from 'firebase/auth';
import { doc, onSnapshot, collection, type Unsubscribe } from 'firebase/firestore';
import { can, type Permission, type Role } from '@hynish/domain';
import { appConfig } from '@/config/env';
import { isFirebaseConfigured } from '@/config/env';
import { getFirebaseAuth } from '@/lib/firebase/auth';
import { getDb } from '@/lib/firebase/firestore';
import { initAppCheck } from '@/lib/firebase/app-check';
import { callable } from '@/lib/firebase/functions';
import { friendlyAuthError, errorCode } from '@/features/auth/auth-errors';

export type AuthStatus =
  | 'loading'
  | 'configError'
  | 'signedOut'
  | 'unauthorized'
  | 'inactive'
  | 'ready';

export interface Membership {
  uid: string;
  role: Role;
  active: boolean;
  locationIds: string[] | null;
  permissionOverrides: Partial<Record<Permission, boolean>> | null;
  displayName: string | null;
  email: string | null;
}

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

/** Pure status resolution (unit-tested; no Firebase). */
export function resolveAuthStatus(input: {
  configured: boolean;
  hasUser: boolean;
  membershipLoaded: boolean;
  membership: Membership | null;
}): AuthStatus {
  if (!input.configured) return 'configError';
  if (!input.hasUser) return 'signedOut';
  if (!input.membershipLoaded) return 'loading';
  if (!input.membership) return 'unauthorized';
  if (!input.membership.active) return 'inactive';
  return 'ready';
}

/** Default working location for a member (first allowed; null = all locations). */
export function defaultLocationFor(membership: Membership | null, locations: SessionLocation[]): string | null {
  if (!membership) return null;
  if (membership.locationIds === null) return null; // unrestricted -> "All locations"
  const first = locations.find((l) => membership.locationIds?.includes(l.id));
  return first?.id ?? membership.locationIds[0] ?? null;
}

const REAUTH_MAX_AGE_MS = 30 * 24 * 3600 * 1000;

interface AuthState {
  status: AuthStatus;
  configured: boolean;
  user: SessionUser | null;
  businessId: string;
  businessName: string | null;
  membership: Membership | null;
  role: Role | null;
  allowedLocationIds: string[] | null;
  locations: SessionLocation[];
  currentLocationId: string | null;
  signInError: string | null;
  signingIn: boolean;

  init: () => () => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOutUser: () => Promise<void>;
  setCurrentLocation: (id: string | null) => void;
  hasPermission: (permission: Permission) => boolean;
}

let membershipUnsub: Unsubscribe | null = null;
let locationsUnsub: Unsubscribe | null = null;
let settingsUnsub: Unsubscribe | null = null;
let loggedSessionForUid: string | null = null;

function teardownBusinessListeners() {
  membershipUnsub?.();
  locationsUnsub?.();
  settingsUnsub?.();
  membershipUnsub = null;
  locationsUnsub = null;
  settingsUnsub = null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  configured: isFirebaseConfigured,
  user: null,
  businessId: appConfig.businessId,
  businessName: null,
  membership: null,
  role: null,
  allowedLocationIds: null,
  locations: [],
  currentLocationId: null,
  signInError: null,
  signingIn: false,

  init: () => {
    if (!isFirebaseConfigured) {
      set({ status: 'configError', configured: false });
      return () => {};
    }
    initAppCheck();
    const auth = getFirebaseAuth();
    const db = getDb();
    const businessId = get().businessId;

    const authUnsub = onAuthStateChanged(auth, async (user: User | null) => {
      teardownBusinessListeners();

      if (!user) {
        loggedSessionForUid = null;
        set({
          status: 'signedOut',
          user: null,
          membership: null,
          role: null,
          allowedLocationIds: null,
          locations: [],
          currentLocationId: null,
        });
        return;
      }

      // Enforce the 30-day interactive re-auth window on the client (server also enforces it).
      try {
        const tokenResult = await getIdTokenResult(user);
        const authTimeMs = Date.parse(tokenResult.authTime);
        if (Number.isFinite(authTimeMs) && Date.now() - authTimeMs > REAUTH_MAX_AGE_MS) {
          await signOut(auth);
          set({ signInError: 'Your sign-in has expired. Please sign in again.' });
          return;
        }
      } catch {
        /* token read failed; the membership listener below will still resolve state */
      }

      set({
        user: {
          uid: user.uid,
          email: user.email ?? '',
          displayName: user.displayName ?? user.email ?? 'User',
        },
        status: 'loading',
      });

      // Membership listener (authoritative for authorization state; §32 realtime updates).
      membershipUnsub = onSnapshot(
        doc(db, `businesses/${businessId}/members/${user.uid}`),
        (snap) => {
          if (!snap.exists()) {
            set({ status: 'unauthorized', membership: null, role: null });
            return;
          }
          const d = snap.data();
          const membership: Membership = {
            uid: user.uid,
            role: d.role as Role,
            active: d.active === true,
            locationIds: Array.isArray(d.locationIds) ? d.locationIds : d.locationIds === null ? null : null,
            permissionOverrides: (d.permissionOverrides ?? null) as Membership['permissionOverrides'],
            displayName: d.displayName ?? null,
            email: d.email ?? null,
          };
          const status = resolveAuthStatus({ configured: true, hasUser: true, membershipLoaded: true, membership });
          set({
            status,
            membership,
            role: membership.role,
            allowedLocationIds: membership.locationIds,
          });

          if (status === 'ready') {
            // Record the interactive login once per session (fire-and-forget; §50).
            if (loggedSessionForUid !== user.uid) {
              loggedSessionForUid = user.uid;
              void callable<{ businessId: string; event: 'login' }, { ok: boolean }>('logSession')({
                businessId,
                event: 'login',
              }).catch(() => undefined);
            }
            startBusinessDataListeners(businessId);
          } else {
            teardownExtraListeners();
          }
        },
        () => {
          // A read error here (e.g. rules) means we cannot confirm membership -> treat as unauthorized.
          set({ status: 'unauthorized', membership: null, role: null });
        },
      );
    });

    function teardownExtraListeners() {
      locationsUnsub?.();
      settingsUnsub?.();
      locationsUnsub = null;
      settingsUnsub = null;
    }

    function startBusinessDataListeners(bId: string) {
      if (!locationsUnsub) {
        locationsUnsub = onSnapshot(collection(db, `businesses/${bId}/locations`), (qs) => {
          const locations: SessionLocation[] = qs.docs
            .map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                name: (d.name as string) ?? docSnap.id,
                type: (d.type as SessionLocation['type']) ?? 'shop',
                sortOrder: (d.sortOrder as number) ?? 0,
                deletedAt: d.deletedAt ?? null,
              };
            })
            .filter((l) => l.deletedAt == null)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(({ id, name, type }) => ({ id, name, type }));
          const st = get();
          const nextCurrent =
            st.currentLocationId && locations.some((l) => l.id === st.currentLocationId)
              ? st.currentLocationId
              : defaultLocationFor(st.membership, locations);
          set({ locations, currentLocationId: nextCurrent });
        });
      }
      if (!settingsUnsub) {
        settingsUnsub = onSnapshot(doc(db, `businesses/${bId}/settings/business`), (snap) => {
          set({ businessName: (snap.data()?.businessName as string) ?? null });
        });
      }
    }

    return () => {
      authUnsub();
      teardownBusinessListeners();
    };
  },

  signIn: async (email, password) => {
    set({ signingIn: true, signInError: null });
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      return true;
    } catch (err) {
      set({ signInError: friendlyAuthError(errorCode(err)) });
      return false;
    } finally {
      set({ signingIn: false });
    }
  },

  signOutUser: async () => {
    const businessId = get().businessId;
    void callable<{ businessId: string; event: 'logout' }, { ok: boolean }>('logSession')({
      businessId,
      event: 'logout',
    }).catch(() => undefined);
    await signOut(getFirebaseAuth());
    // Best-effort clear of any persistent cache on this device (SECURITY §14).
    set({ status: 'signedOut', user: null, membership: null, role: null });
  },

  setCurrentLocation: (id) => {
    const { allowedLocationIds } = get();
    if (id !== null && allowedLocationIds !== null && !allowedLocationIds.includes(id)) return;
    set({ currentLocationId: id });
  },

  hasPermission: (permission) => {
    const { status, role, membership } = get();
    if (status !== 'ready' || !role) return false;
    return can({ role, overrides: membership?.permissionOverrides ?? null }, permission);
  },
}));
