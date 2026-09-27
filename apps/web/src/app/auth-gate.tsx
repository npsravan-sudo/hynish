import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { LoginPage } from '@/features/auth/login-page';
import {
  AuthLoadingScreen,
  UnauthorizedScreen,
  InactiveScreen,
  ConfigErrorScreen,
} from '@/features/auth/auth-status-screens';

/**
 * Root auth gate (Phase 2 §44, §48). Initializes the auth store once and renders the screen
 * that matches the resolved status. Authenticated content (the shell + routed pages) renders
 * ONLY when status is 'ready', so protected data never appears before authorization is known.
 */
export function AuthGate() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    const unsub = useAuthStore.getState().init();
    return unsub;
  }, []);

  switch (status) {
    case 'loading':
      return <AuthLoadingScreen />;
    case 'configError':
      return <ConfigErrorScreen />;
    case 'signedOut':
      return <LoginPage />;
    case 'unauthorized':
      return <UnauthorizedScreen />;
    case 'inactive':
      return <InactiveScreen />;
    case 'ready':
      return <Outlet />;
    default:
      return <AuthLoadingScreen />;
  }
}
