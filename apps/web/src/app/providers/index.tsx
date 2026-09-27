import { type ReactNode } from 'react';
import { ThemeProvider } from './theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmDialogHost } from '@/components/feedback/confirm';

/** Composes app-wide providers and singleton hosts (toaster, confirm dialog). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster />
        <ConfirmDialogHost />
      </TooltipProvider>
    </ThemeProvider>
  );
}
