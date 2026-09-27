import type { Role, Permission } from '@hynish/domain';

/** Server-side membership record (subset of DATA-MODEL §6.3 needed for authorization). */
export interface MemberRecord {
  uid: string;
  businessId: string;
  role: Role;
  active: boolean;
  /** null = unrestricted (all locations); otherwise the allowed location ids. */
  locationIds: string[] | null;
  permissionOverrides?: Partial<Record<Permission, boolean>> | null;
  email?: string;
  displayName?: string | null;
}

/** Decoded token facts we trust (set by Firebase Auth, not the client payload). */
export interface TokenFacts {
  uid: string;
  authTimeSeconds: number;
  email?: string | undefined;
}

/** Fully-resolved, trusted actor for a business operation. */
export interface Actor {
  uid: string;
  businessId: string;
  member: MemberRecord;
  token: TokenFacts;
}
