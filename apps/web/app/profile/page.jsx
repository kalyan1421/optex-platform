'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@optex/db/browser';
import { listOrdersForCustomer, getCustomerIdForUser } from '@optex/db';
import { formatKes } from '@optex/ui';

// Icons
const VerifyBadgeIcon = () => (
  <svg className="h-5 w-5 text-[#2A3182]" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);

const ShieldCrossIcon = () => (
  <svg
    className="h-3 w-3 text-white"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const BuildingIcon = () => (
  <svg
    className="h-4 w-4 text-[#2A3182]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
);

const FolderIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
);

const DownloadIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

const IdCardIcon = () => (
  <svg
    className="h-4 w-4 text-[#3b82f6]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
    />
  </svg>
);

const CalendarIcon = () => (
  <svg
    className="h-4 w-4 text-[#10b981]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const TableIcon = () => (
  <svg
    className="h-5 w-5 text-[#2A3182]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const NotesIcon = () => (
  <svg
    className="h-5 w-5 text-[#2A3182]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const VirtualLensIcon = () => (
  <svg
    className="h-6 w-6 text-white"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const SecurityIcon = () => (
  <svg
    className="h-4 w-4 text-gray-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const HistoryNavIcon = () => (
  <svg
    className="h-5 w-5 text-[#2A3182]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const RightArrowIcon = () => (
  <svg
    className="h-4 w-4 text-gray-300"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg
    className="h-8 w-8 text-gray-800"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);

const STATUS_STYLES = {
  delivered: 'bg-green-50 text-green-700 border-green-200',
  dispatched: 'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  pending_payment: 'bg-gray-50 text-gray-600 border-gray-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_DOTS = {
  delivered: 'bg-green-500',
  dispatched: 'bg-blue-500',
  processing: 'bg-yellow-500',
  pending_payment: 'bg-gray-400',
  cancelled: 'bg-red-500',
};

function statusLabel(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [prescription, setPrescription] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;
    const db = createBrowserSupabase();
    // Fetch orders. orders.customer_id references customers(id), NOT
    // auth.users(id) — passing the session id here matched nothing, so order
    // history was always empty.
    void (async () => {
      try {
        const customerId = await getCustomerIdForUser(db, user.id);
        setOrders(customerId ? await listOrdersForCustomer(db, customerId) : []);
      } catch (err) {
        console.error('Order history error:', err);
        setOrdersError('We could not load your orders. Please refresh to try again.');
      } finally {
        setOrdersLoading(false);
      }
    })();
    // Fetch most recent prescription via customer bridge
    void (async () => {
      try {
        const { data: cust } = await db
          .from('customers')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (!cust) return;
        const { data: pres } = await db
          .from('prescriptions')
          .select(
            'id, sphere_od, sphere_os, cyl_od, cyl_os, axis_od, axis_os, pd, status, created_at',
          )
          .eq('customer_id', cust.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pres) setPrescription(pres);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [user, authLoading]);

  if (authLoading) return null;

  const displayName = user?.user_metadata?.full_name || user?.email || 'Customer';
  const shortId = user?.id?.slice(0, 8).toUpperCase() ?? '—';
  const memberSince = user?.created_at ? formatDate(user.created_at) : '—';
  const lastOrder = orders[0] ? formatDate(orders[0].created_at) : '—';

  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-16 pt-[15px] sm:pb-24">
      <div className="site-container">
        {/* Top Profile Card */}
        <div className="relative mb-8 flex flex-col items-center gap-8 overflow-hidden rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:rounded-[32px] sm:p-10 md:flex-row md:items-start">
          <div className="pointer-events-none absolute right-[-20px] top-[-20px] opacity-[0.03]">
            <svg className="h-64 w-64" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
            </svg>
          </div>

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#2A3182] shadow-lg sm:h-[160px] sm:w-[160px]">
              <span className="select-none text-[48px] font-black text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="absolute bottom-2 right-2 rounded-full bg-white p-0.5 shadow-sm">
              <VerifyBadgeIcon />
            </div>
          </div>

          {/* Info */}
          <div className="z-10 flex-1 text-center md:text-left">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#2A3182] px-3 py-1 text-white">
              <ShieldCrossIcon />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Verified Account
              </span>
            </div>
            <h1 className="mb-2 text-[32px] font-black leading-tight text-[#2A3182] sm:text-[40px]">
              {displayName}
            </h1>
            <div className="mb-6 flex items-center justify-center gap-2 text-[14px] font-medium text-gray-500 sm:text-[15px] md:justify-start">
              <BuildingIcon />
              <span>{user?.email}</span>
            </div>

            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <button className="flex w-full items-center justify-center gap-2 rounded-full bg-[#EF4444] px-6 py-3 text-[14px] font-bold text-white shadow-md shadow-red-500/20 transition-colors hover:bg-red-600 sm:w-auto">
                <FolderIcon />
                My Prescriptions
              </button>
              <button
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-[14px] font-bold text-gray-600 transition-colors hover:bg-gray-50 sm:w-auto"
              >
                <DownloadIcon />
                Sign Out
              </button>
            </div>
          </div>

          {/* Right Floating Pills */}
          <div className="z-10 mt-6 flex w-full flex-col gap-3 md:mt-0 md:w-auto">
            <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-[#f8fafc] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                <IdCardIcon />
              </div>
              <div>
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Customer ID
                </p>
                <p className="text-[14px] font-bold text-[#1a1a1a]">OP-{shortId}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-[#f8fafc] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                <CalendarIcon />
              </div>
              <div>
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Member Since
                </p>
                <p className="text-[14px] font-bold text-[#1a1a1a]">{memberSince}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section */}
        <div className="mb-8 flex flex-col gap-8 lg:flex-row">
          {/* Left — Prescription Record (fixture until prescriptions are wired) */}
          <div className="flex flex-[2] flex-col overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm sm:rounded-[32px]">
            <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-100 bg-[#fafbfc] p-6 sm:flex-row sm:items-center sm:p-8">
              <div className="flex items-center gap-3">
                <div className="text-[#2A3182]">
                  <TableIcon />
                </div>
                <h2 className="text-[16px] font-bold uppercase tracking-wide text-[#1a1a1a]">
                  Vision Prescription Record
                </h2>
              </div>
              {prescription ? (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-gray-400">
                    {formatDate(prescription.created_at)}
                  </span>
                  <span
                    className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      prescription.status === 'processed'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {prescription.status === 'processed' ? 'Processed' : 'Pending'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-gray-400">
                    No prescription on file
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col p-6 sm:p-8">
              <div className="mb-8 overflow-x-auto">
                <table className="w-full min-w-[500px] border-collapse text-left">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="w-1/3 pb-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                        Metric
                      </th>
                      <th className="w-1/3 pb-4 text-[11px] font-bold uppercase tracking-widest text-[#2A3182]">
                        OD (Right Eye)
                      </th>
                      <th className="w-1/3 pb-4 text-[11px] font-bold uppercase tracking-widest text-[#2A3182]">
                        OS (Left Eye)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[16px] font-black text-[#1a1a1a] sm:text-[18px]">
                    <tr className="border-b border-gray-50">
                      <td className="py-5 text-[13px] font-medium text-gray-500">Sphere (SPH)</td>
                      <td className="py-5">
                        {prescription
                          ? prescription.sphere_od != null
                            ? (prescription.sphere_od > 0 ? '+' : '') +
                              Number(prescription.sphere_od).toFixed(2)
                            : '—'
                          : '-2.50'}
                      </td>
                      <td className="py-5">
                        {prescription
                          ? prescription.sphere_os != null
                            ? (prescription.sphere_os > 0 ? '+' : '') +
                              Number(prescription.sphere_os).toFixed(2)
                            : '—'
                          : '-2.25'}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-50">
                      <td className="py-5 text-[13px] font-medium text-gray-500">Cylinder (CYL)</td>
                      <td className="py-5">
                        {prescription
                          ? prescription.cyl_od != null
                            ? (prescription.cyl_od > 0 ? '+' : '') +
                              Number(prescription.cyl_od).toFixed(2)
                            : '—'
                          : '-0.75'}
                      </td>
                      <td className="py-5">
                        {prescription
                          ? prescription.cyl_os != null
                            ? (prescription.cyl_os > 0 ? '+' : '') +
                              Number(prescription.cyl_os).toFixed(2)
                            : '—'
                          : '-1.00'}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-50">
                      <td className="py-5 text-[13px] font-medium text-gray-500">Axis</td>
                      <td className="py-5">
                        {prescription
                          ? prescription.axis_od != null
                            ? prescription.axis_od + '°'
                            : '—'
                          : '165°'}
                      </td>
                      <td className="py-5">
                        {prescription
                          ? prescription.axis_os != null
                            ? String(prescription.axis_os).padStart(3, '0') + '°'
                            : '—'
                          : '015°'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-5 text-[13px] font-medium text-gray-500">PD (mm)</td>
                      <td className="colspan={2} py-5 text-gray-500">
                        {prescription
                          ? prescription.pd != null
                            ? Number(prescription.pd).toFixed(1)
                            : '—'
                          : '—'}
                      </td>
                      <td className="py-5 text-gray-300">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-auto">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-[#2A3182]">
                    <NotesIcon />
                  </div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Clinical Notes & Recommendations
                  </h3>
                </div>
                <p className="mb-8 pl-11 text-[15px] font-medium leading-relaxed text-gray-600">
                  Blue light filter recommended for digital screen usage. Anti-reflective coating
                  recommended.
                </p>
                <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-6">
                  <div>
                    <p className="mb-1 text-[11px] text-gray-400">
                      Upload your prescription to get personalised recommendations.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-center">
                    <div className="flex flex-col items-center">
                      <div className="mb-1 flex h-8 w-8 items-center justify-center">
                        <ShieldCheckIcon />
                      </div>
                      <span className="text-[8px] font-bold tracking-wider text-gray-500">
                        CERTIFIED PORTAL
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="flex flex-1 flex-col gap-8">
            <div className="relative flex flex-col justify-center overflow-hidden rounded-[24px] bg-[#1a1a5c] p-8 text-white shadow-lg shadow-[#1a1a5c]/20 sm:rounded-[32px] sm:p-10">
              <div className="pointer-events-none absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 transform opacity-10">
                <VirtualLensIcon />
              </div>
              <div className="relative z-10 mb-6">
                <VirtualLensIcon />
              </div>
              <h3 className="relative z-10 mb-3 text-[20px] font-bold">Virtual Lens Calibration</h3>
              <p className="relative z-10 mb-8 text-[14px] leading-relaxed text-indigo-200">
                Map your latest RX to our precision frames using clinical-grade AR fitting.
              </p>
              <button className="relative z-10 w-full rounded-full bg-white py-3.5 text-[14px] font-bold text-[#1a1a5c] shadow-md transition-colors hover:bg-gray-50">
                Launch Diagnostic Fit
              </button>
            </div>

            <div className="flex-1 rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:rounded-[32px]">
              <div className="mb-6 flex items-center gap-2">
                <SecurityIcon />
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Account Settings
                </h3>
              </div>
              <ul className="flex flex-col">
                <li className="group flex cursor-pointer items-center justify-between border-b border-gray-50 py-4">
                  <span className="text-[14px] font-medium text-gray-700 transition-colors group-hover:text-[#2A3182]">
                    Security & Password
                  </span>
                  <RightArrowIcon />
                </li>
                <li className="group flex cursor-pointer items-center justify-between border-b border-gray-50 py-4">
                  <span className="text-[14px] font-medium text-gray-700 transition-colors group-hover:text-[#2A3182]">
                    Order History
                  </span>
                  <RightArrowIcon />
                </li>
                <li className="group flex cursor-pointer items-center justify-between py-4">
                  <span className="text-[14px] font-medium text-gray-700 transition-colors group-hover:text-[#2A3182]">
                    Delivery Addresses
                  </span>
                  <RightArrowIcon />
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Order History Table */}
        <div className="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm sm:rounded-[32px]">
          <div className="flex items-center justify-between border-b border-gray-100 bg-[#fafbfc] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <HistoryNavIcon />
              <h2 className="text-[16px] font-bold uppercase tracking-wide text-[#1a1a1a]">
                Order History
              </h2>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {orders.length} orders
            </span>
          </div>

          {ordersLoading ? (
            <div className="p-10 text-center text-[14px] text-gray-400">Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="p-10 text-center">
              <p className="mb-2 text-[15px] font-medium text-gray-500">No orders yet</p>
              <p className="text-[13px] text-gray-400">
                Your order history will appear here once you place your first order.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-gray-100 bg-white">
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-gray-400 sm:px-8">
                      Order #
                    </th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-gray-400 sm:px-8">
                      Date
                    </th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-gray-400 sm:px-8">
                      Payment
                    </th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-gray-400 sm:px-8">
                      Status
                    </th>
                    <th className="px-6 py-5 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 sm:px-8">
                      Total
                    </th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-gray-400 sm:px-8"></th>
                  </tr>
                </thead>
                <tbody className="text-[14px] font-medium text-[#1a1a1a]">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                    >
                      <td className="px-6 py-6 font-bold sm:px-8">{order.order_number}</td>
                      <td className="px-6 py-6 text-gray-500 sm:px-8">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-6 capitalize text-gray-500 sm:px-8">
                        {order.payment_method?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-6 sm:px-8">
                        <span
                          className={`inline-flex items-center rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[order.status] ?? 'border-gray-200 bg-gray-50 text-gray-600'}`}
                        >
                          <span
                            className={`mr-1.5 h-1.5 w-1.5 rounded-full ${STATUS_DOTS[order.status] ?? 'bg-gray-400'}`}
                          ></span>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-right sm:px-8">
                        <span className="mr-1 text-[11px] font-bold uppercase text-gray-400">
                          KSH.
                        </span>
                        <span className="text-[16px] font-black">
                          {Number(order.total_kes).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-6 sm:px-8">
                        <Link
                          href={`/orders/${order.id}/tracking`}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#2A3182] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#1e2461]"
                        >
                          Track
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
