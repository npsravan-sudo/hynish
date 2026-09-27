import { LogOut, User, Settings as SettingsIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
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

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  accountant: 'Accountant',
  shop: 'Shop',
  staff: 'Staff',
};

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const businessName = useAuthStore((s) => s.businessName);
  const role = useAuthStore((s) => s.role);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const signOut = useAuthStore((s) => s.signOutUser);

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
            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
            <div className="mt-1 flex items-center gap-2">
              {businessName && <span className="truncate text-xs text-muted-foreground">{businessName}</span>}
              {role && <Badge variant="secondary" className="text-[10px]">{ROLE_LABEL[role] ?? role}</Badge>}
            </div>
          </div>
        </DropdownMenuLabel>
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
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
