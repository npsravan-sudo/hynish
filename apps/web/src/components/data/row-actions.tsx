import { MoreHorizontal, Eye, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export interface RowAction {
  label: string;
  icon?: 'view' | 'edit' | 'archive' | 'restore';
  onSelect: () => void;
  danger?: boolean;
  separatorBefore?: boolean;
}

const ICONS = { view: Eye, edit: Pencil, archive: Archive, restore: ArchiveRestore } as const;

/** Reusable row-actions menu. Only pass actions the user is permitted to perform (§48). */
export function RowActions({ actions, label = 'Actions' }: { actions: RowAction[]; label?: string }) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((a, i) => {
          const Icon = a.icon ? ICONS[a.icon] : null;
          return (
            <div key={a.label}>
              {a.separatorBefore && i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={a.onSelect} className={a.danger ? 'text-danger focus:text-danger' : undefined}>
                {Icon && <Icon />} {a.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
