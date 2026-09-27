import { describe, it, expect } from 'vitest';
import { can, isAdminRole } from './permissions.js';

describe('permissions — BR-PRM', () => {
  it('admins and owners hold every permission', () => {
    expect(isAdminRole('owner')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(can({ role: 'owner' }, 'data.reset')).toBe(true);
    expect(can({ role: 'admin' }, 'settings.manage')).toBe(true);
  });

  it('shop gets the default set but never hard-excluded permissions', () => {
    expect(can({ role: 'shop' }, 'sales.create')).toBe(true);
    expect(can({ role: 'shop' }, 'settings.manage')).toBe(false);
    expect(can({ role: 'shop' }, 'sales.delete')).toBe(false); // admin-only delete
    expect(can({ role: 'shop' }, 'accounting.view')).toBe(false); // not in default set
  });

  it('overrides grant or deny within allowed permissions only', () => {
    expect(can({ role: 'shop', overrides: { 'accounting.view': true } }, 'accounting.view')).toBe(true);
    expect(can({ role: 'shop', overrides: { 'sales.create': false } }, 'sales.create')).toBe(false);
    // a hard exclusion cannot be granted by an override
    expect(can({ role: 'shop', overrides: { 'settings.manage': true } }, 'settings.manage')).toBe(false);
  });
});
