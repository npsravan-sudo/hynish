import type { ReactNode } from 'react';
import { AlertTriangle, Ban, Loader2, SettingsIcon, ShieldX } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BrandMark } from '@/components/layout/brand';

/** Full-screen auth-state screens (Phase 2 §43). All theme- and mobile-aware. */
function CenteredCard({
  icon,
  tone,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  tone: 'primary' | 'danger' | 'warning';
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const toneClass =
    tone === 'danger' ? 'bg-danger/12 text-danger' : tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary';
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <BrandMark />
        <span className={`flex size-14 items-center justify-center rounded-2xl ${toneClass}`}>{icon}</span>
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </Card>
    </div>
  );
}

/** Initial resolution state — no authenticated content is shown yet (§10, §48). */
export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <BrandMark />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    </div>
  );
}

export function UnauthorizedScreen() {
  const signOut = useAuthStore((s) => s.signOutUser);
  return (
    <CenteredCard
      icon={<ShieldX className="size-7" />}
      tone="danger"
      title="No access to this workspace"
      description="Your account is signed in but isn't a member of this business. Ask an administrator to add you."
    >
      <Button variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </CenteredCard>
  );
}

export function InactiveScreen() {
  const signOut = useAuthStore((s) => s.signOutUser);
  return (
    <CenteredCard
      icon={<Ban className="size-7" />}
      tone="warning"
      title="Your account is inactive"
      description="Access has been paused for your account. Please contact your administrator."
    >
      <Button variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </CenteredCard>
  );
}

export function ConfigErrorScreen() {
  return (
    <CenteredCard
      icon={<SettingsIcon className="size-7" />}
      tone="warning"
      title="App not configured"
      description="Firebase configuration is missing. Copy apps/web/.env.example to .env.local and fill in your project's public config."
    >
      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <AlertTriangle className="size-4" /> VITE_FIREBASE_* values are required.
      </div>
    </CenteredCard>
  );
}
