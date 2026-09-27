import { useEffect, type ReactNode } from 'react';
import { useThemeStore } from '@/stores/theme-store';

/**
 * Wires the OS colour-scheme listener so `system` mode updates live (UI-UX §3.4).
 * The initial theme is already applied by the inline script in index.html (no FOUC) and by
 * the theme store's initial state, so this only manages the live subscription.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const initSystemListener = useThemeStore((s) => s.initSystemListener);
  useEffect(() => initSystemListener(), [initSystemListener]);
  return <>{children}</>;
}
