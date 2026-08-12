'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, ShoppingBag, Users, CalendarCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { TableSkeleton } from '../ui/table-skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../../lib/api';
import type { DashboardResponse, RecentOrder, TopProduct } from '@optex/api-client';
import { formatKes } from '@optex/ui';

/** Chart-friendly revenue point. The API returns `{date, revenueKes, orders}`. */
interface RevenuePoint {
  label: string;
  revenue: number;
  orders: number;
}

/** Pie-friendly payment slice. The API returns `{method, orders, revenueKes, share}`. */
interface PaymentSlice {
  name: string;
  value: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  mpesa: 'M-Pesa',
  pesapal: 'Pesapal',
  cod: 'COD',
  unknown: 'Unrecorded',
};

const COLORS_PAYMENT = ['#22c55e', '#3b82f6', '#f59e0b'];

const ORDER_STATUS_COLORS: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700',
  dispatched: 'bg-purple-100 text-purple-700',
  processing: 'bg-blue-100 text-blue-700',
  pending_payment: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

const PAYMENT_COLORS: Record<string, string> = {
  mpesa: 'bg-green-100 text-green-700',
  pesapal: 'bg-blue-100 text-blue-700',
  cod: 'bg-amber-100 text-amber-700',
};

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
}

export function Dashboard() {
  const [period, setPeriod] = useState<'7D' | '30D' | '90D'>('7D');
  const [stats, setStats] = useState<DashboardResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [chartData, setChartData] = useState<RevenuePoint[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentSlice[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);

  // One request per period change. GET /admin/dashboard returns the KPIs, the
  // calendar snapshot, recent orders, top products, the daily revenue series and
  // the payment-method breakdown together, so the four parallel Supabase reads
  // this replaced are now a single round-trip.
  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);

    api.admin
      .dashboard({ range: period.toLowerCase() as '7d' | '30d' | '90d' })
      .then((d) => {
        if (cancelled) return;
        setStats(d);
        setRecentOrders(d.recentOrders);
        setTopProducts(d.topProducts);
        setChartData(
          d.dailyRevenue.map((p) => ({
            label: formatDate(p.date),
            revenue: p.revenueKes,
            orders: p.orders,
          })),
        );
        setPaymentData(
          d.paymentMethods.map((m) => ({
            name: PAYMENT_LABELS[m.method] ?? m.method,
            value: m.share,
          })),
        );
      })
      .catch(console.error)
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setChartLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  const kpiCards = [
    {
      title: 'Revenue (Month)',
      value: stats ? formatKes(stats.snapshot.revenueMonthKes) : '—',
      change: '+live',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Orders Today',
      value: stats ? String(stats.snapshot.ordersToday) : '—',
      change: '+live',
      icon: ShoppingBag,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Total Customers',
      value: stats ? String(stats.kpis.customerCount) : '—',
      change: '+live',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Appointments Today',
      value: stats ? String(stats.snapshot.appointmentsToday) : '—',
      change: '+live',
      icon: CalendarCheck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="mt-1 text-gray-500">Welcome back! Here's your store overview.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.title}</p>
                    {loading ? (
                      <Skeleton className="mt-2 h-7 w-20" />
                    ) : (
                      <h3 className="mt-2 text-xl font-bold">{stat.value}</h3>
                    )}
                    <p className="mt-1 text-sm text-green-600">{stat.change}</p>
                  </div>
                  <div className={`${stat.bgColor} rounded-full p-3`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
            {chartLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart key={period} data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(20,23,118,0.05)' }}
                    formatter={(value: number) => [
                      `KES ${Number(value).toLocaleString()}`,
                      'Revenue',
                    ]}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#141776"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
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
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  dataKey="value"
                >
                  {paymentData.map((entry, index) => (
                    <Cell
                      key={`pm-cell-${entry.name}`}
                      fill={COLORS_PAYMENT[index % COLORS_PAYMENT.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name, props) => [
                    `${value}%`,
                    (props?.payload as { name?: string })?.name ?? '',
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-2">
              {paymentData.map((pm, i) => (
                <div key={pm.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS_PAYMENT[i] }}
                    />
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders — real data */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Last 5 orders from your customers</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Order</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">
                      Amount
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Pay</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <TableSkeleton cols={5} />
              </table>
            ) : recentOrders.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No orders yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Order</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">
                      Amount
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Pay</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-2 py-2.5 text-sm font-medium text-[#141776]">
                        {order.orderNumber}
                      </td>
                      <td className="px-2 py-2.5 text-sm text-gray-500">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-2 py-2.5 text-sm font-medium">
                        {formatKes(order.totalKes)}
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_COLORS[order.paymentMethod ?? ''] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {order.paymentMethod?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
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
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">
                      Product
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Units</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <TableSkeleton cols={3} />
              </table>
            ) : topProducts.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No sales data yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">
                      Product
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Units</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, i) => (
                    <tr key={product.productId} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#141776] text-xs font-medium text-white">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium leading-tight">{product.name}</p>
                            <p className="text-xs text-gray-400">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-sm">{product.units}</td>
                      <td className="px-2 py-2.5 text-sm font-medium">
                        {formatKes(product.revenueKes)}
                      </td>
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
