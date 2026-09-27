import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Role } from '@hynish/domain';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarNav } from './sidebar-nav';
import { useAuthStore } from '@/stores/auth-store';

function renderNav() {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <SidebarNav />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

/** Put the auth store into a 'ready' state with the given role so hasPermission resolves. */
function setRole(role: Role) {
  useAuthStore.setState({
    status: 'ready',
    role,
    membership: {
      uid: 'u',
      role,
      active: true,
      locationIds: null,
      permissionOverrides: null,
      displayName: 'Test',
      email: 't@example.com',
    },
  });
}

afterEach(() => {
  useAuthStore.setState({ status: 'loading', role: null, membership: null });
});

describe('SidebarNav permission filtering', () => {
  it('shows admin-only items for an owner', () => {
    setRole('owner');
    renderNav();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('New Invoice')).toBeInTheDocument();
    expect(screen.getByText('Chart of Accounts')).toBeInTheDocument();
  });

  it('hides admin-only and accounting items for a shop role', () => {
    setRole('shop');
    renderNav();
    expect(screen.getByText('New Invoice')).toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Chart of Accounts')).not.toBeInTheDocument();
    expect(screen.queryByText('GST Filing')).not.toBeInTheDocument();
  });

  it('gives accountant the books but not billing creation', () => {
    setRole('accountant');
    renderNav();
    expect(screen.getByText('Chart of Accounts')).toBeInTheDocument();
    expect(screen.queryByText('New Invoice')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });
});
