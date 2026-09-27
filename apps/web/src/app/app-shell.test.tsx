import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { AppProviders } from './providers';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Integration smoke test: with an authorized (ready) session, the shell mounts, providers wire
 * up, and a routed page renders without throwing.
 */
function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ path: '/', element: <AppShell />, children: [{ path: 'dashboard', element: <DashboardPage /> }] }],
    { initialEntries: [path] },
  );
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

beforeEach(() => {
  useAuthStore.setState({
    status: 'ready',
    role: 'owner',
    membership: {
      uid: 'u',
      role: 'owner',
      active: true,
      locationIds: null,
      permissionOverrides: null,
      displayName: 'Owner',
      email: 'o@example.com',
    },
    user: { uid: 'u', email: 'o@example.com', displayName: 'Owner' },
    businessName: 'Hynish Clothing',
    locations: [{ id: 'loc-a', name: 'Main Shop', type: 'shop' }],
    currentLocationId: null,
    allowedLocationIds: null,
  });
});

describe('AppShell integration', () => {
  it('renders the shell chrome and the routed dashboard page', async () => {
    renderAt('/dashboard');
    expect(await screen.findAllByText('Hynish ERP')).not.toHaveLength(0);
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getByText('Quick actions')).toBeInTheDocument();
  });
});
