'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { KENYA_COUNTIES } from '@/lib/kenya-counties';

const BackArrowIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const PinIcon = () => (
  <svg
    className="h-6 w-6 text-[#2A3182]"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const BLANK_FORM = {
  label: '',
  name: '',
  phone: '',
  address: '',
  city: '',
  county: '',
  postal: '',
  isDefault: false,
};

/** Fields shared by the "add" and "edit" forms. */
function AddressForm({ form, onChange, onSubmit, onCancel, saving, error, submitLabel }) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-[#C7C5D4] bg-[#F9F9FC] p-5"
    >
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="address-label" className="mb-1 block text-sm font-medium text-[#141776]">
            Label <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="address-label"
            value={form.label}
            onChange={(e) => onChange({ ...form, label: e.target.value })}
            placeholder="Home, Work…"
            className="h-11 w-full rounded-xl border border-[#C7C5D4] bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-[#141776]"
          />
        </div>
        <div>
          <label htmlFor="address-name" className="mb-1 block text-sm font-medium text-[#141776]">
            Full Name
          </label>
          <input
            id="address-name"
            required
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            className="h-11 w-full rounded-xl border border-[#C7C5D4] bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-[#141776]"
          />
        </div>
      </div>

      <div>
        <label htmlFor="address-phone" className="mb-1 block text-sm font-medium text-[#141776]">
          Phone Number
        </label>
        <input
          id="address-phone"
          required
          type="tel"
          value={form.phone}
          onChange={(e) => onChange({ ...form, phone: e.target.value })}
          placeholder="0712 345 678"
          className="h-11 w-full rounded-xl border border-[#C7C5D4] bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-[#141776]"
        />
      </div>

      <div>
        <label htmlFor="address-line" className="mb-1 block text-sm font-medium text-[#141776]">
          Address Line
        </label>
        <input
          id="address-line"
          required
          value={form.address}
          onChange={(e) => onChange({ ...form, address: e.target.value })}
          className="h-11 w-full rounded-xl border border-[#C7C5D4] bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-[#141776]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="address-city" className="mb-1 block text-sm font-medium text-[#141776]">
            City
          </label>
          <input
            id="address-city"
            required
            value={form.city}
            onChange={(e) => onChange({ ...form, city: e.target.value })}
            className="h-11 w-full rounded-xl border border-[#C7C5D4] bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-[#141776]"
          />
        </div>
        <div>
          <label htmlFor="address-county" className="mb-1 block text-sm font-medium text-[#141776]">
            County
          </label>
          <select
            id="address-county"
            required
            value={form.county}
            onChange={(e) => onChange({ ...form, county: e.target.value })}
            className="h-11 w-full rounded-xl border border-[#C7C5D4] bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#141776]"
          >
            <option value="">Select county</option>
            {KENYA_COUNTIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="address-postal" className="mb-1 block text-sm font-medium text-[#141776]">
            Postcode <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="address-postal"
            value={form.postal}
            onChange={(e) => onChange({ ...form, postal: e.target.value })}
            className="h-11 w-full rounded-xl border border-[#C7C5D4] bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-[#141776]"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => onChange({ ...form, isDefault: e.target.checked })}
          className="h-4 w-4 accent-[#141776]"
        />
        Set as default address
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[#141776] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0f1258] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function AddressesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  // `?edit=<id>` opens straight into editing that address — used by the
  // checkout page's "Edit" link on a saved address, so a customer fixing a
  // typo doesn't have to hunt for the right card in a list. `?from=` is the
  // page to return to once they save, or via the back link if they don't.
  const editParam = searchParams.get('edit');
  const returnTo = searchParams.get('from');
  const appliedEditParam = useRef(false);

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(BLANK_FORM);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(BLANK_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?redirect=/profile/addresses');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!editParam || appliedEditParam.current || loading) return;
    const target = addresses.find((a) => a.id === editParam);
    if (target) {
      appliedEditParam.current = true;
      startEdit(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam, loading, addresses]);

  function reload() {
    setLoading(true);
    return api.addresses
      .listMine()
      .then((list) => {
        setAddresses(list);
        setError('');
      })
      .catch((err) => {
        console.error('Could not load addresses:', err);
        setError(err?.message ?? 'Could not load your addresses.');
      })
      .finally(() => setLoading(false));
  }

  function toInput(form) {
    return {
      label: form.label.trim() || undefined,
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      county: form.county,
      postal: form.postal.trim() || undefined,
      isDefault: form.isDefault,
    };
  }

  async function handleCreate(e) {
    e.preventDefault();
    setAddSaving(true);
    setAddError('');
    try {
      await api.addresses.create(toInput(addForm));
      setAddOpen(false);
      setAddForm(BLANK_FORM);
      await reload();
    } catch (err) {
      console.error('Could not save address:', err);
      setAddError(err?.message ?? 'Could not save that address.');
    } finally {
      setAddSaving(false);
    }
  }

  function startEdit(addr) {
    setEditingId(addr.id);
    setEditError('');
    setEditForm({
      label: addr.label ?? '',
      name: addr.name,
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      county: addr.county,
      postal: addr.postal ?? '',
      isDefault: addr.is_default,
    });
    // Only one form open at a time — adding and editing simultaneously would
    // leave two unsaved drafts on screen with no clear "which one am I
    // submitting" story.
    setAddOpen(false);
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setEditSaving(true);
    setEditError('');
    try {
      await api.addresses.update(editingId, toInput(editForm));
      setEditingId(null);
      // Arrived here via the "Edit" link on checkout's saved-address card —
      // the edit was the whole reason for the detour, so go straight back
      // rather than leaving them on the address list they didn't ask to see.
      if (returnTo) {
        router.push(returnTo);
        return;
      }
      await reload();
    } catch (err) {
      console.error('Could not update address:', err);
      setEditError(err?.message ?? 'Could not save your changes.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleSetDefault(id) {
    setBusyId(id);
    setError('');
    try {
      await api.addresses.setDefault(id);
      await reload();
    } catch (err) {
      console.error('Could not set default address:', err);
      setError(err?.message ?? 'Could not set that as your default address.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this address? This cannot be undone.')) return;
    setBusyId(id);
    setError('');
    try {
      await api.addresses.remove(id);
      await reload();
    } catch (err) {
      console.error('Could not delete address:', err);
      setError(err?.message ?? 'Could not remove that address.');
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-16 pt-[15px] sm:pb-24">
      <div className="site-container max-w-[720px]">
        <Link
          href={returnTo || '/profile'}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#2A3182]"
        >
          <BackArrowIcon />
          {returnTo ? 'Back to Checkout' : 'Back to Account'}
        </Link>

        <div className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:rounded-[32px] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50">
                <PinIcon />
              </div>
              <div>
                <h1 className="text-[20px] font-bold text-[#1a1a1a]">Delivery Addresses</h1>
                <p className="text-[13px] text-gray-500">
                  Saved addresses are offered at checkout so you don&rsquo;t retype them.
                </p>
              </div>
            </div>
            {!addOpen && !editingId && (
              <button
                type="button"
                onClick={() => {
                  setAddForm({ ...BLANK_FORM, isDefault: addresses.length === 0 });
                  setAddError('');
                  setAddOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#2A3182] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1e2461]"
              >
                <PlusIcon />
                Add Address
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {addOpen && (
            <div className="mb-6">
              <AddressForm
                form={addForm}
                onChange={setAddForm}
                onSubmit={handleCreate}
                onCancel={() => setAddOpen(false)}
                saving={addSaving}
                error={addError}
                submitLabel="Save Address"
              />
            </div>
          )}

          {loading ? (
            <p className="py-10 text-center text-sm text-gray-400">Loading addresses…</p>
          ) : addresses.length === 0 && !addOpen ? (
            <div className="py-10 text-center">
              <p className="mb-1 text-sm font-medium text-gray-500">No saved addresses yet</p>
              <p className="text-sm text-gray-400">
                Add one so checkout can fill itself in next time.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {addresses.map((addr) =>
                editingId === addr.id ? (
                  <li key={addr.id}>
                    <AddressForm
                      form={editForm}
                      onChange={setEditForm}
                      onSubmit={handleUpdate}
                      onCancel={() => setEditingId(null)}
                      saving={editSaving}
                      error={editError}
                      submitLabel="Save Changes"
                    />
                  </li>
                ) : (
                  <li key={addr.id} className="rounded-2xl border border-gray-100 bg-[#fafbfc] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          {addr.label && (
                            <span className="text-[13px] font-semibold text-[#141776]">
                              {addr.label}
                            </span>
                          )}
                          {addr.is_default && (
                            <span className="rounded-full bg-[#E8E7F5] px-2 py-0.5 text-[11px] font-medium text-[#141776]">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[15px] text-[#141776]">
                          {addr.name} &middot; {addr.phone}
                        </p>
                        <p className="text-[14px] text-[#6B7280]">
                          {addr.address}, {addr.city}, {addr.county}
                          {addr.postal ? ` ${addr.postal}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!addr.is_default && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(addr.id)}
                            disabled={busyId === addr.id}
                            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-[#141776] hover:text-[#141776] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Set default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(addr)}
                          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-[#141776] hover:text-[#141776]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(addr.id)}
                          disabled={busyId === addr.id}
                          className="rounded-full border border-red-100 bg-white px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyId === addr.id ? 'Removing…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AddressesPage() {
  // `useSearchParams()` opts this page out of static rendering, and Next.js
  // requires a Suspense boundary around any component that calls it — the
  // fallback only ever shows for an instant since this route is entirely
  // client-rendered already (it's gated on the auth session).
  return (
    <Suspense fallback={null}>
      <AddressesPageInner />
    </Suspense>
  );
}
