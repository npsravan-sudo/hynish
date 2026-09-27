import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { MobileDrawer } from './mobile-drawer';
import { MobileBottomNav } from './mobile-bottom-nav';
import { CommandPalette } from './command-palette';
import { LocationSelector } from './location-selector';

/**
 * Application shell (Phase 1 §9). Reusable across every screen: desktop sidebar + topbar,
 * mobile drawer + bottom navigation, and the command palette. The routed page renders in
 * <Outlet />. A skip link and a labelled <main> support keyboard and screen-reader users.
 */
export function AppShell() {
  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        {/* Location selector on very small screens sits below the topbar for reachability. */}
        <div className="border-b border-border bg-background px-3 py-2 sm:hidden">
          <LocationSelector className="w-full" />
        </div>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:pb-8"
        >
          <div className="mx-auto w-full max-w-[1600px]">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <MobileDrawer />
      <MobileBottomNav />
      <CommandPalette />
    </div>
  );
}
