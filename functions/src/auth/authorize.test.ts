import { describe, it, expect } from 'vitest';
import {
  assertActiveMember,
  assertReauthFresh,
  assertStepUp,
  assertPermission,
  assertLocationAccess,
  assertCanManageTargetRole,
  assertNotSelf,
  hasPermission,
  canAccessAllLocations,
} from './authorize.js';
import { REAUTH_MAX_AGE_SECONDS, STEP_UP_MAX_AGE_SECONDS } from '../config/constants.js';
import type { Actor, MemberRecord, TokenFacts } from './types.js';

const now = 1_800_000_000;
const member = (over: Partial<MemberRecord> = {}): MemberRecord => ({
  uid: 'u1',
  businessId: 'b1',
  role: 'shop',
  active: true,
  locationIds: null,
  permissionOverrides: null,
  ...over,
});
const token = (authTime: number): TokenFacts => ({ uid: 'u1', authTimeSeconds: authTime });
const actor = (over: Partial<MemberRecord> = {}, uid = 'admin'): Actor => ({
  uid,
  businessId: 'b1',
  member: member({ uid, role: 'owner', ...over }),
  token: token(now),
});

function throwsCode(fn: () => void, code: string) {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as { details?: { code?: string } }).details?.code ?? 'ERR';
  } finally {
    void code;
  }
}

describe('authorize — active membership (§31)', () => {
  it('rejects missing and inactive members', () => {
    expect(throwsCode(() => assertActiveMember(null), 'x')).toBe('NOT_A_MEMBER');
    expect(throwsCode(() => assertActiveMember(member({ active: false })), 'x')).toBe('MEMBER_INACTIVE');
    expect(throwsCode(() => assertActiveMember(member()), 'x')).toBeNull();
  });
});

describe('authorize — reauth & step-up (§30, §33)', () => {
  it('enforces the 30-day reauth window', () => {
    expect(throwsCode(() => assertReauthFresh(token(now - REAUTH_MAX_AGE_SECONDS - 1), now), 'x')).toBe('REAUTH_REQUIRED');
    expect(throwsCode(() => assertReauthFresh(token(now - 10), now), 'x')).toBeNull();
  });
  it('enforces the 5-minute step-up window', () => {
    expect(throwsCode(() => assertStepUp(token(now - STEP_UP_MAX_AGE_SECONDS - 1), now), 'x')).toBe('STEP_UP_REQUIRED');
    expect(throwsCode(() => assertStepUp(token(now - 10), now), 'x')).toBeNull();
  });
});

describe('authorize — permissions (§15, BR-PRM)', () => {
  it('owner/admin hold everything; shop is limited', () => {
    expect(hasPermission(member({ role: 'owner' }), 'data.reset')).toBe(true);
    expect(hasPermission(member({ role: 'admin' }), 'settings.manage')).toBe(true);
    expect(hasPermission(member({ role: 'shop' }), 'sales.create')).toBe(true);
    expect(hasPermission(member({ role: 'shop' }), 'settings.manage')).toBe(false);
    expect(hasPermission(member({ role: 'shop' }), 'sales.delete')).toBe(false);
  });
  it('accountant and staff have distinct sets', () => {
    expect(hasPermission(member({ role: 'accountant' }), 'accounting.view')).toBe(true);
    expect(hasPermission(member({ role: 'accountant' }), 'sales.create')).toBe(false);
    expect(hasPermission(member({ role: 'staff' }), 'sales.create')).toBe(true);
    expect(hasPermission(member({ role: 'staff' }), 'accounting.view')).toBe(false);
  });
  it('overrides cannot grant hard-excluded permissions', () => {
    expect(throwsCode(() => assertPermission(member({ role: 'shop', permissionOverrides: { 'settings.manage': true } }), 'settings.manage'), 'x')).toBe('PERMISSION_DENIED');
    expect(throwsCode(() => assertPermission(member({ role: 'shop', permissionOverrides: { 'accounting.view': true } }), 'accounting.view'), 'x')).toBeNull();
  });
});

describe('authorize — location access (§26)', () => {
  it('unrestricted members access any location', () => {
    expect(canAccessAllLocations(member({ locationIds: null }))).toBe(true);
    expect(throwsCode(() => assertLocationAccess(member({ locationIds: null }), 'loc-x'), 'x')).toBeNull();
  });
  it('restricted members fail closed outside their locations', () => {
    const m = member({ role: 'shop', locationIds: ['loc-a'] });
    expect(throwsCode(() => assertLocationAccess(m, 'loc-a'), 'x')).toBeNull();
    expect(throwsCode(() => assertLocationAccess(m, 'loc-b'), 'x')).toBe('LOCATION_DENIED');
  });
  it('admins are never location-restricted', () => {
    expect(canAccessAllLocations(member({ role: 'admin', locationIds: ['loc-a'] }))).toBe(true);
  });
});

describe('authorize — owner protection & self-guard (§29, §30)', () => {
  it('only an owner can create/alter owner accounts', () => {
    const adminActor = actor({ role: 'admin' });
    expect(throwsCode(() => assertCanManageTargetRole(adminActor, null, 'owner'), 'x')).toBe('OWNER_PROTECTED');
    expect(throwsCode(() => assertCanManageTargetRole(adminActor, 'owner', 'admin'), 'x')).toBe('OWNER_PROTECTED');
    const ownerActor = actor({ role: 'owner' });
    expect(throwsCode(() => assertCanManageTargetRole(ownerActor, null, 'owner'), 'x')).toBeNull();
  });
  it('a member cannot modify their own membership', () => {
    const a = actor({ role: 'admin' }, 'admin');
    expect(throwsCode(() => assertNotSelf(a, 'admin'), 'x')).toBe('PERMISSION_DENIED');
    expect(throwsCode(() => assertNotSelf(a, 'someone-else'), 'x')).toBeNull();
  });
});
