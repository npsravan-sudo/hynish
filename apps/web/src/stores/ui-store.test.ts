import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './ui-store';

describe('ui-store (navigation chrome state)', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false, expandedGroups: {}, mobileDrawerOpen: false });
  });

  it('toggles the sidebar collapse', () => {
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });

  it('toggles a sidebar group', () => {
    useUiStore.getState().toggleGroup('sales');
    expect(useUiStore.getState().expandedGroups.sales).toBe(true);
    useUiStore.getState().toggleGroup('sales');
    expect(useUiStore.getState().expandedGroups.sales).toBe(false);
  });

  it('controls the mobile drawer', () => {
    useUiStore.getState().setMobileDrawerOpen(true);
    expect(useUiStore.getState().mobileDrawerOpen).toBe(true);
  });
});
