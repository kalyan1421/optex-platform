'use client';

/**
 * Suppliers — CR-01 R2 sub-phase 2e.
 *
 * Included because Receiving is unusable without it: a goods-received note
 * requires a `supplier_id`, and the API had full supplier CRUD with nothing
 * in the panel to call it, so there was no way to get the first supplier into
 * the system. Gated by `suppliers.manage`, which is a separate permission
 * from the `inventory.*` set.
 *
 * Deactivating is a soft delete, mirroring products: GRNs reference suppliers,
 * so a supplier that has ever delivered cannot simply vanish.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit } from 'lucide-react';
import type { Supplier } from '@optex/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { TableSkeleton } from '../../ui/table-skeleton';
import { api } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';
import { ErrorBanner, ReadOnlyNotice, errorMessage } from './shared';

interface FormState {
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
}

const BLANK: FormState = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  is_active: true,
};

export function Suppliers() {
  const { hasPermission } = useCurrentUser();
  const canWrite = hasPermission('suppliers.manage');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      // No `activeOnly` — the directory must show deactivated suppliers too,
      // otherwise reactivating one is impossible from here.
      setSuppliers(await api.admin.suppliers.list());
      setError('');
    } catch (e) {
      console.error('supplier list failed:', e);
      setError(errorMessage(e, 'Could not load suppliers.'));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  function openCreate() {
    setEditing(null);
    setForm(BLANK);
    setOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      contact_name: s.contact_name ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      is_active: s.is_active,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('A supplier needs a name.');
      return;
    }
    setSaving(true);
    try {
      // Blank optional fields are omitted rather than sent as '' — the DTO
      // validates them with @IsOptional() @IsString(), so an absent key leaves
      // the column NULL while an empty string would store one.
      const payload = {
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      };
      if (editing) {
        await api.admin.suppliers.update(editing.id, { ...payload, is_active: form.is_active });
      } else {
        await api.admin.suppliers.create(payload);
      }
      setOpen(false);
      await reload();
    } catch (e) {
      console.error('supplier save failed:', e);
      setError(errorMessage(e, 'Could not save the supplier.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Suppliers</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Who deliveries come from. A goods-received note must name one.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="bg-[#141776] hover:bg-[#0f1258]">
            <Plus className="mr-1 h-4 w-4" />
            New Supplier
          </Button>
        )}
      </div>

      {!canWrite && <ReadOnlyNotice action="manage suppliers" />}
      <ErrorBanner message={error} />

      <Card>
        <CardHeader>
          <CardTitle>Supplier Directory</CardTitle>
          <CardDescription>
            {loading ? 'Loading…' : `${suppliers.length} suppliers`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {['Name', 'Contact', 'Phone', 'Email', 'Status', ''].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-sm font-medium text-gray-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton rows={3} cols={6} />
              ) : (
                <tbody>
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-sm text-gray-500">
                        No suppliers yet. Add one before recording a delivery.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((s) => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm font-medium">{s.name}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{s.contact_name ?? '—'}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{s.phone ?? '—'}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{s.email ?? '—'}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              s.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {canWrite && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Edit supplier"
                              onClick={() => openEdit(s)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
            <DialogDescription>Only the name is required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="supplier-name">Name</Label>
              <Input
                id="supplier-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Lens2Cart Kenya"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="supplier-contact">Contact person</Label>
                <Input
                  id="supplier-contact"
                  value={form.contact_name}
                  onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-phone">Phone</Label>
                <Input
                  id="supplier-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-address">Address</Label>
              <Input
                id="supplier-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            {editing && (
              <div className="flex items-center gap-3">
                <Switch
                  id="supplier-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <Label htmlFor="supplier-active">Active</Label>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="bg-[#141776] hover:bg-[#0f1258]"
              >
                {saving ? 'Saving…' : 'Save supplier'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
