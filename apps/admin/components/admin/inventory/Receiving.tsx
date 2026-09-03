'use client';

/**
 * Goods-received notes — CR-01 R2 sub-phase 2e.
 *
 * A GRN is the only way new stock enters the system. It has two stages, and
 * the split matters: `create` records what was *ordered* from a supplier
 * (product, unit cost, quantity) and leaves the note in `draft`, changing no
 * stock at all. `post` supplies the physical serial numbers that actually
 * arrived and is what mints `product_serials` rows and moves stock. A draft
 * can be corrected; a posted note cannot, which is why posting asks for
 * explicit confirmation.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, PackageCheck, Trash2 } from 'lucide-react';
import type { Grn, Product, Supplier } from '@optex/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
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

interface DraftLine {
  product_id: string;
  unit_cost_kes: string;
  quantity_ordered: string;
}

const BLANK_LINE: DraftLine = { product_id: '', unit_cost_kes: '', quantity_ordered: '' };

export function Receiving() {
  const { user, hasPermission } = useCurrentUser();
  const canWrite = hasPermission('inventory.receive');
  const { branches } = useBranches(user?.branchId ?? null);

  const [grns, setGrns] = useState<Grn[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ ...BLANK_LINE }]);
  const [saving, setSaving] = useState(false);

  const [postTarget, setPostTarget] = useState<Grn | null>(null);
  const [serialInputs, setSerialInputs] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const reload = useCallback(async () => {
    try {
      setGrns(await api.admin.grn.list());
      setError('');
    } catch (e) {
      console.error('grn list failed:', e);
      setError(errorMessage(e, 'Could not load goods-received notes.'));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      // Suppliers need `suppliers.manage`, which Inventory Manager may not
      // hold — a failure there must not blank the whole page, so each of
      // these settles independently.
      const [grnRes, supplierRes, productRes] = await Promise.allSettled([
        api.admin.grn.list(),
        api.admin.suppliers.list(true),
        api.admin.products.listAll({ page: 1, limit: 100 }),
      ]);
      if (grnRes.status === 'fulfilled') setGrns(grnRes.value);
      else setError(errorMessage(grnRes.reason, 'Could not load goods-received notes.'));
      if (supplierRes.status === 'fulfilled') setSuppliers(supplierRes.value);
      if (productRes.status === 'fulfilled') setProducts(productRes.value.items);
      setLoading(false);
    })();
  }, []);

  function resetForm() {
    setSupplierId('');
    setBranchId(user?.branchId ?? '');
    setNotes('');
    setLines([{ ...BLANK_LINE }]);
  }

  async function handleCreate() {
    const items = lines
      .filter((l) => l.product_id && l.quantity_ordered)
      .map((l) => ({
        product_id: l.product_id,
        unit_cost_kes: Number(l.unit_cost_kes || 0),
        quantity_ordered: Number(l.quantity_ordered),
      }));
    if (!supplierId || !branchId || items.length === 0) {
      setError('Pick a supplier, a branch, and at least one product line.');
      return;
    }
    if (items.some((i) => !Number.isFinite(i.quantity_ordered) || i.quantity_ordered < 1)) {
      setError('Every line needs a quantity of at least 1.');
      return;
    }
    setSaving(true);
    try {
      await api.admin.grn.create({
        supplier_id: supplierId,
        branch_id: branchId,
        notes: notes || undefined,
        items,
      });
      setCreateOpen(false);
      resetForm();
      await reload();
    } catch (e) {
      console.error('grn create failed:', e);
      setError(errorMessage(e, 'Could not create the goods-received note.'));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Posting needs one serial per unit ordered. The textarea takes them
   * newline- or comma-separated, because they are realistically pasted from a
   * scanner or a supplier's packing list rather than typed one at a time.
   */
  function parseSerials(raw: string): string[] {
    return raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const postSerialCounts = postTarget
    ? postTarget.items.map((item) => ({
        item,
        entered: parseSerials(serialInputs[item.id] ?? '').length,
      }))
    : [];
  const postReady =
    postSerialCounts.length > 0 &&
    postSerialCounts.every((c) => c.entered === c.item.quantity_ordered);

  async function handlePost() {
    if (!postTarget) return;
    setPosting(true);
    setPostError('');
    try {
      const serials = postTarget.items.flatMap((item) =>
        parseSerials(serialInputs[item.id] ?? '').map((serial_number) => ({
          grn_item_id: item.id,
          serial_number,
        })),
      );
      await api.admin.grn.post(postTarget.id, { serials });
      setPostTarget(null);
      setSerialInputs({});
      await reload();
    } catch (e) {
      console.error('grn post failed:', e);
      // Duplicate serial numbers are the common rejection here, and the API's
      // message names the offending one — keep the dialog open so the admin
      // can fix that line instead of retyping every serial.
      setPostError(errorMessage(e, 'Could not post the note.'));
    } finally {
      setPosting(false);
    }
  }

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? '—';
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Goods Received</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Record a supplier delivery, then post its serial numbers to bring the stock in.
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
            className="bg-[#141776] hover:bg-[#0f1258]"
          >
            <Plus className="mr-1 h-4 w-4" />
            New GRN
          </Button>
        )}
      </div>

      {!canWrite && <ReadOnlyNotice action="receive stock" />}
      <ErrorBanner message={error} />

      <Card>
        <CardHeader>
          <CardTitle>Goods-Received Notes</CardTitle>
          <CardDescription>{loading ? 'Loading…' : `${grns.length} notes`}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {['GRN #', 'Supplier', 'Branch', 'Lines', 'Units', 'Status', 'Created', ''].map(
                    (h) => (
                      <th key={h} className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton rows={4} cols={8} />
              ) : (
                <tbody>
                  {grns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-sm text-gray-500">
                        No goods-received notes yet. Create one to bring stock in.
                      </td>
                    </tr>
                  ) : (
                    grns.map((grn) => (
                      <tr key={grn.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-3 font-mono text-sm font-medium text-[#141776]">
                          {grn.grn_number}
                        </td>
                        <td className="px-3 py-3 text-sm">{supplierName(grn.supplier_id)}</td>
                        <td className="px-3 py-3 text-sm">{branchName(grn.branch_id)}</td>
                        <td className="px-3 py-3 text-sm">{grn.items.length}</td>
                        <td className="px-3 py-3 text-sm">
                          {grn.items.reduce((n, i) => n + i.quantity_ordered, 0)}
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill status={grn.status} />
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-500">
                          {formatDateTime(grn.created_at)}
                        </td>
                        <td className="px-3 py-3">
                          {grn.status === 'draft' && canWrite && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setPostTarget(grn);
                                setSerialInputs({});
                                setPostError('');
                              }}
                              className="h-7 bg-green-600 px-2 text-xs hover:bg-green-700"
                            >
                              <PackageCheck className="mr-1 h-3 w-3" />
                              Post
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

      {/* Create draft */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Goods-Received Note</DialogTitle>
            <DialogDescription>
              Saved as a draft — no stock moves until you post the serial numbers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={suppliers.length ? 'Select supplier' : 'No suppliers available'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Receiving branch</Label>
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
            </div>

            <div className="space-y-2">
              <Label>Lines</Label>
              {lines.map((line, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={line.product_id}
                      onValueChange={(v) =>
                        setLines((prev) =>
                          prev.map((l, j) => (j === i ? { ...l, product_id: v } : l)),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.sku}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    className="w-28"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit cost"
                    value={line.unit_cost_kes}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, j) => (j === i ? { ...l, unit_cost_kes: e.target.value } : l)),
                      )
                    }
                  />
                  <Input
                    className="w-20"
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={line.quantity_ordered}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, j) =>
                          j === i ? { ...l, quantity_ordered: e.target.value } : l,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-red-500"
                    title="Remove line"
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
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
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Delivery note number, condition on arrival…"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving}
                className="bg-[#141776] hover:bg-[#0f1258]"
              >
                {saving ? 'Saving…' : 'Save draft'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post serials */}
      <Dialog open={!!postTarget} onOpenChange={() => setPostTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post {postTarget?.grn_number}</DialogTitle>
            <DialogDescription>
              Enter one serial number per unit received, separated by new lines or commas. Posting
              creates the stock and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {postTarget && (
            <div className="space-y-4 py-1">
              {postSerialCounts.map(({ item, entered }) => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label>
                      {item.product_name ?? 'Product'}{' '}
                      <span className="font-mono text-xs text-gray-500">{item.product_sku}</span>
                    </Label>
                    <span
                      className={`text-xs font-medium ${
                        entered === item.quantity_ordered ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {entered} / {item.quantity_ordered}
                    </span>
                  </div>
                  <Textarea
                    rows={3}
                    className="font-mono text-sm"
                    value={serialInputs[item.id] ?? ''}
                    onChange={(e) =>
                      setSerialInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder={`${item.quantity_ordered} serial numbers`}
                  />
                </div>
              ))}
              <ErrorBanner message={postError} />
              {!postReady && (
                <p className="text-sm text-gray-500">
                  Every line needs exactly as many serials as units ordered before you can post.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPostTarget(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handlePost}
                  disabled={!postReady || posting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {posting ? 'Posting…' : 'Post and receive stock'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
