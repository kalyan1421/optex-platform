'use client';
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { api } from '@/lib/api';
import type { AuditLogEntry } from '@optex/api-client';

/**
 * Resource types worth filtering by, mirroring the `resourceType` strings
 * every `AuditLogService.record()` call site in the API actually uses. Not
 * exhaustive by construction — an unlisted value still round-trips through
 * the free-form query param, this is just the picker's shortlist.
 */
const RESOURCE_TYPES = [
  'staff_users',
  'customers',
  'branches',
  'products',
  'inventory',
  'orders',
  'order_cancellation_requests',
  'appointments',
  'prescriptions',
  'product_reviews',
  'promo_codes',
  'promo_banners',
  'mpesa_transactions',
  'pesapal_transactions',
];

const ALL_RESOURCE_TYPES = '__all__';

function SkeletonRow() {
  return (
    <tr className="border-b">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resourceType, setResourceType] = useState<string>(ALL_RESOURCE_TYPES);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.admin.auditLog
      .list({
        resourceType: resourceType === ALL_RESOURCE_TYPES ? undefined : resourceType,
        page,
        pageSize,
      })
      .then((res) => {
        if (cancelled) return;
        setEntries(res.data);
        setTotal(res.total);
      })
      .catch((e) => console.error('Failed to load audit log:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resourceType, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
        <p className="mt-1 text-gray-500">
          Every privileged action, retained indefinitely. Read-only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Entries</CardTitle>
              {!loading && <CardDescription>{`${total} total`}</CardDescription>}
            </div>
            <Select
              value={resourceType}
              onValueChange={(v) => {
                setResourceType(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All resource types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_RESOURCE_TYPES}>All resource types</SelectItem>
                {RESOURCE_TYPES.map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {rt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">When</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Actor</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Action</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                    Resource
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Detail</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
                  : entries.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm text-gray-600">
                          {formatTimestamp(entry.created_at)}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {entry.actor_role.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-sm">{entry.action}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">
                          {entry.resource_type}
                          {entry.resource_id && (
                            <span className="text-gray-400">
                              {' '}
                              · {entry.resource_id.slice(0, 8)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setSelected(entry)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                {!loading && entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-400">
                      No audit entries match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.action}</DialogTitle>
            <DialogDescription>
              {selected && formatTimestamp(selected.created_at)} · {selected?.actor_role} ·{' '}
              {selected?.resource_type}
              {selected?.resource_id ? ` · ${selected.resource_id}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              {selected.before !== null && (
                <div>
                  <p className="mb-1 font-medium text-gray-700">Before</p>
                  <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs">
                    {JSON.stringify(selected.before, null, 2)}
                  </pre>
                </div>
              )}
              {selected.after !== null && (
                <div>
                  <p className="mb-1 font-medium text-gray-700">After</p>
                  <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs">
                    {JSON.stringify(selected.after, null, 2)}
                  </pre>
                </div>
              )}
              {selected.metadata !== null && (
                <div>
                  <p className="mb-1 font-medium text-gray-700">Metadata</p>
                  <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}
              {selected.before === null &&
                selected.after === null &&
                selected.metadata === null && (
                  <p className="text-gray-400">No additional detail was captured for this entry.</p>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
