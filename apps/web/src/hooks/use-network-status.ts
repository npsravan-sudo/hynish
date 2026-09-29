/**
 * Network status hook (Phase 11, PWA-ARCHITECTURE §14–16).
 *
 * navigator.onLine is the initial signal. It can lie (false positives on captive portals),
 * so treat it as "probably online / probably offline" rather than guaranteed connectivity.
 * We do NOT attempt pings — that adds latency and complexity. The Firebase SDK surfacing errors
 * is the real proof of lost connectivity for data operations.
 */
import { useEffect, useState } from 'react';

export type NetworkStatus = 'online' | 'offline';

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online',
  );

  useEffect(() => {
    const handleOnline = () => setStatus('online');
    const handleOffline = () => setStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
