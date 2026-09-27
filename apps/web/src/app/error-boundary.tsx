import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Application-level error boundary (Phase 1 §39). Shows a friendly recovery screen; stack
 * traces are only revealed in development (never to production users).
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Client error reporting is wired to a rate-limited callable in a later phase.
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isDev = import.meta.env.DEV;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <div className="flex max-w-md flex-col items-center rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-danger/12 text-danger">
            <AlertOctagon className="size-7" />
          </span>
          <h1 className="text-lg font-bold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Try refreshing the page or return to the dashboard.
          </p>
          {isDev && (
            <pre className="mt-4 max-h-48 w-full overflow-auto rounded-md bg-muted p-3 text-left text-xs text-danger">
              {error.message}
              {'\n'}
              {error.stack}
            </pre>
          )}
          <div className="mt-6 flex gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button
              variant="outline"
              onClick={() => {
                this.reset();
                window.location.assign('/dashboard');
              }}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
