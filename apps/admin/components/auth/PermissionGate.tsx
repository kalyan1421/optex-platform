'use client';

/**
 * Wraps every page under `(authed)` (`layout.tsx`) with a single, centralized
 * permission check keyed on the current pathname — CR-01 R1 1c's
 * "PermissionGate wraps every admin page" requirement, implemented once here
 * rather than as 13 near-identical per-page wrappers, so a 14th page is
 * covered automatically and the 13 existing ones can't individually drift
 * out of sync with `lib/route-permissions.ts`'s map.
 *
 * Renders a clear "you don't have access" state instead of letting a page
 * attempt calls that would 403 anyway.
 */

import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { useCurrentUser } from '@/lib/user-context';
import { permissionForRoute } from '@/lib/route-permissions';

export function PermissionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, ready, hasPermission } = useCurrentUser();

  // Still resolving the initial `/auth/me` fetch — render nothing rather
  // than a flash of "access denied" for a permission the user actually holds.
  if (loading || !ready) {
    return null;
  }

  const requiredPermission = permissionForRoute(pathname);
  // A route this map doesn't know about (or the root `/`) is not gated here —
  // it's either public within the authed shell or has its own access story.
  if (!requiredPermission || hasPermission(requiredPermission)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <ShieldAlert className="h-10 w-10 text-gray-300" />
      <h2 className="text-lg font-semibold text-gray-900">You don't have access to this page</h2>
      <p className="max-w-sm text-sm text-gray-500">
        {user?.role
          ? `Your role (${user.role.replace(/_/g, ' ')}) doesn't include the "${requiredPermission}" permission. Ask a Super Admin if you need access.`
          : 'Could not load your permissions. Try refreshing the page.'}
      </p>
    </div>
  );
}
