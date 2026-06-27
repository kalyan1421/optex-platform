'use client'
import { useState, useEffect } from 'react';
import { Search, Eye, Download, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { api } from '@/lib/api';
import type { AdminOrderSummary, OrderDetail, OrderStatus } from '@optex/api-client';
import { formatKes } from '@optex/ui';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending_payment', label: 'Pending' },
  { key: 'received', label: 'Received' },
  { key: 'processing', label: 'Processing' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const DB_STATUSES: OrderStatus[] = ['pending_payment', 'received', 'processing', 'dispatched', 'delivered', 'cancelled'];
const STATUS_TIMELINE: OrderStatus[] = ['pending_payment', 'received', 'processing', 'dispatched', 'delivered'];

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
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
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

  useEffect(() => {
    api.admin.orders
      .list({ pageSize: 100 })
      .then((res) => setOrders(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openOrder(order: AdminOrderSummary) {
    setSelected(order);
    setNewStatus('');
    setDetail(null);
    setDetailLoading(true);
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
      setOrders(prev => prev.map(o => (o.id === selected.id ? { ...o, status: newStatus } : o)));
      setSelected(prev => (prev ? { ...prev, status: newStatus } : null));
      setNewStatus('');
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  const filtered = orders.filter(o => {
    const name = customerName(o).toLowerCase();
    const matchSearch =
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.includes(searchTerm.toLowerCase());
    const matchTab = activeTab === 'all' || o.status === activeTab;
    return matchSearch && matchTab;
  });

  const count = (key: string) => key === 'all' ? orders.length : orders.filter(o => o.status === key).length;
  const statusIndex = (s: string) => STATUS_TIMELINE.indexOf(s as OrderStatus);

  const detailShipping = (detail?.shipping as ShippingJSON | null) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl text-gray-900">Orders</h2>
          <p className="text-gray-500 mt-1">Track and manage all customer orders</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search orders..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                {STATUS_TABS.map(t => (
                  <TabsTrigger key={t.key} value={t.key}>
                    {t.label} ({count(t.key)})
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                {filtered.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">No orders found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Order ID</th>
                          <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Customer</th>
                          <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Date</th>
                          <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Amount (KES)</th>
                          <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Payment</th>
                          <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Status</th>
                          <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(order => (
                          <tr key={order.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-3 font-medium text-[#141776] text-sm">{order.orderNumber}</td>
                            <td className="py-3 px-3">
                              <div className="font-medium text-sm">{customerName(order)}</div>
                              <div className="text-xs text-gray-500">{order.customer?.phone ?? '—'}</div>
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-600">{formatDate(order.createdAt)}</td>
                            <td className="py-3 px-3 font-medium text-sm">{Number(order.totalKes).toLocaleString()}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paymentColors[order.paymentMethod ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                                {paymentLabels[order.paymentMethod ?? ''] ?? order.paymentMethod ?? '—'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {STATUS_LABELS[order.status] ?? order.status}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openOrder(order)}>
                                <Eye className="w-4 h-4" />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order {selected?.orderNumber}</DialogTitle>
            <DialogDescription>Full order details and status management</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              {/* Customer info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-medium">{customerName(selected)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Contact</p>
                  <p className="font-medium">{selected.customer?.phone ?? detailShipping?.phone ?? '—'}</p>
                  <p className="text-sm text-gray-500">{detailShipping?.city ?? ''}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-medium">{formatDate(selected.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment Method</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paymentColors[selected.paymentMethod ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                    {paymentLabels[selected.paymentMethod ?? ''] ?? selected.paymentMethod ?? '—'}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">Payment: {selected.paymentStatus}</p>
                </div>
              </div>

              {/* Order items */}
              <div>
                <p className="font-medium mb-2">Order Items</p>
                {detailLoading || !detail ? (
                  <div className="h-16 bg-gray-100 rounded animate-pulse" />
                ) : detail.items.length === 0 ? (
                  <p className="text-sm text-gray-400 p-4 border rounded-lg">No items found.</p>
                ) : (
                  <div className="border rounded-lg divide-y">
                    {detail.items.map(item => (
                      <div key={item.id} className="p-4 flex justify-between items-start">
                        <div>
                          <p className="font-medium">{item.product?.name ?? 'Unknown product'}</p>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {item.product?.brand ? `${item.product.brand} · ` : ''}Qty: {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold">{formatKes(item.lineTotalKes)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {detail && (
                  <div className="flex justify-end mt-3 pt-3 border-t">
                    <div className="text-right space-y-1">
                      <p className="text-sm text-gray-500">Subtotal: {formatKes(Number(detail.subtotalKes))}</p>
                      {detail.discountKes > 0 && (
                        <p className="text-sm text-gray-500">Discount: −{formatKes(Number(detail.discountKes))}</p>
                      )}
                      <p className="text-sm text-gray-500">VAT (16%): {formatKes(Number(detail.vatKes))}</p>
                      <p className="text-sm text-gray-500">Shipping: {formatKes(Number(detail.shippingKes))}</p>
                      <p className="font-bold text-lg">Total: {formatKes(Number(detail.totalKes))}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status timeline */}
              {selected.status !== 'cancelled' && (
                <div>
                  <p className="font-medium mb-3">Status Timeline</p>
                  <div className="flex items-center gap-2">
                    {STATUS_TIMELINE.map((s, i) => {
                      const current = statusIndex(selected.status);
                      const done = i <= current;
                      const active = i === current;
                      return (
                        <div key={s} className="flex items-center gap-2 flex-1">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${done ? 'bg-[#141776]' : 'bg-gray-200'}`}>
                              {done && <CheckCircle className="w-4 h-4 text-white" />}
                            </div>
                            <span className={`text-xs text-center ${active ? 'font-semibold text-[#141776]' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                              {STATUS_LABELS[s]}
                            </span>
                          </div>
                          {i < STATUS_TIMELINE.length - 1 && (
                            <div className={`flex-1 h-0.5 mb-4 ${i < current ? 'bg-[#141776]' : 'bg-gray-200'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Update status */}
              <div className="flex items-center gap-3 border-t pt-4">
                <Select value={newStatus} onValueChange={v => setNewStatus(v as OrderStatus)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Update status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DB_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleStatusUpdate}
                  disabled={!newStatus || newStatus === selected.status || updating}
                  className="bg-[#141776] hover:bg-[#0f1258]"
                >
                  {updating ? 'Saving...' : 'Update'}
                </Button>
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
