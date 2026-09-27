import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { isFirebaseConfigured } from '@/config/env';
import '@/styles/globals.css';

if (import.meta.env.DEV && !isFirebaseConfigured) {
  // Non-blocking in Phase 1 (auth is wired in Phase 2). getFirebaseConfig() throws a clear,
  // actionable error if a Firebase service is requested before .env.local is filled in.
  console.warn(
    '[Hynish] Firebase is not configured. Copy apps/web/.env.example to .env.local before Phase 2.',
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
