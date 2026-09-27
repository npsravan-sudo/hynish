import * as React from 'react';
import { create } from 'zustand';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Reusable confirmation system (Phase 1 §33). Destructive/irreversible actions call
 * `confirm(...)` instead of the native browser confirm(). Radix Dialog provides the focus
 * trap, Escape-to-close and focus restore.
 */

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  loading: boolean;
  resolve: ((value: boolean) => void) | null;
  request: (options: ConfirmOptions) => Promise<boolean>;
  setLoading: (loading: boolean) => void;
  finish: (value: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  loading: false,
  title: '',
  resolve: null,
  request: (options) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, loading: false, resolve, ...options });
    }),
  setLoading: (loading) => set({ loading }),
  finish: (value) => {
    get().resolve?.(value);
    set({ open: false, loading: false, resolve: null });
  },
}));

/** Imperative API: `const ok = await confirm({ title, danger: true })`. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().request(options);
}

/** Mounted once (in providers) so `confirm()` works from anywhere. */
export function ConfirmDialogHost() {
  const { open, loading, title, description, confirmLabel, cancelLabel, danger, finish } =
    useConfirmStore();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !loading && finish(false)}>
      <DialogContent hideClose className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {danger && (
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-danger/12 text-danger">
                <AlertTriangle className="size-5" />
              </span>
            )}
            <div className="flex flex-col gap-1.5">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => finish(false)} disabled={loading}>
            {cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            onClick={() => finish(true)}
            loading={loading}
          >
            {confirmLabel ?? 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Hook form of the API for components that prefer it. */
export function useConfirm() {
  return React.useCallback((options: ConfirmOptions) => confirm(options), []);
}
