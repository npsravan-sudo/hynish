import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useThemeStore } from '@/stores/theme-store';

/** Centralized toast host (Phase 1 §32). Theme-aware; renders independently of forms. */
export function Toaster(props: ToasterProps) {
  const resolved = useThemeStore((s) => s.resolved);
  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          success: 'group-[.toaster]:!text-success',
          error: 'group-[.toaster]:!text-danger',
          warning: 'group-[.toaster]:!text-warning',
          info: 'group-[.toaster]:!text-info',
        },
      }}
      {...props}
    />
  );
}

export { toast } from 'sonner';
