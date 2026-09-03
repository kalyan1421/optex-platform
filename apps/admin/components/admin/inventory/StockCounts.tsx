'use client';

/**
 * Physical stock counts — CR-01 R2 sub-phase 2e.
 *
 * A count opens against a branch, collects scanned serial numbers, and is then
 * accepted. Accepting is the consequential step: the system reconciles what
 * was scanned against what it believed was on the shelf and books the variance
 * — units expected but not found are written off, units found but unexpected
 * are brought in. That is why the sheet stays open and editable until someone
 * deliberately accepts it.
 */

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Play, ScanLine, Check, X } from 'lucide-react';
import type { Product, StockCount } from '@optex/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { TableSkeleton } from '../../ui/table-skeleton';
import { api } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';
import {
  ErrorBanner,
  ReadOnlyNotice,
  StatusPill,
  errorMessage,
  formatDateTime,
  useBranches,
} from './shared';

export function StockCounts() {
  const { user, hasPermission } = useCurrentUser();
  const canWrite = hasPermission('inventory.count');
  const { branches } = useBranches(user?.branchId ?? null);

  const [counts, setCounts] = useState<StockCount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [startOpen, setStartOpen] = useState(false);
  const [startBranch, setStartBranch] = useState('');
  const [starting, setStarting] = useState(false);

  const [sheet, setSheet] = useState<StockCount | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [unknownProductId, setUnknownProductId] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState('');
  /** Second step on accept — see the confirm panel below. */
  const [confirmingAccept, setConfirmingAccept] = useState(false);

  const reload = useCallback(async () => {
    try {
      setCounts(await api.admin.stockCounts.list());
      setError('');
    } catch (e) {
      console.error('stock count list failed:', e);
      setError(errorMessage(e, 'Could not load stock counts.'));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const [cRes, pRes] = await Promise.allSettled([
        api.admin.stockCounts.list(),
        api.admin.products.listAll({ page: 1, limit: 100 }),
      ]);
      if (cRes.status === 'fulfilled') setCounts(cRes.value);
      else setError(errorMessage(cRes.reason, 'Could not load stock counts.'));
      if (pRes.status === 'fulfilled') setProducts(pRes.value.items);
      setLoading(false);
    })();
  }, []);

  async function handleStart() {
    if (!startBranch) return;
    setStarting(true);
    try {
      const created = await api.admin.stockCounts.start(startBranch);
      setStartOpen(false);
      await reload();
      setSheet(created);
      setSheetError('');
    } catch (e) {
      console.error('start count failed:', e);
      setError(errorMessage(e, 'Could not start the count.'));
    } finally {
      setStarting(false);
    }
  }

  async function handleScan() {
    if (!sheet) return;
    const serials = scanInput
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (serials.length === 0) return;
    setBusy(true);
    setSheetError('');
    try {
      // `product_id` is only needed for serials the system has never seen —
      // sending it for known ones would be noise, so it is opt-in.
      const updated = await api.admin.stockCounts.scan(sheet.id, {
        scans: serials.map((serial_number) =>
          unknownProductId ? { serial_number, product_id: unknownProductId } : { serial_number },
        ),
      });
      setSheet(updated);
      setScanInput('');
      await reload();
    } catch (e) {
      console.error('scan failed:', e);
      setSheetError(errorMessage(e, 'Could not record those scans.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    if (!sheet) return;
    setBusy(true);
    setSheetError('');
    try {
      await api.admin.stockCounts.accept(sheet.id);
      setSheet(null);
      setConfirmingAccept(false);
      await reload();
    } catch (e) {
      console.error('accept failed:', e);
      setSheetError(errorMessage(e, 'Could not accept the count.'));
    } finally {
      setBusy(false);
    }
  }

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? '—';

  /** Expected-but-missing and found-but-unexpected are the two variance kinds. */
  function variance(count: StockCount) {
    const missing = count.items.filter((i) => i.expected && !i.found).length;
    const surplus = count.items.filter((i) => !i.expected && i.found).length;
    return { missing, surplus };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Stock Counts</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Scan a branch&rsquo;s shelf, then accept the count to book the variance.
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setStartBranch(user?.branchId ?? '');
              setStartOpen(true);
            }}
            className="bg-[#141776] hover:bg-[#0f1258]"
          >
            <Play className="mr-1 h-4 w-4" />
            Start Count
          </Button>
        )}
      </div>

      {!canWrite && <ReadOnlyNotice action="run stock counts" />}
      <ErrorBanner message={error} />

      <Card>
        <CardHeader>
          <CardTitle>Counts</CardTitle>
          <CardDescription>{loading ? 'Loading…' : `${counts.length} counts`}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {['Branch', 'Status', 'Scanned', 'Missing', 'Surplus', 'Started', ''].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton rows={4} cols={7} />
              ) : (
                <tbody>
                  {counts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-500">
                        No stock counts yet.
                      </td>
                    </tr>
                  ) : (
                    counts.map((c) => {
                      const { missing, surplus } = variance(c);
                      return (
                        <tr key={c.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-3 text-sm">{branchName(c.branch_id)}</td>
                          <td className="px-3 py-3">
                            <StatusPill status={c.status} />
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {c.items.filter((i) => i.found).length}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {missing > 0 ? (
                              <span className="font-medium text-red-600">{missing}</span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {surplus > 0 ? (
                              <span className="font-medium text-amber-600">{surplus}</span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-500">
                            {formatDateTime(c.started_at)}
                          </td>
                          <td className="px-3 py-3">
                            <Button
                              size="sm"
                              variant={c.status === 'in_progress' ? 'default' : 'outline'}
                              className={
                                c.status === 'in_progress'
                                  ? 'h-7 bg-[#141776] px-2 text-xs hover:bg-[#0f1258]'
                                  : 'h-7 px-2 text-xs'
                              }
                              onClick={() => {
                                setSheet(c);
                                setScanInput('');
                                setSheetError('');
                                setConfirmingAccept(false);
                              }}
                            >
                              <ClipboardCheck className="mr-1 h-3 w-3" />
                              {c.status === 'in_progress' ? 'Continue' : 'View'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Start */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start a Stock Count</DialogTitle>
            <DialogDescription>
              Opens a count sheet for one branch. Nothing changes until you accept it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select value={startBranch} onValueChange={setStartBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStartOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                disabled={!startBranch || starting}
                className="bg-[#141776] hover:bg-[#0f1258]"
              >
                {starting ? 'Starting…' : 'Start count'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Count sheet */}
      <Dialog open={!!sheet} onOpenChange={() => setSheet(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Count Sheet — {sheet ? branchName(sheet.branch_id) : ''}</DialogTitle>
            <DialogDescription>
              {sheet?.status === 'in_progress'
                ? 'Scan or paste serial numbers. Accepting books the variance and closes the count.'
                : 'This count is closed and shown for reference.'}
            </DialogDescription>
          </DialogHeader>
          {sheet && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-gray-500">Scanned</p>
                  <p className="text-xl font-bold">{sheet.items.filter((i) => i.found).length}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-gray-500">Missing</p>
                  <p className="text-xl font-bold text-red-600">{variance(sheet).missing}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-gray-500">Surplus</p>
                  <p className="text-xl font-bold text-amber-600">{variance(sheet).surplus}</p>
                </div>
              </div>

              {sheet.status === 'in_progress' && canWrite && (
                <>
                  <div className="space-y-1.5">
                    <Label>Scan serials</Label>
                    <Textarea
                      rows={3}
                      className="font-mono text-sm"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      placeholder="One serial per line, or comma-separated"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Product for unrecognised serials (optional)</Label>
                    <Select
                      value={unknownProductId || 'none'}
                      onValueChange={(v) => setUnknownProductId(v === 'none' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Known serials only</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.sku}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Only needed when a scanned serial is not in the system yet.
                    </p>
                  </div>
                  <Button onClick={handleScan} disabled={busy || !scanInput.trim()}>
                    <ScanLine className="mr-1 h-4 w-4" />
                    {busy ? 'Recording…' : 'Record scans'}
                  </Button>
                </>
              )}

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Lines ({sheet.items.length})
                </h4>
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  {sheet.items.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">Nothing scanned yet.</p>
                  ) : (
                    <ul>
                      {sheet.items.map((item, i) => (
                        <li
                          key={`${item.serial_id ?? item.scanned_serial_number}-${i}`}
                          className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm">{item.product_name ?? 'Unknown'}</p>
                            <p className="truncate font-mono text-xs text-gray-500">
                              {item.scanned_serial_number ?? item.serial_id}
                            </p>
                          </div>
                          {item.found && item.expected ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-green-700">
                              <Check className="h-3.5 w-3.5" />
                              Matched
                            </span>
                          ) : item.found ? (
                            <span className="shrink-0 text-xs font-medium text-amber-600">
                              Surplus
                            </span>
                          ) : (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-red-600">
                              <X className="h-3.5 w-3.5" />
                              Missing
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <ErrorBanner message={sheetError} />

              {/* Accepting is irreversible and writes off every expected unit
                  that was not scanned — on a full branch that is thousands of
                  units from one click. State the actual numbers before doing
                  it, because "Missing" only reads as a warning once you know
                  it is about to become a write-off. */}
              {confirmingAccept && (
                <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">
                    This will write off {variance(sheet).missing} unit
                    {variance(sheet).missing === 1 ? '' : 's'} that were not scanned
                    {variance(sheet).surplus > 0
                      ? `, and bring in ${variance(sheet).surplus} unexpected unit${
                          variance(sheet).surplus === 1 ? '' : 's'
                        }`
                      : ''}
                    . It cannot be undone.
                  </p>
                  {variance(sheet).missing > 0 &&
                    sheet.items.filter((i) => i.found).length === 0 && (
                      <p className="text-sm text-amber-800">
                        Nothing has been scanned yet — accepting now would empty this branch.
                      </p>
                    )}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAccept}
                      disabled={busy}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {busy ? 'Accepting…' : 'Yes, book the variance'}
                    </Button>
                    <Button variant="outline" onClick={() => setConfirmingAccept(false)}>
                      Go back
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSheet(null)}>
                  Close
                </Button>
                {sheet.status === 'in_progress' && canWrite && (
                  <Button
                    onClick={() => setConfirmingAccept(true)}
                    disabled={busy}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <ClipboardCheck className="mr-1 h-4 w-4" />
                    Accept and book variance
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
