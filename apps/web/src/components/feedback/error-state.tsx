import { AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Technical details shown behind a disclosure; never the primary UX (Phase 1 §31). */
  details?: string;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this right now. Please try again.',
  onRetry,
  details,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-danger/20 bg-danger/5 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-danger/12 text-danger">
        <AlertOctagon className="size-7" />
      </span>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
      {details && (
        <details className="mt-4 max-w-md text-left">
          <summary className="cursor-pointer text-xs text-muted-foreground">Technical details</summary>
          <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
            {details}
          </pre>
        </details>
      )}
    </div>
  );
}
