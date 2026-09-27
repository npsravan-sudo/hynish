import { LogOut, User, Settings as SettingsIcon, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSessionStore } from '@/stores/session-store';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UserMenu() {
  const { user, businessName, isPlaceholder, hasPermission } = useSessionStore();
  const name = user?.displayName ?? 'User';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar>
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{businessName}</span>
          </div>
        </DropdownMenuLabel>
        {isPlaceholder && (
          <div className="px-2.5 pb-2 pt-1">
            <Badge variant="warning" className="gap-1">
              <ShieldAlert className="size-3" />
              Preview — sign-in wired in Phase 2
            </Badge>
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/dashboard">
            <User /> Profile
          </Link>
        </DropdownMenuItem>
        {hasPermission('settings.manage') && (
          <DropdownMenuItem asChild>
            <Link to="/admin/settings">
              <SettingsIcon /> Settings
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-muted-foreground">
          <LogOut /> Sign out (Phase 2)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
