'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Download, Link2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { api } from '@/lib/api';

// ── Types derived from the real DB schema ───────────────────────────────────

interface OrderStub {
  order_number: string;
  total_kes: number;
}

interface MpesaRow {
  id: string;
  mpesa_ref: string;
  customer_phone: string | null;
  amount_kes: number;
  order_id: string | null;
  status: string;
  received_at: string;
  order: OrderStub | null;
}

interface PesapalRow {
  id: string;
  pesapal_order_id: string;
  method: string | null;
  amount_kes: number | null;
  order_id: string | null;
  status: string | null;
  received_at: string;
  order: OrderStub | null;
}

interface CodOrder {
  id: string;
  order_number: string;
  total_kes: number;
  status: string;
  payment_status: string;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function fmtKes(n: number | null) {
  if (n == null) return '—';
  return n.toLocaleString('en-KE');
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === 'matched' || s === 'paid' || s === 'completed'
      ? 'bg-green-100 text-green-700'
      : s === 'failed'
        ? 'bg-red-100 text-red-700'
        : s === 'pending'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-amber-100 text-amber-700'; // unmatched / unknown

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

// ── Table skeleton ────────────────────────────────────────────────────────────

function TableSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-3 py-3">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Payments() {
  const [mpesa, setMpesa] = useState<MpesaRow[]>([]);
  const [pesapal, setPesapal] = useState<PesapalRow[]>([]);
  const [cod, setCod] = useState<CodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reconcile dialog state
  const [reconcileRow, setReconcileRow] = useState<MpesaRow | null>(null);
  const [reconcileOrderNum, setReconcileOrderNum] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // All data now flows through the NestJS API (system of record): the
      // unified payment ledger for M-Pesa/Pesapal, and the admin orders list
      // filtered to COD for the cash-on-delivery tab.
      const [mpesaRes, pesapalRes, codRes] = await Promise.all([
        api.admin.payments.list({ provider: 'mpesa', pageSize: 50 }),
        api.admin.payments.list({ provider: 'pesapal', pageSize: 50 }),
        api.admin.orders.list({ paymentMethod: 'cod', pageSize: 50 }),
      ]);

      setMpesa(
        mpesaRes.items.map((p) => ({
          id: p.id,
          mpesa_ref: p.reference,
          customer_phone: p.customerPhone,
          amount_kes: p.amountKes ?? 0,
          order_id: p.orderId,
          status: p.status,
          received_at: p.receivedAt,
          order: p.orderNumber ? { order_number: p.orderNumber, total_kes: 0 } : null,
        })),
      );
      setPesapal(
        pesapalRes.items.map((p) => ({
          id: p.id,
          pesapal_order_id: p.reference,
          method: p.method,
          amount_kes: p.amountKes,
          order_id: p.orderId,
          status: p.status,
          received_at: p.receivedAt,
          order: p.orderNumber ? { order_number: p.orderNumber, total_kes: 0 } : null,
        })),
      );
      setCod(
        codRes.data.map((o) => ({
          id: o.id,
          order_number: o.orderNumber,
          total_kes: o.totalKes,
          status: o.status,
          payment_status: o.paymentStatus,
          created_at: o.createdAt,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ── Computed summary ───────────────────────────────────────────────────────

  const totalCollected =
    mpesa
      .filter((r) => r.status === 'matched' || r.status === 'paid')
      .reduce((s, r) => s + r.amount_kes, 0) +
    pesapal
      .filter((r) => r.status === 'completed' || r.status === 'paid')
      .reduce((s, r) => s + (r.amount_kes ?? 0), 0);

  const pendingCount =
    mpesa.filter((r) => r.status === 'unmatched' || r.status === 'pending').length +
    pesapal.filter((r) => r.status === 'pending' || r.status === 'unmatched').length;

  const failedCount =
    mpesa.filter((r) => r.status === 'failed').length +
    pesapal.filter((r) => r.status === 'failed').length;

  const unmatchedMpesa = mpesa.filter((r) => !r.order_id);

  // ── Reconcile handler ─────────────────────────────────────────────────────

  function openReconcile(row: MpesaRow) {
    setReconcileRow(row);
    setReconcileOrderNum('');
    setReconcileError(null);
  }

  function closeReconcile() {
    setReconcileRow(null);
    setReconcileOrderNum('');
    setReconcileError(null);
  }

  function submitReconcile() {
    if (!reconcileRow || !reconcileOrderNum.trim()) return;
    setReconciling(true);
    setReconcileError(null);
    void (async () => {
      try {
        // The API links the orphan M-Pesa transaction to the order AND credits
        // it (sets payment_status=paid, advances status) in one server-side,
        // idempotent operation.
        await api.admin.payments.link(reconcileRow.id, {
          provider: 'mpesa',
          orderNumber: reconcileOrderNum.trim(),
        });
        closeReconcile();
        await fetchAll();
      } catch (err) {
        setReconcileError(err instanceof Error ? err.message : 'Reconcile failed');
      } finally {
        setReconciling(false);
      }
    })();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Payments & Reconciliation</h2>
        <p className="mt-1 text-gray-500">M-Pesa, Pesapal, and Cash on Delivery tracking</p>
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-3 shrink-0 rounded-full bg-green-600" />
              <div>
                <p className="text-sm text-gray-500">Total Collected</p>
                {loading ? (
                  <Skeleton className="mt-1 h-6 w-32" />
                ) : (
                  <p className="text-xl font-bold">KES {fmtKes(totalCollected)}</p>
                )}
                <p className="text-xs text-gray-400">M-Pesa + Pesapal matched</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-3 shrink-0 rounded-full bg-amber-500" />
              <div>
                <p className="text-sm text-gray-500">Pending / Unmatched</p>
                {loading ? (
                  <Skeleton className="mt-1 h-6 w-16" />
                ) : (
                  <p className="text-xl font-bold">{pendingCount}</p>
                )}
                <p className="text-xs text-gray-400">Transactions needing review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-3 shrink-0 rounded-full bg-red-500" />
              <div>
                <p className="text-sm text-gray-500">Failed</p>
                {loading ? (
                  <Skeleton className="mt-1 h-6 w-16" />
                ) : (
                  <p className="text-xl font-bold">{failedCount}</p>
                )}
                <p className="text-xs text-gray-400">Failed transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="mpesa">
        <TabsList>
          <TabsTrigger value="mpesa">
            M-Pesa Log
            {unmatchedMpesa.length > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">
                {unmatchedMpesa.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pesapal">Pesapal</TabsTrigger>
          <TabsTrigger value="cod">COD Tracking</TabsTrigger>
        </TabsList>

        {/* ── M-Pesa tab ── */}
        <TabsContent value="mpesa" className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {unmatchedMpesa.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4" />
                <span>
                  {unmatchedMpesa.length} unmatched M-Pesa transaction(s) require manual review
                </span>
              </div>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={fetchAll} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>M-Pesa Transaction Log</CardTitle>
              <CardDescription>Daraja STK Push transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Date
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        M-Pesa Ref
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Phone
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Amount (KES)
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Order #
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Action
                      </th>
                    </tr>
                  </thead>
                  {loading ? (
                    <TableSkeleton cols={7} />
                  ) : (
                    <tbody>
                      {mpesa.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-sm text-gray-400">
                            No M-Pesa transactions found
                          </td>
                        </tr>
                      ) : (
                        mpesa.map((t) => (
                          <tr
                            key={t.id}
                            className={`border-b ${!t.order_id ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                          >
                            <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">
                              {fmtDate(t.received_at)}
                            </td>
                            <td className="px-3 py-3 font-mono text-sm font-medium">
                              {t.mpesa_ref}
                            </td>
                            <td className="px-3 py-3 text-sm">{t.customer_phone ?? '—'}</td>
                            <td className="px-3 py-3 text-sm font-medium">
                              {fmtKes(t.amount_kes)}
                            </td>
                            <td className="px-3 py-3 text-sm font-medium text-[#141776]">
                              {t.order?.order_number ?? '—'}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                {t.order_id ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-amber-500" />
                                )}
                                <StatusBadge status={t.status} />
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              {!t.order_id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openReconcile(t)}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Link2 className="mr-1 h-3.5 w-3.5" />
                                  Reconcile
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
        </TabsContent>

        {/* ── Pesapal tab ── */}
        <TabsContent value="pesapal" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pesapal Transactions</CardTitle>
              <CardDescription>Card, Airtel Money, and bank transfer payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Date
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Pesapal Ref
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Method
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Amount (KES)
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Order #
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Status
                      </th>
                    </tr>
                  </thead>
                  {loading ? (
                    <TableSkeleton cols={6} />
                  ) : (
                    <tbody>
                      {pesapal.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                            No Pesapal transactions found
                          </td>
                        </tr>
                      ) : (
                        pesapal.map((t) => (
                          <tr key={t.id} className="border-b hover:bg-gray-50">
                            <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">
                              {fmtDate(t.received_at)}
                            </td>
                            <td className="px-3 py-3 font-mono text-sm font-medium text-[#141776]">
                              {t.pesapal_order_id}
                            </td>
                            <td className="px-3 py-3">
                              {t.method ? (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                  {t.method}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-3 py-3 text-sm font-medium">
                              {fmtKes(t.amount_kes)}
                            </td>
                            <td className="px-3 py-3 text-sm font-medium text-[#141776]">
                              {t.order?.order_number ?? '—'}
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge status={t.status ?? 'unknown'} />
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
        </TabsContent>

        {/* ── COD tab ── */}
        <TabsContent value="cod" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Cash on Delivery</CardTitle>
              <CardDescription>Orders placed with COD payment method</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Date
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Order #
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Amount (KES)
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Order Status
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                        Payment Status
                      </th>
                    </tr>
                  </thead>
                  {loading ? (
                    <TableSkeleton cols={5} />
                  ) : (
                    <tbody>
                      {cod.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                            No COD orders found
                          </td>
                        </tr>
                      ) : (
                        cod.map((c) => (
                          <tr key={c.id} className="border-b hover:bg-gray-50">
                            <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">
                              {fmtDate(c.created_at)}
                            </td>
                            <td className="px-3 py-3 text-sm font-medium text-[#141776]">
                              {c.order_number}
                            </td>
                            <td className="px-3 py-3 text-sm font-medium">{fmtKes(c.total_kes)}</td>
                            <td className="px-3 py-3">
                              <StatusBadge status={c.status} />
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge status={c.payment_status} />
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
        </TabsContent>
      </Tabs>

      {/* ── Reconcile dialog ── */}
      <Dialog open={!!reconcileRow} onOpenChange={(open) => !open && closeReconcile()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reconcile M-Pesa Transaction</DialogTitle>
            <DialogDescription>
              Link <span className="font-mono font-semibold">{reconcileRow?.mpesa_ref}</span> (KES{' '}
              {fmtKes(reconcileRow?.amount_kes ?? null)}) to an order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Order Number</label>
              <Input
                placeholder="e.g. ORD-00042"
                value={reconcileOrderNum}
                onChange={(e) => setReconcileOrderNum(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitReconcile()}
              />
            </div>
            {reconcileError && (
              <p className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {reconcileError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeReconcile} disabled={reconciling}>
                Cancel
              </Button>
              <Button
                onClick={submitReconcile}
                disabled={reconciling || !reconcileOrderNum.trim()}
                className="bg-[#141776] hover:bg-[#1a1f8f]"
              >
                {reconciling ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Linking…
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Link Order
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
