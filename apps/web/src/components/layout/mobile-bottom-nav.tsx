import { NavLink } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOTTOM_NAV } from '@/config/nav';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';

/**
 * Mobile bottom navigation (Phase 1 §14). Primary destinations plus a raised centre
 * "New Bill" action and a "More" button that opens the full drawer. Safe-area aware.
 */
export function MobileBottomNav() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const setDrawerOpen = useUiStore((s) => s.setMobileDrawerOpen);

  const items = BOTTOM_NAV.filter((i) => hasPermission(i.permission));
  const canSell = hasPermission('sales.create');

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-safe lg:hidden"
      aria-label="Primary mobile"
    >
      <div className="grid h-16 grid-cols-5 items-center">
        {items.slice(0, 2).map((item) => (
          <BottomLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
        ))}

        <div className="flex items-center justify-center">
          {canSell ? (
            <NavLink
              to="/sales/new"
              aria-label="New Bill"
              className="flex size-14 -translate-y-3 items-center justify-center rounded-2xl bg-gradient-sales text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-6" />
            </NavLink>
          ) : (
            <span className="size-14" />
          )}
        </div>

        {items.slice(2, 4).map((item) => (
          <BottomLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
        ))}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="size-5" />
          <span className="text-[11px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}

function BottomLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof Menu;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex h-full flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )
      }
    >
      <Icon className="size-5" />
      <span className="text-[11px] font-medium">{label}</span>
    </NavLink>
  );
}
