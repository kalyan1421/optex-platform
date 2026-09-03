'use client';

/**
 * Small pieces the four ledger pages all need: branch lookup, a status pill,
 * and a consistent error banner. Kept here rather than duplicated four times.
 */

import { useEffect, useState } from 'react';
import type { Branch } from '@optex/api-client';
import { api } from '@/lib/api';

/**
 * Branches the caller may act on.
 *
 * A branch-scoped role (Branch Manager / Branch Staff) carries `branchId` on
 * its JWT and the API ignores any other branch it is handed, so the picker is
 * narrowed to that one branch instead of offering choices the server would
 * reject.
 */
export function useBranches(ownBranchId: string | null) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.branches
      .list()
      .then((rows) => {
        if (cancelled) return;
        const all = rows ?? [];
        setBranches(ownBranchId ? all.filter((b) => b.id === ownBranchId) : all);
      })
      .catch((e) => console.error('branch lookup failed:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownBranchId]);

  return { branches, loading };
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  posted: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  in_transit: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

/** Shown in place of the action UI when the role can read but not write here. */
export function ReadOnlyNotice({ action }: { action: string }) {
  return (
    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Your role can view this page but not {action}.
    </p>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `message` off an unknown thrown value, without an `any`. */
export function errorMessage(e: unknown, fallback: string): string {
  return (e as Error)?.message || fallback;
}
