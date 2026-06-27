'use client'
import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, ShoppingBag, Users, CalendarCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { createBrowserSupabase } from '@optex/db/browser';
import { getDashboardStats, getRecentOrders, getTopProducts, getRevenueByPeriod, getPaymentMethodBreakdown } from '@optex/db';
import type { DashboardStats, RecentOrder, TopProduct, RevenuePoint, PaymentMethodBreakdown } from '@optex/db';
import { formatKes } from '@optex/ui';

const COLORS_PAYMENT = ['#22c55e', '#3b82f6', '#f59e0b'];

// Fallback data used only when real data has not yet loaded
const fallbackSalesData7D: RevenuePoint[] = [
  { label: 'Day 1', revenue: 42000, orders: 14 },
  { label: 'Day 2', revenue: 58000, orders: 19 },
  { label: 'Day 3', revenue: 37000, orders: 12 },
  { label: 'Day 4', revenue: 63000, orders: 21 },
  { label: 'Day 5', revenue: 51000, orders: 17 },
  { label: 'Day 6', revenue: 72000, orders: 24 },
  { label: 'Day 7', revenue: 48000, orders: 16 },
];

const fallbackPaymentData: PaymentMethodBreakdown[] = [
  { name: 'M-Pesa', value: 64 },
  { name: 'Pesapal', value: 28 },
  { name: 'COD', value: 8 },
];


const ORDER_STATUS_COLORS: Record<string, string> = {
  delivered:        'bg-green-100 text-green-700',
  dispatched:       'bg-purple-100 text-purple-700',
  processing:       'bg-blue-100 text-blue-700',
  pending_payment:  'bg-yellow-100 text-yellow-700',
  cancelled:        'bg-red-100 text-red-700',
};

const PAYMENT_COLORS: Record<string, string> = {
  mpesa:    'bg-green-100 text-green-700',
  pesapal:  'bg-blue-100 text-blue-700',
  cod:      'bg-amber-100 text-amber-700',
};

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
}

export function Dashboard() {
  const [period, setPeriod] = useState<'7D' | '30D' | '90D'>('7D');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [chartData, setChartData] = useState<RevenuePoint[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentMethodBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // H-5 FIX: getRevenueByPeriod is NOT included here because the period-change
    // useEffect below already fires on mount (period='7D') and handles the initial
    // chart load. Including it here caused two simultaneous requests for 7D data
    // on every page load, one of which was always wasted.
    const db = createBrowserSupabase();
    Promise.all([
      getDashboardStats(db),
      getRecentOrders(db, 5),
      getTopProducts(db, 5),
      getPaymentMethodBreakdown(db),
    ])
      .then(([s, orders, top, payment]) => {
        setStats(s);
        setRecentOrders(orders);
        setTopProducts(top);
        setPaymentData(payment);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const db = createBrowserSupabase();
    getRevenueByPeriod(db, period)
      .then(setChartData)
      .catch(console.error);
  }, [period]);

  const kpiCards = [
    {
      title: 'Revenue (Month)',
      value: stats ? formatKes(stats.revenueMonth) : '—',
      change: '+live',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Orders Today',
      value: stats ? String(stats.ordersToday) : '—',
      change: '+live',
      icon: ShoppingBag,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Total Customers',
      value: stats ? String(stats.totalCustomers) : '—',
      change: '+live',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Appointments Today',
      value: stats ? String(stats.appointmentsToday) : '—',
      change: '+live',
      icon: CalendarCheck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold text-2xl text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Welcome back! Here's your store overview.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.title}</p>
                    <h3 className={`font-bold text-xl mt-2 ${loading ? 'animate-pulse text-gray-300' : ''}`}>
                      {stat.value}
                    </h3>
                    <p className="text-sm text-green-600 mt-1">{stat.change}</p>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-full`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>Daily revenue (KES) + order count</CardDescription>
              </div>
              <div className="flex gap-1">
                {(['7D', '30D', '90D'] as const).map((p) => (
                  <Button
                    key={p}
                    variant={period === p ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPeriod(p)}
                    className={period === p ? 'bg-[#141776] hover:bg-[#0f1258]' : ''}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart key={period} data={chartData.length > 0 ? chartData : fallbackSalesData7D}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(20,23,118,0.05)' }}
                  formatter={(value: number) => [`KES ${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#141776" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>M-Pesa · Pesapal · COD breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={paymentData.length > 0 ? paymentData : fallbackPaymentData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
                  {(paymentData.length > 0 ? paymentData : fallbackPaymentData).map((entry, index) => (
                    <Cell key={`pm-cell-${entry.name}`} fill={COLORS_PAYMENT[index % COLORS_PAYMENT.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, _name, props) => [`${value}%`, (props?.payload as { name?: string })?.name ?? '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {(paymentData.length > 0 ? paymentData : fallbackPaymentData).map((pm, i) => (
                <div key={pm.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS_PAYMENT[i] }} />
                    <span className="text-gray-600">{pm.name}</span>
                  </div>
                  <span className="font-medium">{pm.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders — real data */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Last 5 orders from your customers</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No orders yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Order</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Date</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Amount</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Pay</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 px-2 text-sm font-medium text-[#141776]">{order.order_number}</td>
                      <td className="py-2.5 px-2 text-sm text-gray-500">{formatDate(order.created_at)}</td>
                      <td className="py-2.5 px-2 text-sm font-medium">{formatKes(order.total_kes)}</td>
                      <td className="py-2.5 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_COLORS[order.payment_method ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                          {order.payment_method?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Top Products — real data from order_items aggregation */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Top 5 by revenue (all time)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : topProducts.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No sales data yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Product</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Units</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, i) => (
                    <tr key={product.product_id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#141776] text-white text-xs flex items-center justify-center font-medium shrink-0">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium leading-tight">{product.name}</p>
                            <p className="text-xs text-gray-400">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-sm">{product.units}</td>
                      <td className="py-2.5 px-2 text-sm font-medium">{formatKes(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
