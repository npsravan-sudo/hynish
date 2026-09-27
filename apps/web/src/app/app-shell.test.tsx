import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { AppProviders } from './providers';
import { DashboardPage } from '@/features/dashboard/dashboard-page';

/**
 * Integration smoke test: the shell mounts, providers wire up, and a routed page renders
 * without throwing. Guards against broken imports/context in the shell composition.
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

describe('AppShell integration', () => {
  it('renders the shell chrome and the routed dashboard page', async () => {
    renderAt('/dashboard');
    // Brand appears in the shell.
    expect(await screen.findAllByText('Hynish ERP')).not.toHaveLength(0);
    // Primary navigation is present (permission-filtered for the placeholder owner).
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    // The routed page rendered its quick actions section.
    expect(screen.getByText('Quick actions')).toBeInTheDocument();
  });
});
