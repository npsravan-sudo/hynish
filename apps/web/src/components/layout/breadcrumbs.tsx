import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { NAV_GROUPS, ALL_NAV_ITEMS } from '@/config/nav';

interface Crumb {
  label: string;
  to?: string;
}

/** Derive breadcrumbs from the current path using the nav config. */
export function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const item = ALL_NAV_ITEMS.find((i) => i.to === pathname);
  const group = NAV_GROUPS.find((g) => g.items.some((i) => i.to === pathname));

  const crumbs: Crumb[] = [{ label: 'Home', to: '/dashboard' }];
  if (group && group.id !== 'overview') crumbs.push({ label: group.label });
  if (item && item.to !== '/dashboard') crumbs.push({ label: item.label });
  else if (!item && pathname !== '/dashboard') {
    const tail = pathname.split('/').filter(Boolean).at(-1) ?? '';
    if (tail) crumbs.push({ label: tail.replace(/-/g, ' ') });
  }
  return crumbs;
}

export function Breadcrumbs() {
  const crumbs = useBreadcrumbs();
  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 opacity-60" />}
            {i === 0 && <Home className="size-3.5" />}
            {c.to && !isLast ? (
              <Link to={c.to} className="capitalize transition-colors hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium capitalize text-foreground' : 'capitalize'}>
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
