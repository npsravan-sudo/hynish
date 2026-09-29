/**
 * Per-feature error boundary (Phase 11 §44–45).
 *
 * Wraps individual feature areas so a crash in one area doesn't destroy the whole app.
 * The global AppErrorBoundary still handles truly unrecoverable failures.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Short name of the feature for the fallback message. */
  name?: string;
}
interface State {
  error: Error | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In a later phase, replace with ErrorReporter.captureException().
    console.error(`[FeatureErrorBoundary:${this.props.name ?? 'unknown'}]`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    const feature = this.props.name ?? 'This section';
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </span>
        <div>
          <p className="font-semibold">{feature} couldn&apos;t load</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong in this section. Your data is safe.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={this.reset}>Try again</Button>
          <Button size="sm" variant="outline" onClick={() => window.location.assign('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }
}
