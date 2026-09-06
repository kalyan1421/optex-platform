'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, Eye, CheckCircle, Archive, AlertCircle, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { api } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type EyeRecordStatus = 'submitted' | 'reviewed' | 'archived';

interface EyeRecordRow {
  id: string;
  customer_id: string;
  appointment_id: string | null;
  full_name: string;
  age: number | null;
  phone: string;
  email: string | null;
  gender: string | null;
  conditions: string[];
  history_notes: string | null;
  sphere_od: number | null;
  sphere_os: number | null;
  cyl_od: number | null;
  cyl_os: number | null;
  axis_od: number | null;
  axis_os: number | null;
  add_od: number | null;
  add_os: number | null;
  pd_od: number | null;
  pd_os: number | null;
  status: EyeRecordStatus;
  reviewed_at: string | null;
  created_at: string;
  branch_id: string | null;
  branch: { name: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Prescription values arrive as Postgres `numeric`, which PostgREST serializes
 * as a string to avoid float rounding. Coerce before formatting — `.toFixed`
 * on a string throws.
 */
function fmtNum(n: number | string | null, decimals = 2) {
  if (n == null || n === '') return '—';
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(decimals) : '—';
}

/**
 * A record carries no branch when the intake was submitted with no appointment
 * behind it (0038). Say so plainly rather than rendering an empty cell — for a
 * Super Admin, "Unassigned" is the set of records no branch queue will pick up.
 */
function branchLabel(r: EyeRecordRow) {
  return r.branch?.name ?? 'Unassigned';
}

const STATUS_STYLES: Record<EyeRecordStatus, string> = {
  submitted: 'bg-amber-100 text-amber-800',
  reviewed: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
};

function StatusBadge({ status }: { status: EyeRecordStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function TableSkeleton({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-3 py-3">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Prescription grid ─────────────────────────────────────────────────────────

function RxGrid({ row }: { row: EyeRecordRow }) {
  const values = [
    row.sphere_od,
    row.sphere_os,
    row.cyl_od,
    row.cyl_os,
    row.axis_od,
    row.axis_os,
    row.add_od,
    row.add_os,
    row.pd_od,
    row.pd_os,
  ];
  if (values.every((v) => v == null)) {
    return (
      <p className="text-sm italic text-gray-400">
        No prescription supplied — the customer asked to be tested fresh.
      </p>
    );
  }

  const eyes = [
    {
      label: 'Right (OD)',
      sph: row.sphere_od,
      cyl: row.cyl_od,
      axis: row.axis_od,
      add: row.add_od,
      pd: row.pd_od,
    },
    {
      label: 'Left (OS)',
      sph: row.sphere_os,
      cyl: row.cyl_os,
      axis: row.axis_os,
      add: row.add_os,
      pd: row.pd_os,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full overflow-hidden rounded-lg border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">
              Eye
            </th>
            {['SPH', 'CYL', 'AXIS', 'ADD', 'PD (mm)'].map((h) => (
              <th
                key={h}
                scope="col"
                className="px-3 py-2 text-center text-xs font-medium text-gray-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {eyes.map((e) => (
            <tr key={e.label} className="border-t">
              <th scope="row" className="px-3 py-2 text-left font-medium text-gray-700">
                {e.label}
              </th>
              <td className="px-3 py-2 text-center tabular-nums">{fmtNum(e.sph)}</td>
              <td className="px-3 py-2 text-center tabular-nums">{fmtNum(e.cyl)}</td>
              <td className="px-3 py-2 text-center tabular-nums">{fmtNum(e.axis, 0)}</td>
              <td className="px-3 py-2 text-center tabular-nums">{fmtNum(e.add)}</td>
              <td className="px-3 py-2 text-center tabular-nums">{fmtNum(e.pd, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

/**
 * Eye-care intake records (migration 0037). The staff-side counterpart to the
 * storefront's /eye-care form.
 *
 * Kept separate from the Prescriptions screen on purpose: that one reviews
 * uploaded *files* via signed URLs, this one reviews what the customer typed
 * about themselves. Neither is a substitute for the other.
 */
export function EyeRecords() {
  const [records, setRecords] = useState<EyeRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | EyeRecordStatus>('All');
  const [branchFilter, setBranchFilter] = useState<'All' | string>('All');
  const [viewItem, setViewItem] = useState<EyeRecordRow | null>(null);
  const [actionError, setActionError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.admin.eyeRecords.list();
      setRecords(rows as unknown as EyeRecordRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load eye records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const filtered = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      term === '' ||
      r.full_name.toLowerCase().includes(term) ||
      (r.email ?? '').toLowerCase().includes(term) ||
      r.phone.toLowerCase().includes(term) ||
      r.id.toLowerCase().includes(term);
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    const matchBranch = branchFilter === 'All' || branchLabel(r) === branchFilter;
    return matchSearch && matchStatus && matchBranch;
  });

  /**
   * Branches present in the data, not the full directory: the API already
   * scoped this list to the caller's branch, so offering a branch they cannot
   * see would render an always-empty filter. A Branch Manager therefore gets a
   * single-value control, which is why it hides itself below two.
   */
  const branchOptions = Array.from(new Set(records.map(branchLabel))).sort();

  const submittedCount = records.filter((r) => r.status === 'submitted').length;
  const reviewedCount = records.filter((r) => r.status === 'reviewed').length;

  /** Optimistic status change, rolled back if the API rejects. */
  function setStatus(id: string, status: EyeRecordStatus) {
    const previous = records.find((r) => r.id === id)?.status;
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    void (async () => {
      try {
        // reviewed_at/reviewed_by are stamped server-side to match the status,
        // so the response carries the authoritative row.
        const updated = await api.admin.eyeRecords.updateStatus(id, { status });
        setRecords((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: updated.status,
                  reviewed_at: updated.reviewed_at,
                  branch: updated.branch,
                }
              : r,
          ),
        );
        setViewItem((v) =>
          v && v.id === id ? { ...v, status: updated.status, reviewed_at: updated.reviewed_at } : v,
        );
        setActionError('');
      } catch (err) {
        if (previous) {
          setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: previous } : r)));
        }
        console.error('Failed to update eye record status:', err);
        setActionError((err as Error)?.message ?? 'Could not update the record.');
      }
    })();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Eye Records</h1>
        <p className="text-sm text-gray-500">
          Clinical intake submitted from the eye-care form — history and self-reported
          prescriptions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-3xl">{loading ? '—' : records.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Awaiting review</CardDescription>
            <CardTitle className="text-3xl">{loading ? '—' : submittedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reviewed</CardDescription>
            <CardTitle className="text-3xl">{loading ? '—' : reviewedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />
            Intake records
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                aria-label="Search eye records"
                placeholder="Search by name, phone, email or id"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {(['All', 'submitted', 'reviewed', 'archived'] as const).map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  className="capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
            {branchOptions.length > 1 ? (
              <select
                aria-label="Filter by branch"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="All">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {error ? (
            <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase text-gray-500">
                  <th scope="col" className="px-3 py-2">
                    Patient
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Contact
                  </th>
                  <th scope="col" className="px-3 py-2">
                    History
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Submitted
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton cols={7} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-gray-500">
                      {records.length === 0
                        ? 'No eye records submitted yet.'
                        : 'No records match this search.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <div className="font-medium">{r.full_name}</div>
                        <div className="text-xs text-gray-500">
                          {r.age != null ? `${r.age} yrs` : 'Age not given'}
                          {r.gender ? ` · ${r.gender}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{r.phone}</div>
                        <div className="text-xs text-gray-500">{r.email ?? '—'}</div>
                      </td>
                      <td className="px-3 py-3">
                        {r.branch ? (
                          <span className="text-xs">{r.branch.name}</span>
                        ) : (
                          <span className="text-xs italic text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {r.conditions.length ? (
                          <span className="text-xs">{r.conditions.join(', ')}</span>
                        ) : (
                          <span className="text-xs text-gray-400">None reported</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-600">
                        {fmtDate(r.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewItem(r)}
                            aria-label={`View ${r.full_name}'s eye record`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {r.status !== 'reviewed' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStatus(r.id, 'reviewed')}
                              aria-label={`Mark ${r.full_name}'s record reviewed`}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {r.status !== 'archived' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStatus(r.id, 'archived')}
                              aria-label={`Archive ${r.full_name}'s record`}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={viewItem !== null} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewItem?.full_name}</DialogTitle>
            <DialogDescription>
              Submitted {viewItem ? fmtDate(viewItem.created_at) : ''}
            </DialogDescription>
          </DialogHeader>

          {viewItem ? (
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Phone</dt>
                  <dd>{viewItem.phone}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Email</dt>
                  <dd>{viewItem.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Age</dt>
                  <dd>{viewItem.age ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Gender</dt>
                  <dd>{viewItem.gender ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Branch</dt>
                  <dd>
                    {viewItem.branch ? (
                      viewItem.branch.name
                    ) : (
                      <span className="italic text-gray-400">Unassigned</span>
                    )}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="mb-2 text-sm font-medium">Health history</h3>
                {viewItem.conditions.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {viewItem.conditions.map((c) => (
                      <li key={c} className="rounded-full bg-gray-100 px-3 py-1 text-xs">
                        {c}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm italic text-gray-400">None reported</p>
                )}
                {viewItem.history_notes ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm">
                    {viewItem.history_notes}
                  </p>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Self-reported prescription</h3>
                <RxGrid row={viewItem} />
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <StatusBadge status={viewItem.status} />
                <div className="flex gap-2">
                  {viewItem.status !== 'reviewed' ? (
                    <Button size="sm" onClick={() => setStatus(viewItem.id, 'reviewed')}>
                      Mark reviewed
                    </Button>
                  ) : null}
                  {viewItem.status !== 'archived' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus(viewItem.id, 'archived')}
                    >
                      Archive
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
