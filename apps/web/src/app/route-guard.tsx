import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import type { Permission } from '@hynish/domain';
import { useAuthStore } from '@/stores/auth-store';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';

/**
 * Per-page permission guard (Phase 2 §47, §49). UX only — the server still enforces every
 * operation. By the time a page renders, AuthGate has resolved status to 'ready'.
 */
export function RouteGuard({
  permission,
  children,
}: {
  permission?: Permission | undefined;
  children: React.ReactNode;
}) {
  const allowed = useAuthStore((s) => (permission ? s.hasPermission(permission) : true));

  if (!allowed) {
    return (
      <div className="py-12">
        <EmptyState
          icon={ShieldAlert}
          title="Access restricted"
          description="You don't have permission to access this section. Ask an administrator if you need it."
          action={
            <Button asChild>
              <Link to="/dashboard">Return to Dashboard</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}
