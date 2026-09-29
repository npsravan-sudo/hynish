# Phase 11 Completion Report — PWA, Offline Strategy, Performance & Production Hardening

**Date:** 2026-09-29  
**Branch:** `claude/hynish-erp-phase-0-1nkqbb`  
**Spec ref:** PWA-ARCHITECTURE.md, Phase 11 prompt

---

## Summary

Phase 11 hardens the web application for production: Progressive Web App installability, explicit service-worker routing, network status awareness, user-controlled update flow, per-feature error isolation, an ErrorReporter abstraction, CSP security headers, and chunk-load resilience. No offline financial or accounting operations were implemented (see §Offline Boundary below).

---

## Deliverables

### 1. Web App Manifest (`apps/web/public/manifest.webmanifest`)

- `display: "standalone"` with `display_override: ["window-controls-overlay", "standalone"]`
- `background_color: "#0F1626"`, `theme_color: "#172033"` (brand navy)
- Icons: 192×192 and 512×512 `any`, 192×192 and 512×512 `maskable`, SVG `any`
- Shortcuts for New Bill and New Purchase (spec §2.4)

### 2. PNG Icons (`apps/web/public/icons/`)

Generated via `apps/web/scripts/generate-icons.mjs` — pure Node.js PNG encoder using built-in `node:zlib`. No external image deps required.

| File | Size | Purpose |
|---|---|---|
| `icon-192.png` | 192×192 | `any` launcher icon |
| `icon-512.png` | 512×512 | `any` launcher icon / splash |
| `maskable-192.png` | 192×192 | `maskable` (safe-zone gradient) |
| `maskable-512.png` | 512×512 | `maskable` (safe-zone gradient) |
| `apple-touch-icon.png` | 180×180 | iOS homescreen |

### 3. Service Worker (`apps/web/src/sw.ts`)

Follows PWA-ARCHITECTURE.md §4.2 routing rules **exactly**:

| Rule | Behavior |
|---|---|
| 1. Cross-origin requests | NOT intercepted — no route registered, browser handles natively |
| 2. Same-origin non-GET | NOT intercepted |
| 3. Same-origin `/__/` paths | Denied via `NavigationRoute denylist` — Firebase Hosting reserved |
| 4. Same-origin navigations | NetworkFirst (3 s timeout) → precached `index.html` |
| 5. Precached static assets | CacheFirst (handled by `precacheAndRoute`) |
| 6. Other same-origin GETs | No route → fall through to network, fail honestly |

**Firebase SDK traffic** (Firestore, Auth, Storage, Functions) is 100% cross-origin (`*.googleapis.com`, `*.firebaseio.com`) and is never intercepted.

**Update lifecycle:** `SKIP_WAITING` postMessage only — never auto-skip. The new SW waits until the user explicitly chooses to refresh via `AppUpdatePrompt`.

### 4. Vite PWA Plugin (`apps/web/vite.config.ts`)

- `vite-plugin-pwa` v1.x, `strategies: 'injectManifest'` — every routing rule is explicit in source
- `registerType: 'prompt'` — user-controlled, never automatic
- `devOptions.enabled: false` — SW not active in dev
- `manifest: false` — manifest managed manually in `public/`
- Precache: 120 entries, ~2.1 MB (JS, CSS, woff2, PNG, SVG, ico)

### 5. Network Status (`apps/web/src/hooks/use-network-status.ts` + `apps/web/src/components/pwa/network-status-indicator.tsx`)

- `useNetworkStatus()` — initialized from `navigator.onLine`, updated via `online`/`offline` events
- `NetworkStatusIndicator` — amber banner below topbar, `role="status" aria-live="polite"`, non-blocking
- Uses design-token colors: `bg-warning/15`, `border-warning/30`, `text-warning`

### 6. App Update Prompt (`apps/web/src/components/pwa/app-update-prompt.tsx`)

- Uses `workbox-window` `Workbox` class to detect a waiting SW
- Persistent toast: "Refresh now" → `wb.messageSkipWaiting()` + `controllerchange` → `window.location.reload()`
- "Later" dismisses toast; user can continue current work
- `visibilitychange` triggers `wb.update()` to re-check on tab focus
- `useRef(false)` guard prevents React StrictMode double-registration
- No-op in `import.meta.env.DEV`

### 7. FeatureErrorBoundary (`apps/web/src/app/feature-error-boundary.tsx`)

- Class component; wraps `<Outlet>` in `AppShell` via `<FeatureErrorBoundary name="Page">`
- Shows "This section couldn't load" with **Try again** and **Go to Dashboard** actions
- Stack traces suppressed in production
- Calls `ErrorReporter.captureException()` — wired to no-op now, real impl in Phase 12

