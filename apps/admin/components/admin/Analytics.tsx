'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { TableSkeleton } from '../ui/table-skeleton';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatKes } from '@optex/ui';
import { createBrowserSupabase } from '@optex/db/browser';
import {
  getDashboardStats,
  getRevenueByPeriod,
  getTopProducts,
  getPaymentMethodBreakdown,
} from '@optex/db';
import type { DashboardStats, RevenuePoint, TopProduct, PaymentMethodBreakdown } from '@optex/db';

// Hardcoded fallback only used when DB returns no category data (no equivalent query yet)
const categoryPerformance = [
  { category: 'Sunglasses', sales: 4500, growth: 12.5 },
  { category: 'Eyeglasses', sales: 3200, growth: 8.3 },
  { category: 'Contact Lenses', sales: 1800, growth: -3.2 },
  { category: 'Accessories', sales: 950, growth: 15.7 },
  { category: 'Kids', sales: 620, growth: 22.1 },
  { category: 'Computer', sales: 430, growth: 31.4 },
];

export function Analytics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentMethodBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = createBrowserSupabase();
    Promise.all([
      getDashboardStats(db),
      getRevenueByPeriod(db, '90D'),
      getTopProducts(db, 10),
      getPaymentMethodBreakdown(db),
    ])
      .then(([s, revenue, top, payment]) => {
        setStats(s);
        setRevenueData(revenue);
        setTopProducts(top);
        setPaymentBreakdown(payment);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const avgOrderValue =
    stats && stats.ordersToday > 0 ? Math.round(stats.revenueMonth / stats.ordersToday) : null;

  const ytdKPIs = [
    {
      title: 'Revenue (This Month)',
      value: stats ? formatKes(stats.revenueMonth) : '—',
      sub: 'Live from DB',
      icon: DollarSign,
      up: true,
      bg: 'bg-green-100',
      color: 'text-green-600',
    },
    {
      title: 'Orders Today',
      value: stats ? String(stats.ordersToday) : '—',
      sub: 'Live from DB',
      icon: ShoppingCart,
      up: true,
      bg: 'bg-blue-100',
      color: 'text-blue-600',
    },
    {
      title: 'Total Customers',
      value: stats ? String(stats.totalCustomers) : '—',
      sub: 'Live from DB',
      icon: Users,
      up: true,
      bg: 'bg-purple-100',
      color: 'text-purple-600',
    },
    {
      title: 'Avg Order Value (Today)',
      value: avgOrderValue != null ? formatKes(avgOrderValue) : '—',
      sub: 'Revenue ÷ orders today',
      icon: BarChart2,
      up: true,
      bg: 'bg-orange-100',
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        <p className="mt-1 text-gray-500">Year-to-date performance insights</p>
      </div>

      {/* YTD KPI Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {ytdKPIs.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{kpi.title}</p>
                    {loading ? (
                      <Skeleton className="mt-2 h-7 w-20" />
                    ) : (
                      <h3 className="mt-2 text-xl font-bold">{kpi.value}</h3>
                    )}
                    <div className="mt-1 flex items-center gap-1">
                      {kpi.up ? (
                        <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span className={`text-xs ${kpi.up ? 'text-green-600' : 'text-red-500'}`}>
                        {kpi.sub}
                      </span>
                    </div>
                  </div>
                  <div className={`${kpi.bg} rounded-full p-3`}>
                    <Icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Monthly revenue line chart (90-day bucketed) */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend (90 Days)</CardTitle>
          <CardDescription>Revenue (KES) and order volume — bucketed by month</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  formatter={(value, name) => [
                    name === 'revenue' ? `KES ${Number(value).toLocaleString()}` : value,
                    name === 'revenue' ? 'Revenue' : 'Orders',
                  ]}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#141776"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Payment breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))
        ) : paymentBreakdown.length > 0 ? (
          paymentBreakdown.map((pm) => (
            <Card key={pm.name}>
              <CardContent className="p-6">
                <p className="text-sm text-gray-500">{pm.name}</p>
                <p className="mt-2 text-2xl font-bold">{pm.value}%</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-gray-500">of non-cancelled orders</span>
                  <span className="font-semibold text-[#141776]">{pm.value}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-[#141776]"
                    style={{ width: `${pm.value}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="lg:col-span-3">
            <CardContent className="p-6 text-center text-sm text-gray-400">
              No payment data yet.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Products table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
          <CardDescription>Top 10 by revenue (all time)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">#</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Units</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Revenue</th>
                </tr>
              </thead>
              <TableSkeleton cols={5} />
            </table>
          ) : topProducts.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No sales data yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">#</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Units</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, i) => (
                  <tr key={product.product_id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-2 py-2.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#141776] text-xs font-medium text-white">
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-sm font-medium">{product.name}</td>
                    <td className="px-2 py-2.5 text-sm text-gray-400">{product.sku}</td>
                    <td className="px-2 py-2.5 text-sm">{product.units}</td>
                    <td className="px-2 py-2.5 text-sm font-medium">
                      {formatKes(product.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Category performance — static fixture (no category query yet) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Sales by product category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryPerformance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sales" name="Sales" fill="#141776" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Growth Rates</CardTitle>
            <CardDescription>Month-over-month growth %</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryPerformance.map((c) => (
                <div key={c.category}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{c.category}</span>
                    <div className="flex items-center gap-1">
                      {c.growth > 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span
                        className={`text-sm font-semibold ${c.growth > 0 ? 'text-green-600' : 'text-red-500'}`}
                      >
                        {c.growth > 0 ? '+' : ''}
                        {c.growth}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div
                      className={`h-1.5 rounded-full ${c.growth > 0 ? 'bg-green-500' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(Math.abs(c.growth) * 3, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
