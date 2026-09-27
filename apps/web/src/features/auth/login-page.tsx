import { Navigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useSessionStore } from '@/stores/session-store';
import { BrandMark } from '@/components/layout/brand';
import { Card } from '@/components/ui/card';

/**
 * Login route placeholder (Phase 1 §46–§47). This phase does NOT implement authentication and
 * shows NO fake login form. Firebase email/password sign-in and membership verification are
 * implemented in Phase 2. While the session is in placeholder `ready` state, this redirects in.
 */
export function LoginPage() {
  const status = useSessionStore((s) => s.status);
  if (status === 'ready') return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <BrandMark />
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="text-lg font-bold">Sign-in arrives in Phase 2</h1>
        <p className="text-sm text-muted-foreground">
          Authentication (Firebase email/password) and membership verification are implemented in
          the next phase. This screen is the guard target only — there is no placeholder login.
        </p>
      </Card>
    </div>
  );
}
