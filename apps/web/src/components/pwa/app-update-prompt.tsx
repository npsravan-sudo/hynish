/**
 * Service worker update prompt (Phase 11, PWA-ARCHITECTURE §6, §13).
 *
 * When a new SW is installed and waiting, we show a persistent but dismissible toast.
 * NEVER reload automatically — that would interrupt an invoice or payment entry.
 * The user chooses "Refresh now" or "Later".
 *
 * Uses workbox-window to detect the waiting state.
 */
import { useEffect, useRef } from 'react';
import { Workbox } from 'workbox-window';
import { toast } from '@/components/ui/sonner';

export function AppUpdatePrompt() {
  // Only register once — StrictMode double-invokes effects in dev, ref guards it.
  const registered = useRef(false);

  useEffect(() => {
    // No service worker support or running in dev (SW disabled).
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    if (registered.current) return;
    registered.current = true;

    const wb = new Workbox('/sw.js');

    const showUpdateToast = () => {
      // Dismiss any previous update toast so we don't stack them.
      toast.dismiss('pwa-update');

      toast('A new version is available', {
        id: 'pwa-update',
        duration: Infinity,
        description: 'Refresh to update the app.',
        action: {
          label: 'Refresh now',
          onClick: () => {
            // Signal the waiting SW to skip waiting, then reload once it activates.
            wb.messageSkipWaiting();
            wb.addEventListener('controlling', () => {
              window.location.reload();
            });
          },
        },
        cancel: {
          label: 'Later',
          onClick: () => toast.dismiss('pwa-update'),
        },
      });
    };

    // Fired when a new SW is installed but waiting.
    wb.addEventListener('waiting', showUpdateToast);

    // Also re-surface the toast if the user returns to the tab and a SW is still waiting.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        wb.update().catch(() => {
          // update() fails if SW hasn't registered yet — ignore silently.
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    wb.register().catch((err) => {
      // SW registration failure is non-fatal — app continues as a standard web app.
      if (import.meta.env.DEV) console.warn('[PWA] SW registration failed:', err);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // This component renders nothing — it is a side-effect-only mount.
  return null;
}
