import { Bell, Menu, Search } from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from './breadcrumbs';
import { ThemeSwitcher } from './theme-switcher';
import { LocationSelector } from './location-selector';
import { UserMenu } from './user-menu';
import { BrandMark } from './brand';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

export function Topbar() {
  const setDrawerOpen = useUiStore((s) => s.setMobileDrawerOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandPaletteOpen);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur pt-safe sm:px-4 lg:px-6">
      {/* Mobile: menu + brand */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={() => setDrawerOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <div className="lg:hidden">
        <BrandMark collapsed />
      </div>

      {/* Desktop: breadcrumbs */}
      <div className="hidden lg:block">
        <Breadcrumbs />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {/* Desktop global search trigger */}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="hidden h-10 w-56 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 md:flex"
          aria-label="Open global search"
        >
          <Search className="size-4" />
          <span>Search…</span>
          <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium lg:inline-block">
            ⌘K
          </kbd>
        </button>

        {/* Mobile search icon */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Search"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="size-5" />
        </Button>

        <div className="hidden sm:block">
          <LocationSelector className="w-44" />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="size-5" />
              <Badge
                variant="danger"
                className="absolute -right-0.5 -top-0.5 size-4 justify-center rounded-full p-0 text-[10px]"
                aria-hidden
              >
                0
              </Badge>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <ThemeSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
