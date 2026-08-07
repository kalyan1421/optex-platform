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
import { api } from '../../lib/api';
import type { CategoryRevenue, TopProduct } from '@optex/api-client';

/** Chart-friendly revenue point. */
interface RevenuePoint {
  label: string;
  revenue: number;
  orders: number;
}

/** Pie-friendly payment slice. */
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

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
}

export function Analytics() {
  const [revenueMonthKes, setRevenueMonthKes] = useState<number | null>(null);
  const [ordersToday, setOrdersToday] = useState<number | null>(null);
  const [totalCustomers, setTotalCustomers] = useState<number | null>(null);
  const [avgOrderValue, setAvgOrderValue] = useState<number | null>(null);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentSlice[]>([]);
  const [categories, setCategories] = useState<CategoryRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // The dashboard endpoint carries the calendar KPIs and the payment
    // breakdown; the analytics endpoint carries the 90-day series, the top
    // products and revenue-by-category — including the growth comparison that
    // replaces the hardcoded category chart.
    Promise.all([api.admin.dashboard({ range: '90d' }), api.admin.analytics()])
      .then(([dash, an]) => {
        if (cancelled) return;
        setRevenueMonthKes(dash.snapshot.revenueMonthKes);
        setOrdersToday(dash.snapshot.ordersToday);
        setTotalCustomers(dash.kpis.customerCount);
        setAvgOrderValue(an.summary.averageOrderValueKes);
        setRevenueData(
          an.orderVolumeByDay.map((p) => ({
            label: shortDate(p.date),
            revenue: p.revenueKes,
            orders: p.orders,
          })),
        );
        setTopProducts(an.topProducts);
        setCategories(an.revenueByCategory);
        setPaymentBreakdown(
          dash.paymentMethods.map((m) => ({
            name: PAYMENT_LABELS[m.method] ?? m.method,
            value: m.share,
          })),
        );
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const ytdKPIs = [
    {
      title: 'Revenue (This Month)',
      value: revenueMonthKes != null ? formatKes(revenueMonthKes) : '—',
      sub: 'Live from DB',
      icon: DollarSign,
      up: true,
      bg: 'bg-green-100',
      color: 'text-green-600',
    },
    {
      title: 'Orders Today',
      value: ordersToday != null ? String(ordersToday) : '—',
      sub: 'Live from DB',
      icon: ShoppingCart,
      up: true,
      bg: 'bg-blue-100',
      color: 'text-blue-600',
    },
    {
      title: 'Total Customers',
      value: totalCustomers != null ? String(totalCustomers) : '—',
      sub: 'Live from DB',
      icon: Users,
      up: true,
      bg: 'bg-purple-100',
      color: 'text-purple-600',
    },
    {
      title: 'Avg Order Value',
      value: avgOrderValue != null ? formatKes(avgOrderValue) : '—',
      sub: 'Paid orders, last 30 days',
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
                  <tr key={product.productId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-2 py-2.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#141776] text-xs font-medium text-white">
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-sm font-medium">{product.name}</td>
                    <td className="px-2 py-2.5 text-sm text-gray-400">{product.sku}</td>
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

      {/* Category performance — static fixture (no category query yet) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Sales by product category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categories}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="categoryName" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(v: number) => formatKes(v)} />
                <Bar dataKey="revenueKes" name="Revenue" fill="#141776" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Growth Rates</CardTitle>
            <CardDescription>Revenue vs the preceding 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : categories.length === 0 ? (
                <p className="text-sm text-gray-400">No category sales in this period yet.</p>
              ) : (
                categories.map((c) => {
                  // growthPct is null when the preceding window had no revenue
                  // for this category — shown as "new" rather than a fake 0%.
                  const g = c.growthPct;
                  const up = g != null && g > 0;
                  return (
                    <div key={c.categoryId ?? c.categoryName}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-medium">{c.categoryName}</span>
                        {g == null ? (
                          <span className="text-xs font-medium text-gray-400">new</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            {up ? (
                              <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <span
                              className={`text-sm font-semibold ${up ? 'text-green-600' : 'text-red-500'}`}
                            >
                              {up ? '+' : ''}
                              {g}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div
                          className={`h-1.5 rounded-full ${g == null ? 'bg-gray-300' : up ? 'bg-green-500' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(Math.abs(g ?? 0) * 3, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
