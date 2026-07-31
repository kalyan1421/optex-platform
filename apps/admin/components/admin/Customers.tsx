'use client';
import { useEffect, useState } from 'react';
import { Search, Eye, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Skeleton } from '../ui/skeleton';
import { createBrowserSupabase } from '@optex/db/browser';

interface DbOrder {
  id: string;
  order_number: string | null;
  total_kes: number;
  status: string;
}

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  orders: DbOrder[];
  orderCount: number;
  totalSpent: number;
}

const statusColors: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  dispatched: 'bg-purple-100 text-purple-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

function getStatusColor(status: string): string {
  return statusColors[status.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function SkeletonRow() {
  return (
    <tr className="border-b">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const db = createBrowserSupabase();
    void (async () => {
      try {
        const { data, error } = await db
          .from('customers')
          .select(
            'id, full_name, email, phone, created_at, orders(id, total_kes, status, order_number)',
          )
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Failed to fetch customers:', error);
          return;
        }

        const mapped: Customer[] = (data ?? []).map((row) => {
          const orders: DbOrder[] = Array.isArray(row.orders) ? row.orders : [];
          const totalSpent = orders.reduce((sum, o) => sum + (o.total_kes ?? 0), 0);
          return {
            id: row.id as string,
            full_name: row.full_name ?? '',
            email: row.email ?? '',
            phone: row.phone ?? null,
            created_at: row.created_at ?? '',
            orders,
            orderCount: orders.length,
            totalSpent,
          };
        });

        setCustomers(mapped);
      } catch (e) {
        console.error('Unexpected error fetching customers:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone ?? '').includes(searchTerm),
  );

  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);

  const joinDateDisplay = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-CA');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
        <p className="mt-1 text-gray-500">View and manage registered customer accounts</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Total Customers</p>
            {loading ? (
              <Skeleton className="mt-1 h-8 w-12" />
            ) : (
              <p className="mt-1 text-2xl font-bold">{customers.length}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Active</p>
            {loading ? (
              <Skeleton className="mt-1 h-8 w-12" />
            ) : (
              <p className="mt-1 text-2xl font-bold">{customers.length}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Total Revenue</p>
            {loading ? (
              <Skeleton className="mt-1 h-8 w-24" />
            ) : (
              <p className="mt-1 text-xl font-bold">KES {totalRevenue.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer List</CardTitle>
              {loading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <CardDescription>{`${filtered.length} customers`}</CardDescription>
              )}
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by name, email or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                    Customer
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Phone</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Orders</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                    Total Spent
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                    Join Date
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                  : filtered.map((customer) => (
                      <tr key={customer.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <p className="text-sm font-medium">{customer.full_name}</p>
                          <p className="text-xs text-gray-500">{customer.email}</p>
                        </td>
                        <td className="px-3 py-3 text-sm">{customer.phone ?? '—'}</td>
                        <td className="px-3 py-3 text-center text-sm font-medium">
                          {customer.orderCount}
                        </td>
                        <td className="px-3 py-3 text-sm font-medium">
                          KES {customer.totalSpent.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600">
                          {joinDateDisplay(customer.created_at)}
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Active
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setSelectedCustomer(customer)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>View Orders</DropdownMenuItem>
                                <DropdownMenuItem>Send Email</DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled
                                  className="cursor-not-allowed text-gray-400"
                                  title="Coming soon"
                                >
                                  Deactivate
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.full_name}</DialogTitle>
            <DialogDescription>Customer profile and purchase history</DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="font-medium">{selectedCustomer.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="font-medium">{selectedCustomer.phone ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Member since</p>
                  <p className="font-medium">{joinDateDisplay(selectedCustomer.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Spent</p>
                  <p className="font-semibold text-[#141776]">
                    KES {selectedCustomer.totalSpent.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Account status</p>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Active
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-3 font-medium">
                  Order History ({selectedCustomer.orderCount} total)
                </p>
                {selectedCustomer.orders.length === 0 ? (
                  <p className="text-sm text-gray-500">No orders yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.orders.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#141776]">
                            {o.order_number ? `#${o.order_number}` : o.id}
                          </p>
                          <p className="text-xs text-gray-500">{capitalize(o.status)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            KES {(o.total_kes ?? 0).toLocaleString()}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(o.status)}`}
                          >
                            {capitalize(o.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setSelectedCustomer(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
