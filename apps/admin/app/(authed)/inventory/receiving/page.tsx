import { InventoryNav } from '@/components/admin/inventory/InventoryNav';
import { Receiving } from '@/components/admin/inventory/Receiving';

export default function ReceivingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
        <p className="mt-1 text-gray-500">Bring supplier deliveries into stock.</p>
      </div>
      <InventoryNav />
      <Receiving />
    </div>
  );
}
