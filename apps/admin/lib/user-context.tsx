'use client';

/**
 * The signed-in staff member — role, branch, and full permission set — fetched
 * once per session from `GET /auth/me` and shared via context so every page,
 * `PermissionGate`, and the sidebar read the same values without each firing
 * its own request.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CurrentUser } from '@optex/api-client';
import { api } from './api';

interface UserContextValue {
  user: CurrentUser | null;
  loading: boolean;
  /** True once the initial fetch has resolved, success or failure. */
  ready: boolean;
  /** Convenience check: does the caller hold this permission? */
  hasPermission: (permission: string) => boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.auth
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      // A failed fetch leaves `user` null — `PermissionGate` treats that as
      // "no permissions," which is the safe default, not a crash.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasPermission = (permission: string) => user?.permissions.includes(permission) ?? false;

  return (
    <UserContext.Provider value={{ user, loading, ready, hasPermission }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useCurrentUser() must be called within <UserProvider>');
  }
  return ctx;
}
