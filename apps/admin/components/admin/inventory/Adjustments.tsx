'use client';

/**
 * Stock adjustments — CR-01 R2 sub-phase 2e.
 *
 * This is the surface that answers "the number on the shelf is wrong, fix it".
 * R2 deliberately removed direct stock edits, so a correction is expressed as
 * units added or removed *with a reason*, never as a new total typed over the
 * old one. `add` mints a unit for a product (something found that the system
 * had no record of); `remove` writes off one specific serial (damaged, lost,
 * returned to supplier). Every line lands in the ledger and the audit log.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, MinusCircle, PlusCircle } from 'lucide-react';
import type { AdjustmentReason, Adjustment, InventorySerial, Product } from '@optex/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
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
import { ErrorBanner, ReadOnlyNotice, errorMessage, formatDateTime, useBranches } from './shared';

interface DraftLine {
  direction: 'add' | 'remove';
  /** For `remove` — the specific unit being written off. */
  serial_id: string;
  /** For `add` — the product a newly-found unit belongs to. */
  product_id: string;
  reason_code: string;
}

const BLANK_LINE: DraftLine = {
  direction: 'remove',
  serial_id: '',
  product_id: '',
  reason_code: '',
};

export function Adjustments() {
  const { user, hasPermission } = useCurrentUser();
  const canWrite = hasPermission('inventory.adjust');
  const { branches } = useBranches(user?.branchId ?? null);

  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [reasons, setReasons] = useState<AdjustmentReason[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ ...BLANK_LINE }]);
  const [serials, setSerials] = useState<InventorySerial[]>([]);
  const [serialsLoading, setSerialsLoading] = useState(false);
  const [serialSearch, setSerialSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      setAdjustments(await api.admin.adjustments.list());
      setError('');
    } catch (e) {
      console.error('adjustment list failed:', e);
      setError(errorMessage(e, 'Could not load adjustments.'));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const [aRes, rRes, pRes] = await Promise.allSettled([
        api.admin.adjustments.list(),
        api.admin.adjustments.listReasons(),
        api.admin.products.listAll({ page: 1, limit: 100 }),
      ]);
      if (aRes.status === 'fulfilled') setAdjustments(aRes.value);
      else setError(errorMessage(aRes.reason, 'Could not load adjustments.'));
      if (rRes.status === 'fulfilled') setReasons(rRes.value);
      if (pRes.status === 'fulfilled') setProducts(pRes.value.items);
      setLoading(false);
    })();
  }, []);

  /**
   * A `remove` line names a serial, so the picker needs the units actually
   * sitting at the chosen branch. Searched server-side and debounced: a branch
   * holds far more units than one page, so a purely local filter cannot reach
   * the unit being written off.
   */
  useEffect(() => {
    if (!branchId) {
      setSerials([]);
      return;
    }
    let cancelled = false;
    setSerialsLoading(true);
    const timer = setTimeout(() => {
      api.admin.inventory
        .serials({ branchId, search: serialSearch.trim() || undefined, limit: 500 })
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
  }, [branchId, serialSearch]);

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  const linesValid =
    lines.length > 0 &&
    lines.every(
      (l) => l.reason_code && (l.direction === 'remove' ? !!l.serial_id : !!l.product_id),
    );

  async function handleSubmit() {
    if (!branchId || !linesValid) {
      setError('Pick a branch, and give every line a reason and a target.');
      return;
    }
    setSaving(true);
    try {
      await api.admin.adjustments.create({
        branch_id: branchId,
        notes: notes || undefined,
        items: lines.map((l) =>
          l.direction === 'remove'
            ? { direction: 'remove' as const, serial_id: l.serial_id, reason_code: l.reason_code }
            : { direction: 'add' as const, product_id: l.product_id, reason_code: l.reason_code },
        ),
      });
      setOpen(false);
      setNotes('');
      setLines([{ ...BLANK_LINE }]);
      await reload();
    } catch (e) {
      console.error('adjustment failed:', e);
      setError(errorMessage(e, 'Could not record the adjustment.'));
    } finally {
      setSaving(false);
    }
  }

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Adjustments</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Correct stock by adding or writing off units. Every change needs a reason.
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setBranchId(user?.branchId ?? '');
              setLines([{ ...BLANK_LINE }]);
              setOpen(true);
            }}
            className="bg-[#141776] hover:bg-[#0f1258]"
          >
            <Plus className="mr-1 h-4 w-4" />
            New Adjustment
          </Button>
        )}
      </div>

      {!canWrite && <ReadOnlyNotice action="adjust stock" />}
      <ErrorBanner message={error} />

      <Card>
        <CardHeader>
          <CardTitle>Adjustment History</CardTitle>
          <CardDescription>
            {loading ? 'Loading…' : `${adjustments.length} adjustments`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {['Date', 'Branch', 'Units', 'Reasons', 'Notes'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton rows={4} cols={5} />
              ) : (
                <tbody>
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-500">
                        No adjustments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((adj) => {
                      const added = adj.items.filter((i) => i.direction === 'add').length;
                      const removed = adj.items.filter((i) => i.direction === 'remove').length;
                      const codes = [...new Set(adj.items.map((i) => i.reason_code))];
                      return (
                        <tr key={adj.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-3 text-sm">{formatDateTime(adj.created_at)}</td>
                          <td className="px-3 py-3 text-sm">{branchName(adj.branch_id)}</td>
                          <td className="px-3 py-3 text-sm">
                            <span className="inline-flex items-center gap-3">
                              {added > 0 && (
                                <span className="inline-flex items-center gap-1 text-green-700">
                                  <PlusCircle className="h-3.5 w-3.5" />
                                  {added}
                                </span>
                              )}
                              {removed > 0 && (
                                <span className="inline-flex items-center gap-1 text-red-600">
                                  <MinusCircle className="h-3.5 w-3.5" />
                                  {removed}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">
                            {codes.map((c) => c.replace(/_/g, ' ')).join(', ')}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-500">{adj.notes ?? '—'}</td>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Adjustment</DialogTitle>
            <DialogDescription>
              Stock is derived from units, so a correction adds or writes off specific units rather
              than overwriting a total.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
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

            {lines.some((l) => l.direction === 'remove') && (
              <div className="space-y-1.5">
                <Label htmlFor="adjustment-serial-search">Find unit by serial</Label>
                <Input
                  id="adjustment-serial-search"
                  value={serialSearch}
                  onChange={(e) => setSerialSearch(e.target.value)}
                  placeholder="Narrows the unit list below"
                  disabled={!branchId}
                />
              </div>
            )}

            <div className="space-y-3">
              <Label>Lines</Label>
              {lines.map((line, i) => (
                <div key={i} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Select
                      value={line.direction}
                      onValueChange={(v) =>
                        updateLine(i, {
                          direction: v as 'add' | 'remove',
                          serial_id: '',
                          product_id: '',
                        })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="remove">Remove unit</SelectItem>
                        <SelectItem value="add">Add found unit</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-9 w-9 text-red-500"
                      title="Remove line"
                      disabled={lines.length === 1}
                      onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {line.direction === 'remove' ? (
                    <Select
                      value={line.serial_id}
                      onValueChange={(v) => updateLine(i, { serial_id: v })}
                      disabled={!branchId || serialsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !branchId
                              ? 'Pick a branch first'
                              : serialsLoading
                                ? 'Loading units…'
                                : serials.length === 0
                                  ? 'No units at this branch'
                                  : 'Select the unit to write off'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {serials.slice(0, 200).map((s) => (
                          <SelectItem key={s.serial_id} value={s.serial_id}>
                            {s.product_name} · {s.serial_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={line.product_id}
                      onValueChange={(v) => updateLine(i, { product_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Product this unit belongs to" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.sku}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Select
                    value={line.reason_code}
                    onValueChange={(v) => updateLine(i, { reason_code: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {reasons.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, { ...BLANK_LINE }])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add line
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context for the audit log"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !branchId || !linesValid}
                className="bg-[#141776] hover:bg-[#0f1258]"
              >
                {saving ? 'Recording…' : 'Record adjustment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
