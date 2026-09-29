import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { isFirebaseConfigured } from '@/config/env';
import '@/styles/globals.css';

if (import.meta.env.DEV && !isFirebaseConfigured) {
  console.warn(
    '[Hynish] Firebase is not configured. Copy apps/web/.env.example to .env.local before Phase 2.',
  );
}

// --- Global unhandled rejection handler (Phase 11 §46) -----------------------
// Catches async errors that escape component/hook boundaries.
// Does NOT suppress errors — just ensures they're captured before Phase 12 wires ErrorReporter.
window.addEventListener('unhandledrejection', (event) => {
  if (import.meta.env.DEV) {
    console.error('[Hynish] Unhandled promise rejection:', event.reason);
  }
  // TODO Phase 12: ErrorReporter.captureException(event.reason)
});

// --- Chunk load failure detection (Phase 11 §83) -----------------------------
// When a dynamic import fails (usually because a new deployment replaced the hashed chunk),
// the error is a TypeError/SyntaxError with a URL in the message.
// We prompt the user to reload rather than showing a blank screen.
window.addEventListener('error', (event) => {
  const src = (event.target as HTMLScriptElement | null)?.src ?? '';
  const isChunkLoad = src.includes('/assets/') && src.endsWith('.js');
  if (isChunkLoad) {
    // Avoid an infinite reload loop: flag that we already tried.
    const key = 'hynish:chunkReloadAttempt';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      window.location.reload();
    } else {
      // Second failure — show a message instead of looping.
      sessionStorage.removeItem(key);
      const div = document.createElement('div');
      div.style.cssText =
        'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0F1626;color:#fff;font-family:system-ui;z-index:9999;text-align:center;padding:2rem;';
      div.innerHTML =
        '<div><p style="font-size:1.1rem;font-weight:600;margin-bottom:.5rem">A new version of the app is available.</p><p style="margin-bottom:1.5rem;opacity:.7">Please refresh to continue.</p><button onclick="sessionStorage.clear();location.reload()" style="background:#5B73FA;color:#fff;border:0;border-radius:.5rem;padding:.6rem 1.5rem;cursor:pointer;font-size:1rem">Refresh</button></div>';
      document.body.appendChild(div);
    }
  }
}, true);

// --- Render -------------------------------------------------------------------
const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
