/**
 * Non-blocking offline banner (Phase 11, PWA-ARCHITECTURE §15).
 *
 * Shows a subtle banner when navigator.onLine is false. Never disables the whole app —
 * the user can still navigate cached screens and read already-loaded data.
 */
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/use-network-status';

export function NetworkStatusIndicator() {
  const status = useNetworkStatus();
  if (status === 'online') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 bg-warning/15 border-b border-warning/30 px-4 py-2 text-sm text-warning"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span>
        You&apos;re offline. Some features may be unavailable until the connection returns.
      </span>
    </div>
  );
}
