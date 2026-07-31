'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, Eye, CheckCircle, FileText, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { createBrowserSupabase } from '@optex/db/browser';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerStub {
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface PrescriptionRow {
  id: string;
  customer_id: string | null;
  file_url: string | null;
  sphere_od: number | null;
  sphere_os: number | null;
  cyl_od: number | null;
  cyl_os: number | null;
  axis_od: number | null;
  axis_os: number | null;
  pd: number | null;
  status: 'pending' | 'processed';
  processed_at: string | null;
  created_at: string;
  customer: CustomerStub | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function fmtNum(n: number | null, decimals = 2) {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

// ── Table skeleton ────────────────────────────────────────────────────────────

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

// ── Lens data grid ────────────────────────────────────────────────────────────

function LensGrid({ row }: { row: PrescriptionRow }) {
  const hasAnyLensData =
    row.sphere_od != null ||
    row.sphere_os != null ||
    row.cyl_od != null ||
    row.cyl_os != null ||
    row.axis_od != null ||
    row.axis_os != null ||
    row.pd != null;

  if (!hasAnyLensData) {
    return <p className="text-sm italic text-gray-400">No lens data recorded</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full overflow-hidden rounded-lg border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Eye</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Sphere</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Cyl</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Axis</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="px-3 py-2 font-medium text-gray-700">OD (Right)</td>
            <td className="px-3 py-2 text-center font-mono">{fmtNum(row.sphere_od)}</td>
            <td className="px-3 py-2 text-center font-mono">{fmtNum(row.cyl_od)}</td>
            <td className="px-3 py-2 text-center font-mono">{fmtNum(row.axis_od, 0)}&deg;</td>
          </tr>
          <tr className="border-t bg-gray-50/50">
            <td className="px-3 py-2 font-medium text-gray-700">OS (Left)</td>
            <td className="px-3 py-2 text-center font-mono">{fmtNum(row.sphere_os)}</td>
            <td className="px-3 py-2 text-center font-mono">{fmtNum(row.cyl_os)}</td>
            <td className="px-3 py-2 text-center font-mono">{fmtNum(row.axis_os, 0)}&deg;</td>
          </tr>
        </tbody>
      </table>
      {row.pd != null && (
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium">PD:</span> {fmtNum(row.pd, 1)} mm
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'pending' | 'processed'>('All');
  const [viewItem, setViewItem] = useState<PrescriptionRow | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = createBrowserSupabase();
      const { data, error: fetchErr } = await db
        .from('prescriptions')
        .select('*, customer:customers(full_name, email, phone)')
        .order('created_at', { ascending: false });

      if (fetchErr) throw new Error(fetchErr.message);
      setPrescriptions((data ?? []) as PrescriptionRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = prescriptions.filter((p) => {
    const name = p.customer?.full_name ?? '';
    const email = p.customer?.email ?? '';
    const matchSearch =
      searchTerm === '' ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Computed summary ───────────────────────────────────────────────────────

  const totalCount = prescriptions.length;
  const pendingCount = prescriptions.filter((p) => p.status === 'pending').length;
  const processedCount = prescriptions.filter((p) => p.status === 'processed').length;

  // ── Mark processed ─────────────────────────────────────────────────────────

  function markProcessed(id: string) {
    const now = new Date().toISOString();
    // Optimistic update
    setPrescriptions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'processed', processed_at: now } : p)),
    );
    void (async () => {
      try {
        const db = createBrowserSupabase();
        const { error: updateErr } = await db
          .from('prescriptions')
          .update({ status: 'processed', processed_at: now })
          .eq('id', id);
        if (updateErr) throw new Error(updateErr.message);
      } catch (err) {
        // Rollback optimistic update
        setPrescriptions((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: 'pending', processed_at: null } : p)),
        );
        console.error('Failed to mark processed:', err);
      }
    })();
  }

  // ── View file ──────────────────────────────────────────────────────────────

  function viewFile(row: PrescriptionRow) {
    if (!row.file_url) return;
    setViewLoading(true);
    void (async () => {
      try {
        const db = createBrowserSupabase();
        const { data, error: urlErr } = await db.storage
          .from('prescriptions')
          .createSignedUrl(row.file_url!, 60);
        if (urlErr || !data?.signedUrl)
          throw new Error(urlErr?.message ?? 'Could not generate URL');
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.error('View file error:', err);
      } finally {
        setViewLoading(false);
      }
    })();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Prescriptions</h2>
        <p className="mt-1 text-gray-500">Review and process uploaded customer prescriptions</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <Button variant="ghost" size="sm" onClick={fetchAll} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {!loading && pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <FileText className="h-5 w-5 shrink-0 text-yellow-600" />
          <p className="text-sm font-medium text-yellow-800">
            {pendingCount} prescription(s) awaiting processing
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-3 shrink-0 rounded-full bg-[#141776]" />
              <div>
                <p className="text-sm text-gray-500">Total</p>
                {loading ? (
                  <Skeleton className="mt-1 h-6 w-12" />
                ) : (
                  <p className="text-xl font-bold">{totalCount}</p>
                )}
                <p className="text-xs text-gray-400">All prescriptions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-3 shrink-0 rounded-full bg-amber-500" />
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                {loading ? (
                  <Skeleton className="mt-1 h-6 w-12" />
                ) : (
                  <p className="text-xl font-bold">{pendingCount}</p>
                )}
                <p className="text-xs text-gray-400">Awaiting review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-3 shrink-0 rounded-full bg-green-600" />
              <div>
                <p className="text-sm text-gray-500">Processed</p>
                {loading ? (
                  <Skeleton className="mt-1 h-6 w-12" />
                ) : (
                  <p className="text-xl font-bold">{processedCount}</p>
                )}
                <p className="text-xs text-gray-400">Reviewed and done</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Prescription Queue</CardTitle>
              <CardDescription>{loading ? '…' : `${filtered.length} records`}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1">
                {(['All', 'pending', 'processed'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      statusFilter === s
                        ? 'bg-[#141776] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search name or email…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-52 pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                    Customer
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton cols={5} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                      No prescriptions found
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">
                        {fmtDate(p.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium">{p.customer?.full_name ?? '—'}</p>
                        {p.customer?.phone && (
                          <p className="text-xs text-gray-400">{p.customer.phone}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {p.customer?.email ?? '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            p.status === 'processed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewItem(p)}
                            className="h-7 px-2 text-xs"
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            Details
                          </Button>
                          {p.file_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewFile(p)}
                              disabled={viewLoading}
                              className="h-7 px-2 text-xs"
                            >
                              <ExternalLink className="mr-1 h-3.5 w-3.5" />
                              View File
                            </Button>
                          )}
                          {p.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => markProcessed(p.id)}
                              className="h-7 bg-green-600 px-2 text-xs hover:bg-green-700"
                            >
                              <CheckCircle className="mr-1 h-3.5 w-3.5" />
                              Mark Processed
                            </Button>
                          )}
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

      {/* ── Detail / lens dialog ── */}
      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Prescription — {viewItem?.customer?.full_name ?? 'Unknown Customer'}
            </DialogTitle>
            <DialogDescription>
              Uploaded {viewItem ? fmtDate(viewItem.created_at) : ''} ·{' '}
              <span
                className={`font-medium capitalize ${
                  viewItem?.status === 'processed' ? 'text-green-700' : 'text-amber-700'
                }`}
              >
                {viewItem?.status}
              </span>
            </DialogDescription>
          </DialogHeader>

          {viewItem && (
            <div className="space-y-4">
              {/* Customer info */}
              <div className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
                {viewItem.customer?.email && (
                  <p>
                    <span className="font-medium text-gray-500">Email: </span>
                    {viewItem.customer.email}
                  </p>
                )}
                {viewItem.customer?.phone && (
                  <p>
                    <span className="font-medium text-gray-500">Phone: </span>
                    {viewItem.customer.phone}
                  </p>
                )}
                {viewItem.processed_at && (
                  <p>
                    <span className="font-medium text-gray-500">Processed: </span>
                    {fmtDate(viewItem.processed_at)}
                  </p>
                )}
              </div>

              {/* Lens data */}
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Lens Prescription Data</p>
                <LensGrid row={viewItem} />
              </div>

              {/* File placeholder if no URL */}
              {!viewItem.file_url && (
                <div className="flex h-24 items-center justify-center rounded-lg bg-gray-100">
                  <div className="text-center">
                    <FileText className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-1 text-xs text-gray-500">No file uploaded</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <Button variant="outline" onClick={() => setViewItem(null)}>
                  Close
                </Button>
                {viewItem.file_url && (
                  <Button
                    variant="outline"
                    onClick={() => viewFile(viewItem)}
                    disabled={viewLoading}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open File
                  </Button>
                )}
                {viewItem.status === 'pending' && (
                  <Button
                    onClick={() => {
                      markProcessed(viewItem.id);
                      setViewItem(null);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Processed
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
