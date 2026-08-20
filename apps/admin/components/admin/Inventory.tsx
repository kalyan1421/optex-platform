'use client';
import { useState, useEffect } from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { api } from '@/lib/api';

interface BranchMeta {
  id: string;
  name: string;
}

interface PivotedItem {
  productId: string;
  name: string;
  sku: string;
  category: string;
  stocks: Record<string, { branchName: string; stock: number }>;
}

const LOW = 4;

function stockColor(n: number): string {
  if (n === 0) return 'bg-red-500';
  if (n <= LOW) return 'bg-amber-400';
  return 'bg-green-500';
}

/**
 * R2 (CR-01) retired direct stock edits: `PATCH /admin/inventory` is gone —
 * stock is now derived from the ledger (GRN, transfers, adjustments, counts),
 * never set directly, so a number here can no longer be typed over. Read-only
 * until the GRN/transfer/adjustment/count admin UI lands (sub-phase 2e).
 */
function StockCell({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2.5 w-2.5 rounded-full ${stockColor(value)}`} />
      <span className="text-sm">{value}</span>
    </div>
  );
}

function exportCSV(items: PivotedItem[], branches: BranchMeta[]) {
  const branchCols = branches.map((b) => b.name).join(',');
  const header = `Name,SKU,Category,${branchCols},Total\n`;
  const rows = items
    .map((item) => {
      const branchStocks = branches.map((b) => item.stocks[b.id]?.stock ?? 0);
      const total = branchStocks.reduce((a, c) => a + c, 0);
      return `"${item.name}","${item.sku}","${item.category}",${branchStocks.join(',')},${total}`;
    })
    .join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inventory-report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function SkeletonRow() {
  return (
    <tr className="border-b">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-4 w-16" />
        </td>
      ))}
    </tr>
  );
}

export function Inventory() {
  const [items, setItems] = useState<PivotedItem[]>([]);
  const [branches, setBranches] = useState<BranchMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const inventory = await api.admin.inventory.list();

        // R2 keeps the stock grid read-only until the ledger workflow tabs
        // land, but it must still show every branch. Hiding branches after the
        // third makes a valid cross-branch total look incomplete.
        const fetchedBranches: BranchMeta[] = inventory.branches.map((b) => ({
          id: b.id,
          name: b.name,
        }));
        setBranches(fetchedBranches);

        // Build a set of every branch returned by the server. A branch-scoped
        // user receives only their own branch from the API.
        const branchIdSet = new Set(fetchedBranches.map((b) => b.id));
        const branchNameMap: Record<string, string> = {};
        fetchedBranches.forEach((b) => {
          branchNameMap[b.id] = b.name;
        });

        // Pivot: group rows by product_id. The API already flattens the product
        // and category joins, so there is no array-or-object shape to normalise.
        const productMap: Record<string, PivotedItem> = {};
        for (const row of inventory.items) {
          const { product_id: productId, branch_id: branchId, stock } = row;

          if (!productMap[productId]) {
            productMap[productId] = {
              productId,
              name: row.product.name,
              sku: row.product.sku,
              category: row.product.category_name ?? '',
              stocks: {},
            };
          }
          if (branchIdSet.has(branchId)) {
            productMap[productId].stocks[branchId] = {
              branchName: branchNameMap[branchId] ?? branchId,
              stock,
            };
          }
        }

        // Fill missing branch entries with 0
        const pivoted = Object.values(productMap).map((item) => {
          fetchedBranches.forEach((b) => {
            if (!item.stocks[b.id]) {
              item.stocks[b.id] = { branchName: b.name, stock: 0 };
            }
          });
          return item;
        });

        setItems(pivoted);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const lowStockItems = items.filter((item) =>
    branches.some((b) => (item.stocks[b.id]?.stock ?? 0) <= LOW),
  );

  // Use DB branch names for headers; fall back to static labels while loading
  const colHeaders =
    branches.length > 0 ? branches.map((b) => b.name) : ['Nairobi CBD', 'Westlands', 'Mombasa Rd'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
          <p className="mt-1 text-gray-500">
            Stock levels per branch. Stock is now tracked through goods-received notes, transfers,
            adjustments, and counts — each requires a reason and is logged.
          </p>
        </div>
        <Button variant="outline" onClick={() => exportCSV(items, branches)} disabled={loading}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Low stock alert */}
      {!loading && lowStockItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium text-amber-800">
              {lowStockItems.length} product(s) below low-stock threshold ({LOW} units)
            </p>
            <p className="mt-1 text-sm text-amber-600">
              {lowStockItems.map((i) => i.name).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span>Good (&gt;{LOW})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-400" />
          <span>Low (1–{LOW})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span>Out of Stock (0)</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock Levels</CardTitle>
          {loading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <CardDescription>{`${items.length} products · ${branches.length} branches`}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Product</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">SKU</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                    Category
                  </th>
                  {colHeaders.map((name, i) => (
                    <th key={i} className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                      {name}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Total</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Bar</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  : items.map((item) => {
                      const branchStocks = branches.map((b) => item.stocks[b.id]?.stock ?? 0);
                      const total = branchStocks.reduce((a, c) => a + c, 0);
                      const minStock = branchStocks.length > 0 ? Math.min(...branchStocks) : 0;
                      const maxTotal = 200;
                      return (
                        <tr key={item.productId} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-3 text-sm font-medium">{item.name}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-500">{item.sku}</td>
                          <td className="px-3 py-3 text-sm">{item.category}</td>
                          {branches.map((b) => (
                            <td key={b.id} className="px-3 py-3">
                              <StockCell value={item.stocks[b.id]?.stock ?? 0} />
                            </td>
                          ))}
                          <td className="px-3 py-3 text-sm font-semibold">{total}</td>
                          <td className="w-32 px-3 py-3">
                            <div className="h-2 w-full rounded-full bg-gray-100">
                              <div
                                className={`h-2 rounded-full ${stockColor(minStock)}`}
                                style={{ width: `${Math.min((total / maxTotal) * 100, 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
