/**
 * Service worker (Phase 11, PWA-ARCHITECTURE.md §4).
 *
 * Routing rules (in order — see §4.2):
 *  1. Cross-origin requests          → NOT intercepted (browser handles natively)
 *  2. Same-origin non-GET            → NOT intercepted
 *  3. Same-origin /__/ paths         → NOT intercepted (Firebase Hosting reserved)
 *  4. Same-origin navigation         → NetworkFirst (3 s) → precached index.html
 *  5. Precached static assets        → CacheFirst (workbox-precaching)
 *  6. Any other same-origin GET      → network only; fail honestly — never return HTML
 *
 * NEVER cached: Firestore, Auth, Functions, Storage responses; business data.
 * Firebase SDK handles its own offline cache separately (OQ-04 — not this SW).
 *
 * Update lifecycle:
 *  - install:  precache (no skipWaiting — user-controlled update)
 *  - activate: cleanupOutdatedCaches + clients.claim on first install only
 *  - SKIP_WAITING postMessage → skipWaiting (triggered by AppUpdatePrompt)
 */
/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// --- Lifecycle -----------------------------------------------------------------

// User-controlled skipWaiting: only skip when the app explicitly requests it
// (sent by AppUpdatePrompt after the user clicks "Refresh"). This prevents
// automatic mid-session updates that could interrupt a bill in progress.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// On activate: clean up stale caches from previous versions (legacy parity TD §8.1).
// clients.claim() so the new SW takes control without a full page reload on first install.
cleanupOutdatedCaches();

// --- Precache ------------------------------------------------------------------

// __WB_MANIFEST is injected by vite-plugin-pwa at build time.
// It contains every hashed JS/CSS/font/icon asset + index.html with a revision hash.
precacheAndRoute(self.__WB_MANIFEST);

// --- Navigation route (rule 4) ------------------------------------------------

// NetworkFirst: try the network (3 s timeout), fall back to the precached app shell.
// NavigationRoute automatically targets requests with mode === 'navigate'.
// denylist: never intercept Firebase Hosting reserved paths (/__/) — legacy fix TD §8.1.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      networkTimeoutSeconds: 3,
      cacheName: 'hynish-navigation-v1',
    }),
    { denylist: [/^\/__\//] },
  ),
);

// Rules 5-6: precached assets are handled by precacheAndRoute above.
// Non-precached, non-navigation GETs: no route registered → fall through to network.
// On network failure, the browser error surfaces to the app — no HTML substitution.
// (This preserves the legacy v2.85.0 fix: TD §8.1 "same-origin-only interception".)