### 8. ErrorReporter abstraction (`apps/web/src/lib/error-reporter.ts`)

```typescript
interface ErrorReporterImpl {
  captureException(error, extra?): void
  captureMessage(message, level?): void
  setUser(uid): void
  setBusinessContext(businessId): void
  clear(): void
}
```

- Default: no-op implementation (logs to console in DEV)
- `configureErrorReporter(impl)` — called in Phase 12 to wire real monitoring
- **Never logs**: passwords, tokens, bank details, GST data, full invoices/customers/journals

### 9. Chunk Load Failure Handler (`apps/web/src/main.tsx`)

- Watches `error` events on `<script>` elements with `/assets/*.js` src
- First failure: `sessionStorage` flag + `window.location.reload()`
- Second failure: shows overlay "new version available" with Refresh button — prevents infinite loop
- Catches stale chunk references after a new deployment

### 10. Global Unhandled Rejection Handler (`apps/web/src/main.tsx`)

- `window.addEventListener('unhandledrejection', ...)` — captures async errors that escape boundaries
- DEV: `console.error`; production: TODO Phase 12 `ErrorReporter.captureException`

### 11. Security Headers (`firebase.json`)

New headers applied to all routes (`source: "**"`):

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' *.googleapis.com *.firebaseapp.com *.firebaseio.com wss://*.firebaseio.com identitytoolkit.googleapis.com securetoken.googleapis.com; worker-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none';` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

Cache headers for PWA assets:

| Path | Cache-Control |
|---|---|
| `/index.html` | `no-cache, no-store, must-revalidate` |
| `/sw.js` | `no-cache, no-store, must-revalidate` |
| `/manifest.webmanifest` | `no-cache, must-revalidate` |
| `**/*.@(js\|css\|woff2)` | `public, max-age=31536000, immutable` |
| `/icons/**` | `public, max-age=86400` |

### 12. index.html additions

- `<link rel="manifest" href="/manifest.webmanifest" />`
- `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`
- Anti-FOUC inline script already present — preserved unchanged

---

## Offline Boundary

Per Phase 11 specification §17, the following operations **require server connectivity** and are **not available offline**:

- Document numbering (invoice/purchase/etc.) — server-authoritative
- Inventory stock mutations — Firestore transactions
- Payments and accounting journal entries — server-authoritative
- GST calculations and totals — server-authoritative

The SW only caches the **app shell** (HTML, JS, CSS, fonts, icons). Business data is never cached in the SW HTTP cache. Firebase SDK manages its own persistence layer independently (OQ-04 — not wired in Phase 11).

---

## Known Limitations / Phase 12 Follow-ups

| Item | Note |
|---|---|
| CSP `'unsafe-inline'` for scripts | Required for anti-FOUC inline script in `index.html`. Full hardening via SHA-256 hash deferred to Phase 12. |
| `ErrorReporter` no-op impl | Wired to console.error in DEV. Real monitoring (Sentry / Cloud Logging) configured in Phase 12. |
| `unhandledrejection` handler | Captures but does not report in production — Phase 12 wires `ErrorReporter.captureException`. |

---

## Build Verification

```
vite-plugin-pwa v1.3.0
mode      injectManifest
format:   es
precache  120 entries (2165.09 KiB)
files generated
  dist/sw.js
✓ built in 9.90s
```

TypeScript: 0 errors (`tsc -b`).

---

## LEGACY COMPATIBILITY CHECK

- **Existing defaults preserved:** DEF-016 (New Bill opens Without GST) — unaffected. No billing defaults changed.
- **Existing settings preserved:** All Phase 10 settings (business profile, document numbering, bank details, theme) — unaffected.
- **Existing validations preserved:** All server-side Zod schemas and Firestore rules — unaffected.
- **Existing calculations preserved:** All BR-* financial calculations in `packages/domain` — unaffected.
- **Existing workflows preserved:** Billing, purchase, inventory, accounting, reporting workflows — unaffected.
- **Existing permissions preserved:** All `assertPermission()` gates in Cloud Functions — unaffected.
- **Existing document behavior preserved:** Invoice numbering, GST series separation (BR-NUM-01) — unaffected.
- **Existing reports preserved:** All Phase 9 report pages — unaffected.
- **Existing user-visible behavior preserved:** All existing navigation, forms, and data flows — unaffected. SW only adds PWA layer on top.
- **Deviations:** None. Phase 11 adds PWA capability without changing any existing business logic.
- **NOT VERIFIED items touched:** None.
