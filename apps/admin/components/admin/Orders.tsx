'use client';
import { useState, useEffect } from 'react';
import { Search, Eye, Download, CheckCircle, Loader2, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { api } from '@/lib/api';
import type { AdminOrderSummary, OrderDetail, OrderStatus } from '@optex/api-client';
import { formatKes } from '@optex/ui';
import { Skeleton } from '../ui/skeleton';
import { TableSkeleton } from '../ui/table-skeleton';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending_payment', label: 'Pending' },
  { key: 'received', label: 'Received' },
  { key: 'processing', label: 'Processing' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

// `cancelled` is deliberately absent: the generic status endpoint has no paid-
// order acknowledgement gate and no customer notification. Cancelling goes
// through the dedicated "Cancel order" action below instead (SPEC-06 R3/R5).
const DB_STATUSES: OrderStatus[] = [
  'pending_payment',
  'received',
  'processing',
  'dispatched',
  'delivered',
];
const STATUS_TIMELINE: OrderStatus[] = [
  'pending_payment',
  'received',
  'processing',
  'dispatched',
  'delivered',
];

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending',
  received: 'Received',
  processing: 'Processing',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const statusColors: Record<string, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-700',
  received: 'bg-indigo-100 text-indigo-700',
  processing: 'bg-blue-100 text-blue-700',
  dispatched: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const paymentLabels: Record<string, string> = {
  mpesa: 'M-Pesa',
  pesapal: 'Pesapal',
  cod: 'COD',
};

const paymentColors: Record<string, string> = {
  mpesa: 'bg-green-100 text-green-700',
  pesapal: 'bg-blue-100 text-blue-700',
  cod: 'bg-amber-100 text-amber-700',
};

/** Shipping jsonb persisted at checkout ({ name, phone, address, city, ... }). */
type ShippingJSON = {
  name?: string;
  phone?: string;
  city?: string;
};

function customerName(order: AdminOrderSummary) {
  return order.customer?.fullName?.trim() || '—';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function Orders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminOrderSummary | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');
  const [updating, setUpdating] = useState(false);

  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  // Frontend audit F-04. `count()` used to be `orders.filter(...).length` over
  // whatever the single `pageSize: 100` fetch happened to return, rendered in
  // the tab labels as if it were the total. Past 100 orders those numbers were
  // simply wrong — and wrong counts on an operations screen get acted on.
  //
  // The list endpoint returns an exact `total` alongside the page, so each
  // tab's count comes from its own status-filtered query with `pageSize: 1`:
  // the row payload is discarded, only the count is used. Seven small requests
  // once on mount, rather than one request and six wrong numbers.
  const [statusCounts, setStatusCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    api.admin.orders
      .list({ pageSize: 100 })
      .then((res) => setOrders(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const entries = await Promise.all(
          STATUS_TABS.map(async (tab) => {
            const res = await api.admin.orders.list({
              pageSize: 1,
              ...(tab.key === 'all' ? {} : { status: tab.key as OrderStatus }),
            });
            return [tab.key, res.total] as const;
          }),
        );
        if (!cancelled) setStatusCounts(Object.fromEntries(entries));
      } catch (e) {
        // Leave `statusCounts` null — `count()` falls back to the loaded page
        // rather than the tabs losing their numbers entirely.
        console.error('Could not load order status counts:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function openOrder(order: AdminOrderSummary) {
    setSelected(order);
    setNewStatus('');
    setDetail(null);
    setDetailLoading(true);
    setCancelling(false);
    setCancelReason('');
    setCancelError('');
    void (async () => {
      try {
        setDetail(await api.admin.orders.get(order.id));
      } catch (e) {
        console.error(e);
      } finally {
        setDetailLoading(false);
      }
    })();
  }

  async function handleStatusUpdate() {
    if (!selected || !newStatus) return;
    setUpdating(true);
    try {
      const updated = await api.admin.orders.updateStatus(selected.id, { status: newStatus });
      setDetail(updated);
      setOrders((prev) =>
        prev.map((o) => (o.id === selected.id ? { ...o, status: newStatus } : o)),
      );
      setSelected((prev) => (prev ? { ...prev, status: newStatus } : null));
      setNewStatus('');
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  async function handleCancelOrder(acknowledgePaid: boolean) {
    if (!selected) return;
    setCancelBusy(true);
    setCancelError('');
    try {
      await api.admin.orders.cancel(selected.id, {
        reason: cancelReason.trim() || undefined,
        acknowledgePaid,
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === selected.id ? { ...o, status: 'cancelled' } : o)),
      );
      setSelected((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
      setDetail((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
      setCancelling(false);
      setCancelReason('');
    } catch (e) {
      // The API returns a specific, readable reason — paid without
      // acknowledgement, a pending request already covering this order, or
      // an order already decided. Show that, not a generic failure.
      setCancelError(e instanceof Error ? e.message : 'Could not cancel that order.');
    } finally {
      setCancelBusy(false);
    }
  }

  const filtered = orders.filter((o) => {
    const name = customerName(o).toLowerCase();
    const matchSearch =
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.includes(searchTerm.toLowerCase());
    const matchTab = activeTab === 'all' || o.status === activeTab;
    return matchSearch && matchTab;
  });

  // Server totals when they resolved; otherwise the loaded page, which is at
  // least never larger than the truth.
  const count = (key: string) =>
    statusCounts?.[key] ??
    (key === 'all' ? orders.length : orders.filter((o) => o.status === key).length);
  const statusIndex = (s: string) => STATUS_TIMELINE.indexOf(s as OrderStatus);

  const detailShipping = (detail?.shipping as ShippingJSON | null) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
          <p className="mt-1 text-gray-500">Track and manage all customer orders</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Order List</CardTitle>
              <CardDescription>{filtered.length} orders</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                      Order ID
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                      Customer
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                      Amount (KES)
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                      Payment
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                      Status
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <TableSkeleton cols={7} />
              </table>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-auto flex-wrap gap-1">
                {STATUS_TABS.map((t) => (
                  <TabsTrigger key={t.key} value={t.key}>
                    {t.label} ({count(t.key)})
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                {filtered.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">No orders found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                            Order ID
                          </th>
                          <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                            Customer
                          </th>
                          <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                            Date
                          </th>
                          <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                            Amount (KES)
                          </th>
                          <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                            Payment
                          </th>
                          <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                            Status
                          </th>
                          <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((order) => (
                          <tr key={order.id} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-3 text-sm font-medium text-[#141776]">
                              {order.orderNumber}
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-sm font-medium">{customerName(order)}</div>
                              <div className="text-xs text-gray-500">
                                {order.customer?.phone ?? '—'}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-600">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="px-3 py-3 text-sm font-medium">
                              {Number(order.totalKes).toLocaleString()}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${paymentColors[order.paymentMethod ?? ''] ?? 'bg-gray-100 text-gray-600'}`}
                              >
                                {paymentLabels[order.paymentMethod ?? ''] ??
                                  order.paymentMethod ??
                                  '—'}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[order.status] ?? 'bg-gray-100 text-gray-600'}`}
                              >
                                {STATUS_LABELS[order.status] ?? order.status}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openOrder(order)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order {selected?.orderNumber}</DialogTitle>
            <DialogDescription>Full order details and status management</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              {/* Customer info */}
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
                <div>
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-medium">{customerName(selected)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Contact</p>
                  <p className="font-medium">
                    {selected.customer?.phone ?? detailShipping?.phone ?? '—'}
                  </p>
                  <p className="text-sm text-gray-500">{detailShipping?.city ?? ''}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-medium">{formatDate(selected.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment Method</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${paymentColors[selected.paymentMethod ?? ''] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {paymentLabels[selected.paymentMethod ?? ''] ?? selected.paymentMethod ?? '—'}
                  </span>
                  <p className="mt-1 text-xs text-gray-400">Payment: {selected.paymentStatus}</p>
                </div>
              </div>

              {/* Order items */}
              <div>
                <p className="mb-2 font-medium">Order Items</p>
                {detailLoading || !detail ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : detail.items.length === 0 ? (
                  <p className="rounded-lg border p-4 text-sm text-gray-400">No items found.</p>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {detail.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between p-4">
                        <div>
                          <p className="font-medium">{item.product?.name ?? 'Unknown product'}</p>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {item.product?.brand ? `${item.product.brand} · ` : ''}Qty:{' '}
                            {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold">{formatKes(item.lineTotalKes)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {detail && (
                  <div className="mt-3 flex justify-end border-t pt-3">
                    <div className="space-y-1 text-right">
                      <p className="text-sm text-gray-500">
                        Subtotal: {formatKes(Number(detail.subtotalKes))}
                      </p>
                      {detail.discountKes > 0 && (
                        <p className="text-sm text-gray-500">
                          Discount: −{formatKes(Number(detail.discountKes))}
                        </p>
                      )}
                      <p className="text-sm text-gray-500">
                        VAT (16%): {formatKes(Number(detail.vatKes))}
                      </p>
                      <p className="text-sm text-gray-500">
                        Shipping: {formatKes(Number(detail.shippingKes))}
                      </p>
                      <p className="text-lg font-bold">
                        Total: {formatKes(Number(detail.totalKes))}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status timeline */}
              {selected.status !== 'cancelled' && (
                <div>
                  <p className="mb-3 font-medium">Status Timeline</p>
                  <div className="flex items-center gap-2">
                    {STATUS_TIMELINE.map((s, i) => {
                      const current = statusIndex(selected.status);
                      const done = i <= current;
                      const active = i === current;
                      return (
                        <div key={s} className="flex flex-1 items-center gap-2">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-full ${done ? 'bg-[#141776]' : 'bg-gray-200'}`}
                            >
                              {done && <CheckCircle className="h-4 w-4 text-white" />}
                            </div>
                            <span
                              className={`text-center text-xs ${active ? 'font-semibold text-[#141776]' : done ? 'text-gray-700' : 'text-gray-400'}`}
                            >
                              {STATUS_LABELS[s]}
                            </span>
                          </div>
                          {i < STATUS_TIMELINE.length - 1 && (
                            <div
                              className={`mb-4 h-0.5 flex-1 ${i < current ? 'bg-[#141776]' : 'bg-gray-200'}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Update status */}
              <div className="flex items-center gap-3 border-t pt-4">
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Update status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DB_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleStatusUpdate}
                  disabled={!newStatus || newStatus === selected.status || updating}
                  className="bg-[#141776] hover:bg-[#0f1258]"
                >
                  {updating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Update'
                  )}
                </Button>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>

              {/* Cancel order — SPEC-06 R3, the phone-call path: a customer
                  who called or walked in rather than using the app still gets
                  the same protections as a request approved through
                  Cancellations — the paid-order acknowledgement, never a
                  refund initiated here. */}
              {selected.status !== 'cancelled' && selected.status !== 'delivered' && (
                <div className="border-t pt-4">
                  {!cancelling ? (
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setCancelling(true)}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel order
                    </Button>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/60 p-4">
                      <p className="text-sm font-medium text-red-800">Cancel this order</p>
                      <p className="text-xs text-red-700">
                        For a cancellation asked for by phone or in person, not through the
                        customer&apos;s own request.
                      </p>
                      <Textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Why is this order being cancelled? Shown to the customer."
                        rows={2}
                      />
                      {cancelError && (
                        <p className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-800">
                          {cancelError}
                        </p>
                      )}
                      {selected.paymentStatus === 'paid' && (
                        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            This order has been paid. Cancelling does <strong>not</strong> refund
                            the customer — Optex policy is no automatic refunds, and nothing here
                            contacts M-Pesa or Pesapal. If money is to go back, arrange it yourself.
                          </span>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCancelling(false);
                            setCancelError('');
                          }}
                        >
                          Never mind
                        </Button>
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700"
                          disabled={cancelBusy}
                          onClick={() => handleCancelOrder(selected.paymentStatus === 'paid')}
                        >
                          {cancelBusy ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Cancelling...
                            </>
                          ) : selected.paymentStatus === 'paid' ? (
                            'I understand — cancel the order'
                          ) : (
                            'Cancel order'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
