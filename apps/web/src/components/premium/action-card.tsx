import { Link } from 'react-router-dom';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActionCardProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  to: string;
  className?: string;
}

/** Quick-action shortcut card (Phase 1 §21; Dashboard quick actions, LC-38.1). */
export function ActionCard({ title, description, icon: Icon, to, className }: ActionCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm transition-all',
        'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-5" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{title}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </span>
    </Link>
  );
}
