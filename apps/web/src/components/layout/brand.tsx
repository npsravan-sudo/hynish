import { cn } from '@/lib/utils';

/**
 * Text/mark brand identity (Phase 1 §41: do not invent a new logo). Uses a simple
 * monogram tile plus the app name — no invented logo asset.
 */
export function BrandMark({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-sales text-sm font-extrabold text-white shadow-sm">
        H
      </span>
      {!collapsed && (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-extrabold tracking-tight">Hynish ERP</span>
          <span className="text-[11px] font-medium text-muted-foreground">Wholesale Ledger</span>
        </span>
      )}
    </div>
  );
}
