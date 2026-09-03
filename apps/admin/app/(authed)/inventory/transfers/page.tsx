import { InventoryNav } from '@/components/admin/inventory/InventoryNav';
import { Transfers } from '@/components/admin/inventory/Transfers';

export default function TransfersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
        <p className="mt-1 text-gray-500">Move units between branches.</p>
      </div>
      <InventoryNav />
      <Transfers />
    </div>
  );
}
