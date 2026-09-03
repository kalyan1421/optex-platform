'use client';

/**
 * Branch-to-branch stock transfers — CR-01 R2 sub-phase 2e.
 *
 * A transfer moves named units, not a quantity: you dispatch specific
 * `serial_ids` out of the source branch, and the destination later confirms
 * which of them physically arrived. Units that never turn up are received as
 * `lost` with a reason code, so shrinkage is recorded rather than silently
 * absorbed — that asymmetry is the whole point of the two-step flow.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Plus, PackageCheck } from 'lucide-react';
import type { AdjustmentReason, InventorySerial, Transfer } from '@optex/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
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

export function Transfers() {
  const { user, hasPermission } = useCurrentUser();
  const canWrite = hasPermission('inventory.transfer');
  // Dispatching needs both ends, so this picker deliberately lists every
  // branch even for a branch-scoped user — the API still enforces that they
  // may only send *from* their own.
  const { branches } = useBranches(null);

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [reasons, setReasons] = useState<AdjustmentReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [fromBranch, setFromBranch] = useState('');
  const [toBranch, setToBranch] = useState('');
  const [notes, setNotes] = useState('');
  const [serials, setSerials] = useState<InventorySerial[]>([]);
  const [serialsLoading, setSerialsLoading] = useState(false);
  const [serialFilter, setSerialFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [receiveTarget, setReceiveTarget] = useState<Transfer | null>(null);
  /** serial_id → 'received' | reason code for a loss. */
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState('');

  const reload = useCallback(async () => {
    try {
      setTransfers(await api.admin.transfers.list());
      setError('');
    } catch (e) {
      console.error('transfer list failed:', e);
      setError(errorMessage(e, 'Could not load transfers.'));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const [tRes, rRes] = await Promise.allSettled([
        api.admin.transfers.list(),
        api.admin.adjustments.listReasons(),
      ]);
      if (tRes.status === 'fulfilled') setTransfers(tRes.value);
      else setError(errorMessage(tRes.reason, 'Could not load transfers.'));
      // Reasons need `inventory.adjust`; without them the receive dialog can
      // still mark units received, just not record a loss.
      if (rRes.status === 'fulfilled') setReasons(rRes.value);
      setLoading(false);
    })();
  }, []);

  // Changing branch invalidates the selection — those serials are no longer
  // the ones on offer.
  useEffect(() => {
    setSelected(new Set());
  }, [fromBranch]);

  /**
   * Load what the source branch is holding, filtering server-side.
   *
   * A branch can hold tens of thousands of units and the endpoint caps a page
   * at 500, so filtering client-side silently hid anything outside the oldest
   * 500 — including stock that had just been received. Debounced so typing a
   * serial does not fire a request per keystroke.
   */
  useEffect(() => {
    if (!fromBranch) {
      setSerials([]);
      return;
    }
    let cancelled = false;
    setSerialsLoading(true);
    const timer = setTimeout(() => {
      api.admin.inventory
        .serials({
          branchId: fromBranch,
          search: serialFilter.trim() || undefined,
          limit: 500,
        })
        .then((rows) => {
          if (!cancelled) setSerials(rows);
        })
        .catch((e) => {
          if (cancelled) return;
          console.error('serial lookup failed:', e);
          setSerials([]);
        })
        .finally(() => {
          if (!cancelled) setSerialsLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fromBranch, serialFilter]);

  // The server has already matched on serial number; a query that looks like a
  // product name would otherwise return nothing, so widen locally rather than
  // narrow. Anything the server returned stays visible.
  const visibleSerials = serials;

  async function handleDispatch() {
    if (!fromBranch || !toBranch || selected.size === 0) {
      setError('Pick a source branch, a destination, and at least one unit.');
      return;
    }
    if (fromBranch === toBranch) {
      setError('Source and destination must be different branches.');
      return;
    }
    setSaving(true);
    try {
      await api.admin.transfers.dispatch({
        from_branch_id: fromBranch,
        to_branch_id: toBranch,
        serial_ids: [...selected],
        notes: notes || undefined,
      });
      setDispatchOpen(false);
      setFromBranch('');
      setToBranch('');
      setNotes('');
      setSelected(new Set());
      await reload();
    } catch (e) {
      console.error('dispatch failed:', e);
      setError(errorMessage(e, 'Could not dispatch the transfer.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleReceive() {
    if (!receiveTarget) return;
    setReceiving(true);
    setReceiveError('');
    try {
      const inTransit = receiveTarget.items.filter((i) => i.status === 'in_transit');
      const received = inTransit
        .filter((i) => (outcomes[i.serial_id] ?? 'received') === 'received')
        .map((i) => i.serial_id);
      const lost = inTransit
        .filter((i) => outcomes[i.serial_id] && outcomes[i.serial_id] !== 'received')
        .map((i) => ({ serial_id: i.serial_id, reason_code: outcomes[i.serial_id] }));
      await api.admin.transfers.receive(receiveTarget.id, { received, lost });
      setReceiveTarget(null);
      setOutcomes({});
      await reload();
    } catch (e) {
      console.error('receive failed:', e);
      setReceiveError(errorMessage(e, 'Could not receive the transfer.'));
    } finally {
      setReceiving(false);
    }
  }

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Transfers</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Move specific units between branches, then confirm what arrived.
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setFromBranch(user?.branchId ?? '');
              setDispatchOpen(true);
            }}
            className="bg-[#141776] hover:bg-[#0f1258]"
          >
            <Plus className="mr-1 h-4 w-4" />
            New Transfer
          </Button>
        )}
      </div>

      {!canWrite && <ReadOnlyNotice action="move stock between branches" />}
      <ErrorBanner message={error} />

      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
          <CardDescription>
            {loading ? 'Loading…' : `${transfers.length} transfers`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {['Transfer #', 'Route', 'Units', 'Status', 'Dispatched', 'Received', ''].map(
                    (h) => (
                      <th key={h} className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton rows={4} cols={7} />
              ) : (
                <tbody>
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-500">
                        No transfers yet.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-3 font-mono text-sm font-medium text-[#141776]">
                          {t.transfer_number}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            {branchName(t.from_branch_id)}
                            <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                            {branchName(t.to_branch_id)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm">{t.items.length}</td>
                        <td className="px-3 py-3">
                          <StatusPill status={t.status} />
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-500">
                          {formatDateTime(t.dispatched_at)}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-500">
                          {formatDateTime(t.received_at)}
                        </td>
                        <td className="px-3 py-3">
                          {t.status === 'in_transit' && canWrite && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setReceiveTarget(t);
                                setOutcomes({});
                                setReceiveError('');
                              }}
                              className="h-7 bg-green-600 px-2 text-xs hover:bg-green-700"
                            >
                              <PackageCheck className="mr-1 h-3 w-3" />
                              Receive
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dispatch */}
      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Transfer</DialogTitle>
            <DialogDescription>
              Choose the units leaving the source branch. They stay in transit until the destination
              receives them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Select value={fromBranch} onValueChange={setFromBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Source branch" />
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
              <div className="space-y-1.5">
                <Label>To</Label>
                <Select value={toBranch} onValueChange={setToBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Destination branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches
                      .filter((b) => b.id !== fromBranch)
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label>Units to send</Label>
                <span className="text-xs text-gray-500">{selected.size} selected</span>
              </div>
              <Input
                placeholder="Search by serial number"
                value={serialFilter}
                onChange={(e) => setSerialFilter(e.target.value)}
                disabled={!fromBranch}
              />
              <div className="max-h-64 overflow-y-auto rounded-md border">
                {!fromBranch ? (
                  <p className="p-4 text-sm text-gray-500">Pick a source branch first.</p>
                ) : serialsLoading ? (
                  <p className="p-4 text-sm text-gray-500">Loading units…</p>
                ) : visibleSerials.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">
                    No in-stock units match at this branch.
                  </p>
                ) : (
                  <ul>
                    {visibleSerials.map((s) => (
                      <li key={s.serial_id} className="border-b last:border-b-0">
                        {/* Radix's Checkbox renders a <button>, not a native
                            input, so the label is tied to it by id rather than
                            by nesting — otherwise clicking the text does
                            nothing and screen readers announce no name. */}
                        <label
                          htmlFor={`serial-${s.serial_id}`}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50"
                        >
                          <Checkbox
                            id={`serial-${s.serial_id}`}
                            checked={selected.has(s.serial_id)}
                            onCheckedChange={(checked) =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(s.serial_id);
                                else next.delete(s.serial_id);
                                return next;
                              })
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{s.product_name}</span>
                            <span className="block truncate font-mono text-xs text-gray-500">
                              {s.serial_number}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {serials.length >= 500 && (
                <p className="text-xs text-gray-500">
                  Showing the 500 oldest matching units. Search to narrow down.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Courier, expected arrival…"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDispatchOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDispatch}
                disabled={saving || selected.size === 0 || !toBranch}
                className="bg-[#141776] hover:bg-[#0f1258]"
              >
                {saving ? 'Dispatching…' : `Dispatch ${selected.size} unit(s)`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receive */}
      <Dialog open={!!receiveTarget} onOpenChange={() => setReceiveTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive {receiveTarget?.transfer_number}</DialogTitle>
            <DialogDescription>
              Units default to received. Mark anything that did not arrive with a reason so the loss
              is recorded.
            </DialogDescription>
          </DialogHeader>
          {receiveTarget && (
            <div className="space-y-4 py-1">
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {receiveTarget.items
                  .filter((i) => i.status === 'in_transit')
                  .map((item) => (
                    <li
                      key={item.serial_id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{item.product_name ?? 'Unit'}</p>
                        <p className="truncate font-mono text-xs text-gray-500">
                          {item.serial_number}
                        </p>
                      </div>
                      <Select
                        value={outcomes[item.serial_id] ?? 'received'}
                        onValueChange={(v) =>
                          setOutcomes((prev) => ({ ...prev, [item.serial_id]: v }))
                        }
                      >
                        <SelectTrigger className="w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="received">Received</SelectItem>
                          {reasons.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              Not arrived — {r.id.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </li>
                  ))}
              </ul>
              <ErrorBanner message={receiveError} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReceiveTarget(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleReceive}
                  disabled={receiving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {receiving ? 'Receiving…' : 'Confirm receipt'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
