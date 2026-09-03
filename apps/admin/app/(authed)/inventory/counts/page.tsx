import { InventoryNav } from '@/components/admin/inventory/InventoryNav';
import { StockCounts } from '@/components/admin/inventory/StockCounts';

export default function StockCountsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
        <p className="mt-1 text-gray-500">Count a branch and book the variance.</p>
      </div>
      <InventoryNav />
      <StockCounts />
    </div>
  );
}
