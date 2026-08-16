'use client';
import { useEffect, useState } from 'react';
import { Plus, Edit, UserX, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { api } from '@/lib/api';
import type { AdminStaff, Branch, Role } from '@optex/api-client';

function SkeletonRow() {
  return (
    <tr className="border-b">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

interface StaffFormState {
  email: string;
  password: string;
  fullName: string;
  roleId: string;
  branchId: string;
}

const EMPTY_FORM: StaffFormState = {
  email: '',
  password: '',
  fullName: '',
  roleId: '',
  branchId: '',
};

function StaffFormDialog({
  open,
  onOpenChange,
  mode,
  roles,
  branches,
  initial,
  onSubmit,
  error,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'edit';
  roles: Role[];
  branches: Branch[];
  initial: StaffFormState;
  onSubmit: (form: StaffFormState) => Promise<void>;
  error: string;
}) {
  const [form, setForm] = useState<StaffFormState>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedRole = roles.find((r) => r.id === form.roleId);
  const branchRequired = selectedRole?.is_branch_scoped ?? false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Staff Member' : 'Edit Staff Member'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Creates a sign-in account and assigns a role.'
              : "Changes take effect on the staff member's very next request — no re-login needed."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4 py-2" onSubmit={handleSubmit}>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              required
            />
          </div>

          {mode === 'create' && (
            <>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Initial Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  minLength={8}
                  required
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={form.roleId}
              onValueChange={(v) => setForm((f) => ({ ...f, roleId: v, branchId: '' }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRole && <p className="text-xs text-gray-500">{selectedRole.description}</p>}
          </div>

          {branchRequired && (
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select
                value={form.branchId || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                saving || !form.fullName || !form.roleId || (branchRequired && !form.branchId)
              }
              className="bg-[#141776] hover:bg-[#0f1258]"
            >
              {saving ? 'Saving…' : mode === 'create' ? 'Create Account' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Staff() {
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminStaff | null>(null);
  const [formError, setFormError] = useState('');

  async function reload() {
    const rows = await api.admin.staff.list();
    setStaff(rows);
  }

  useEffect(() => {
    void (async () => {
      try {
        const [staffRows, roleRows, branchRows] = await Promise.all([
          api.admin.staff.list(),
          api.admin.staff.listRoles(),
          api.branches.list(),
        ]);
        setStaff(staffRows);
        setRoles(roleRows);
        setBranches(branchRows);
      } catch (e) {
        console.error('Failed to load staff:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleCreate(form: StaffFormState) {
    setFormError('');
    try {
      await api.admin.staff.create({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        roleId: form.roleId,
        branchId: form.branchId || undefined,
      });
      setCreateOpen(false);
      await reload();
    } catch (e) {
      setFormError((e as Error)?.message ?? 'Could not create this staff account.');
      throw e;
    }
  }

  async function handleEdit(form: StaffFormState) {
    if (!editTarget) return;
    setFormError('');
    try {
      await api.admin.staff.update(editTarget.id, {
        fullName: form.fullName,
        roleId: form.roleId,
        branchId: form.branchId || null,
      });
      setEditTarget(null);
      await reload();
    } catch (e) {
      setFormError((e as Error)?.message ?? 'Could not update this staff account.');
      throw e;
    }
  }

  async function handleSetStatus(member: AdminStaff, deactivate: boolean) {
    const verb = deactivate ? 'Deactivate' : 'Reactivate';
    const warning = deactivate
      ? `${verb} ${member.full_name}? They will no longer be able to sign in.`
      : `${verb} ${member.full_name}? They will be able to sign in again.`;
    if (!confirm(warning)) return;

    const previous = staff;
    const deactivatedAt = deactivate ? new Date().toISOString() : null;
    setStaff((prev) =>
      prev.map((s) => (s.id === member.id ? { ...s, deactivated_at: deactivatedAt } : s)),
    );

    try {
      await api.admin.staff.setStatus(member.id, { status: deactivate ? 'deactivated' : 'active' });
    } catch (e) {
      console.error('Failed to set staff status:', e);
      setStaff(previous);
      alert((e as Error)?.message ?? 'Could not update this staff account.');
    }
  }

  const activeCount = staff.filter((s) => !s.deactivated_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Staff</h2>
          <p className="mt-1 text-gray-500">Manage staff accounts, roles, and branch assignments</p>
        </div>
        <Button
          onClick={() => {
            setFormError('');
            setCreateOpen(true);
          }}
          className="bg-[#141776] hover:bg-[#0f1258]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Staff
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Total Staff</p>
            {loading ? (
              <Skeleton className="mt-1 h-8 w-12" />
            ) : (
              <p className="mt-1 text-2xl font-bold">{staff.length}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Active</p>
            {loading ? (
              <Skeleton className="mt-1 h-8 w-12" />
            ) : (
              <p className="mt-1 text-2xl font-bold">{activeCount}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Directory</CardTitle>
          {!loading && <CardDescription>{`${staff.length} accounts`}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Branch</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
                  : staff.map((member) => (
                      <tr key={member.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <p className="text-sm font-medium">{member.full_name}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                        </td>
                        <td className="px-3 py-3 text-sm">{member.role_name}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">
                          {member.branch_name ?? '—'}
                        </td>
                        <td className="px-3 py-3">
                          {member.deactivated_at ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              Inactive
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setFormError('');
                                setEditTarget(member);
                              }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            {member.deactivated_at ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600"
                                onClick={() => handleSetStatus(member, false)}
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-600"
                                onClick={() => handleSetStatus(member, true)}
                              >
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <StaffFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        roles={roles}
        branches={branches}
        initial={EMPTY_FORM}
        onSubmit={handleCreate}
        error={formError}
      />

      {editTarget && (
        <StaffFormDialog
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
          mode="edit"
          roles={roles}
          branches={branches}
          initial={{
            email: editTarget.email,
            password: '',
            fullName: editTarget.full_name,
            roleId: editTarget.role_id,
            branchId: editTarget.branch_id ?? '',
          }}
          onSubmit={handleEdit}
          error={formError}
        />
      )}
    </div>
  );
}
