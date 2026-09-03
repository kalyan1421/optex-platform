import { InventoryNav } from '@/components/admin/inventory/InventoryNav';
import { Adjustments } from '@/components/admin/inventory/Adjustments';

export default function AdjustmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
        <p className="mt-1 text-gray-500">Correct stock with a recorded reason.</p>
      </div>
      <InventoryNav />
      <Adjustments />
    </div>
  );
}
