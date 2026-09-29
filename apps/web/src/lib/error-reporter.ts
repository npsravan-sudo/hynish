/**
 * Error reporter abstraction (Phase 11 §47–48).
 *
 * Provides captureException / captureMessage / setUser / setBusinessContext with a no-op
 * default implementation. Wire to an actual monitoring provider (Sentry, Datadog, etc.)
 * in Phase 12 by replacing the impl below. Never send sensitive financial data — only
 * sanitized identifiers and error metadata.
 *
 * Contract:
 *  - captureException: send an error to the monitoring back-end
 *  - captureMessage: send a message-level event
 *  - setUser: attach user context (uid only, never email/name)
 *  - setBusinessContext: attach business scope (businessId only)
 *  - clear: reset user / business context (called on sign-out)
 */

export interface ErrorReporterImpl {
  captureException(error: unknown, extra?: Record<string, unknown>): void;
  captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void;
  setUser(uid: string | null): void;
  setBusinessContext(businessId: string | null): void;
  clear(): void;
}

// --- No-op implementation (replace with real monitoring in Phase 12) ----------

const noopImpl: ErrorReporterImpl = {
  captureException(error, extra) {
    if (import.meta.env.DEV) console.error('[ErrorReporter]', error, extra);
  },
  captureMessage(message, level = 'info') {
    if (import.meta.env.DEV) console.warn(`[ErrorReporter:${level}]`, message);
  },
  setUser(_uid) {},
  setBusinessContext(_businessId) {},
  clear() {},
};

// --- Public API ---------------------------------------------------------------

let _impl: ErrorReporterImpl = noopImpl;

export function configureErrorReporter(impl: ErrorReporterImpl): void {
  _impl = impl;
}

export const ErrorReporter: ErrorReporterImpl = {
  captureException: (...args) => _impl.captureException(...args),
  captureMessage: (...args) => _impl.captureMessage(...args),
  setUser: (...args) => _impl.setUser(...args),
  setBusinessContext: (...args) => _impl.setBusinessContext(...args),
  clear: () => _impl.clear(),
};
