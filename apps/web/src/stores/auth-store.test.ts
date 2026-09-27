import { describe, it, expect } from 'vitest';
import { resolveAuthStatus, defaultLocationFor, type Membership, type SessionLocation } from './auth-store';

const activeMember: Membership = {
  uid: 'u',
  role: 'shop',
  active: true,
  locationIds: null,
  permissionOverrides: null,
  displayName: 'A',
  email: 'a@x.com',
};

describe('resolveAuthStatus (§11, §44)', () => {
  it('reports configError when Firebase is not configured', () => {
    expect(resolveAuthStatus({ configured: false, hasUser: false, membershipLoaded: false, membership: null })).toBe('configError');
  });
  it('reports signedOut with no user', () => {
    expect(resolveAuthStatus({ configured: true, hasUser: false, membershipLoaded: false, membership: null })).toBe('signedOut');
  });
  it('stays loading until membership resolves', () => {
    expect(resolveAuthStatus({ configured: true, hasUser: true, membershipLoaded: false, membership: null })).toBe('loading');
  });
  it('reports unauthorized when there is no membership', () => {
    expect(resolveAuthStatus({ configured: true, hasUser: true, membershipLoaded: true, membership: null })).toBe('unauthorized');
  });
  it('reports inactive for a deactivated member', () => {
    expect(resolveAuthStatus({ configured: true, hasUser: true, membershipLoaded: true, membership: { ...activeMember, active: false } })).toBe('inactive');
  });
  it('reports ready for an active member', () => {
    expect(resolveAuthStatus({ configured: true, hasUser: true, membershipLoaded: true, membership: activeMember })).toBe('ready');
  });
});

describe('defaultLocationFor (§46)', () => {
  const locs: SessionLocation[] = [
    { id: 'loc-a', name: 'A', type: 'shop' },
    { id: 'loc-b', name: 'B', type: 'shop' },
  ];
  it('returns null (all locations) for an unrestricted member', () => {
    expect(defaultLocationFor({ ...activeMember, locationIds: null }, locs)).toBeNull();
  });
  it('returns the first allowed location for a restricted member', () => {
    expect(defaultLocationFor({ ...activeMember, locationIds: ['loc-b'] }, locs)).toBe('loc-b');
  });
});
