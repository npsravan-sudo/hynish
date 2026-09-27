import { NavLink } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_GROUPS } from '@/config/nav';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface SidebarNavProps {
  collapsed?: boolean | undefined;
  onNavigate?: (() => void) | undefined;
}

/** Permission-filtered nav shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const expandedGroups = useUiStore((s) => s.expandedGroups);
  const toggleGroup = useUiStore((s) => s.toggleGroup);

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => hasPermission(i.permission)),
  })).filter((g) => g.items.length > 0);

  return (
    <nav className="flex flex-col gap-1 px-2 py-2" aria-label="Primary">
      {groups.map((group) => {
        const single = group.items.length === 1 && group.items[0]?.end;

        // Single-item groups (Dashboard, Customers, Payroll, Reports) render as a flat link.
        if (single) {
          const item = group.items[0]!;
          return (
            <NavItemLink key={group.id} to={item.to} collapsed={collapsed} onNavigate={onNavigate} label={item.label}>
              <item.icon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavItemLink>
          );
        }

        // Collapsed rail: show items directly (no group accordion) with tooltips.
        if (collapsed) {
          return (
            <div key={group.id} className="flex flex-col gap-1 py-1">
              {group.items.map((item) => (
                <NavItemLink key={item.to} to={item.to} collapsed onNavigate={onNavigate} label={item.label}>
                  <item.icon className="size-[18px] shrink-0" />
                </NavItemLink>
              ))}
            </div>
          );
        }

        const isOpen = expandedGroups[group.id] ?? true;
        return (
          <div key={group.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={isOpen}
              className="mt-2 flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{group.label}</span>
              <ChevronDown className={cn('size-4 transition-transform', !isOpen && '-rotate-90')} />
            </button>
            {isOpen && (
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavItemLink key={item.to} to={item.to} onNavigate={onNavigate} label={item.label}>
                    <item.icon className="size-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavItemLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function NavItemLink({
  to,
  collapsed,
  onNavigate,
  label,
  children,
}: {
  to: string;
  collapsed?: boolean | undefined;
  onNavigate?: (() => void) | undefined;
  label: string;
  children: React.ReactNode;
}) {
  const link = (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground',
        )
      }
    >
      {children}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return link;
}
