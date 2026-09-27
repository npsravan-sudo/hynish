import { Navigate, useLocation } from 'react-router-dom';
import type { Permission } from '@hynish/domain';
import { useSessionStore } from '@/stores/session-store';
import { PageSkeleton } from '@/components/feedback/skeletons';
import { EmptyState } from '@/components/feedback/empty-state';
import { ShieldAlert } from 'lucide-react';

/**
 * Route-guard foundation (Phase 1 §46). Handles loading / unauthenticated / inactive /
 * unauthorized states. In this phase the session is a placeholder in `ready` state, so guards
 * pass; Phase 2 connects them to real Firebase Auth + Firestore membership.
 */
export function RouteGuard({
  permission,
  children,
}: {
  permission?: Permission | undefined;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const status = useSessionStore((s) => s.status);
  const hasPermission = useSessionStore((s) => s.hasPermission);

  if (status === 'loading') {
    return <PageSkeleton className="p-6" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="py-12">
        <EmptyState
          icon={ShieldAlert}
          title="You don't have access to this page"
          description="Ask an administrator to grant the required permission for your account."
        />
      </div>
    );
  }

  return <>{children}</>;
}
