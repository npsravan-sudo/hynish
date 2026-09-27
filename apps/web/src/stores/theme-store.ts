/**
 * Centralized theme state (Phase 1 §17–§18, UI-UX §3.4). Single source of truth for
 * Light / Dark / System. Persists the preference per device; Phase 2 will also mirror it
 * to the user profile. Applies the resolved theme to <html> and updates <meta theme-color>.
 */
import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'hynish:theme';

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage blocked */
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

function apply(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.classList.toggle('dark', resolved === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0F1626' : '#ffffff');
}

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  /** Wire the OS-preference listener; returns an unsubscribe. Called once by ThemeProvider. */
  initSystemListener: () => () => void;
}

const initialMode = readStoredMode();

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  resolved: resolve(initialMode),
  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* storage blocked */
    }
    const resolved = resolve(mode);
    apply(resolved);
    set({ mode, resolved });
  },
  initSystemListener: () => {
    if (typeof window === 'undefined') return () => {};
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (get().mode !== 'system') return;
      const resolved = systemPrefersDark() ? 'dark' : 'light';
      apply(resolved);
      set({ resolved });
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  },
}));
