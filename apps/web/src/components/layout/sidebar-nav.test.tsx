import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarNav } from './sidebar-nav';
import { useSessionStore } from '@/stores/session-store';

function renderNav() {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <SidebarNav />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

const ownerState = useSessionStore.getState();

afterEach(() => {
  useSessionStore.setState({ role: ownerState.role });
});

describe('SidebarNav permission filtering', () => {
  it('shows admin-only items for an owner', () => {
    useSessionStore.setState({ role: 'owner' });
    renderNav();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('New Invoice')).toBeInTheDocument();
    expect(screen.getByText('Chart of Accounts')).toBeInTheDocument();
  });

  it('hides admin-only and accounting items for a shop role', () => {
    useSessionStore.setState({ role: 'shop' });
    renderNav();
    // Default shop permissions include billing/stock…
    expect(screen.getByText('New Invoice')).toBeInTheDocument();
    // …but never Settings, or Accounting/Cash Book/Expenses/GST (BR-PRM-03/04).
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Chart of Accounts')).not.toBeInTheDocument();
    expect(screen.queryByText('GST Filing')).not.toBeInTheDocument();
  });
});
