/**
 * UI/navigation chrome state (Phase 1 §38). Non-critical, per-device preferences only —
 * never business data (Phase 1 §11). Sidebar collapse and expanded groups persist to
 * localStorage; transient overlay state does not.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UiState {
  /** Desktop sidebar collapsed to an icon rail. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /** Expanded sidebar groups (persisted). */
  expandedGroups: Record<string, boolean>;
  toggleGroup: (id: string) => void;

  /** Transient overlays (not persisted). */
  mobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      expandedGroups: {},
      toggleGroup: (id) =>
        set((s) => ({ expandedGroups: { ...s.expandedGroups, [id]: !s.expandedGroups[id] } })),

      mobileDrawerOpen: false,
      setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: 'hynish:ui',
      storage: createJSONStorage(() => localStorage),
      // Persist only durable preferences, never transient overlay flags.
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        expandedGroups: s.expandedGroups,
      }),
    },
  ),
);
