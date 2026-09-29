import { RouterProvider } from 'react-router-dom';
import { AppErrorBoundary } from './error-boundary';
import { AppProviders } from './providers';
import { router } from './router';
import { AppUpdatePrompt } from '@/components/pwa/app-update-prompt';

export function App() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        {/* SW update detection — no-op in dev, shows update toast in production */}
        <AppUpdatePrompt />
        <RouterProvider router={router} />
      </AppProviders>
    </AppErrorBoundary>
  );
}
