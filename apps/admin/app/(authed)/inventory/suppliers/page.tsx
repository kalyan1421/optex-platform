import { InventoryNav } from '@/components/admin/inventory/InventoryNav';
import { Suppliers } from '@/components/admin/inventory/Suppliers';

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
        <p className="mt-1 text-gray-500">Manage the suppliers deliveries come from.</p>
      </div>
      <InventoryNav />
      <Suppliers />
    </div>
  );
}
