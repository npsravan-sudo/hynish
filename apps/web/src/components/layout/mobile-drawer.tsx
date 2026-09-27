import { useUiStore } from '@/stores/ui-store';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SidebarNav } from './sidebar-nav';
import { BrandMark } from './brand';
import { appConfig } from '@/config/env';

/** Mobile navigation drawer (Phase 1 §9, §14: opened by the menu button and "More"). */
export function MobileDrawer() {
  const open = useUiStore((s) => s.mobileDrawerOpen);
  const setOpen = useUiStore((s) => s.setMobileDrawerOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="flex w-[86vw] max-w-xs flex-col p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <BrandMark />
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t border-border p-4 text-xs text-muted-foreground pb-safe">
          v{appConfig.version}
        </div>
      </SheetContent>
    </Sheet>
  );
}
