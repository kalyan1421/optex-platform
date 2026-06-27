'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@optex/db/browser';
import { listOrdersForCustomer } from '@optex/db';
import { formatKes } from '@optex/ui';

// Icons
const VerifyBadgeIcon = () => (
  <svg className="w-5 h-5 text-[#2A3182]" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

const ShieldCrossIcon = () => (
  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-4 h-4 text-[#2A3182]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const IdCardIcon = () => (
  <svg className="w-4 h-4 text-[#3b82f6]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4 text-[#10b981]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const TableIcon = () => (
  <svg className="w-5 h-5 text-[#2A3182]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const NotesIcon = () => (
  <svg className="w-5 h-5 text-[#2A3182]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const VirtualLensIcon = () => (
  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const SecurityIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const HistoryNavIcon = () => (
  <svg className="w-5 h-5 text-[#2A3182]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RightArrowIcon = () => (
  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg className="w-8 h-8 text-gray-800" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const STATUS_STYLES = {
  delivered:        'bg-green-50 text-green-700 border-green-200',
  dispatched:       'bg-blue-50 text-blue-700 border-blue-200',
  processing:       'bg-yellow-50 text-yellow-700 border-yellow-200',
  pending_payment:  'bg-gray-50 text-gray-600 border-gray-200',
  cancelled:        'bg-red-50 text-red-700 border-red-200',
};

const STATUS_DOTS = {
  delivered:        'bg-green-500',
  dispatched:       'bg-blue-500',
  processing:       'bg-yellow-500',
  pending_payment:  'bg-gray-400',
  cancelled:        'bg-red-500',
};

function statusLabel(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [prescription, setPrescription] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!user) return;
    const db = createBrowserSupabase();
    // Fetch orders
    listOrdersForCustomer(db, user.id)
      .then(setOrders)
      .catch(console.error)
      .finally(() => setOrdersLoading(false));
    // Fetch most recent prescription via customer bridge
    void (async () => {
      try {
        const { data: cust } = await db.from('customers').select('id').eq('auth_user_id', user.id).maybeSingle();
        if (!cust) return;
        const { data: pres } = await db
          .from('prescriptions')
          .select('id, sphere_od, sphere_os, cyl_od, cyl_os, axis_od, axis_os, pd, status, created_at')
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
    <div className="min-h-screen bg-[#f4f6f8] pt-[15px] pb-16 sm:pb-24">
      <div className="site-container">

        {/* Top Profile Card */}
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center md:items-start gap-8 mb-8 relative overflow-hidden">
          <div className="absolute right-[-20px] top-[-20px] opacity-[0.03] pointer-events-none">
            <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
            </svg>
          </div>

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] rounded-full border-4 border-white shadow-lg overflow-hidden bg-[#2A3182] flex items-center justify-center">
              <span className="text-[48px] font-black text-white select-none">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="absolute bottom-2 right-2 bg-white rounded-full p-0.5 shadow-sm">
              <VerifyBadgeIcon />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left z-10">
            <div className="inline-flex items-center gap-1.5 bg-[#2A3182] text-white px-3 py-1 rounded-full mb-3">
              <ShieldCrossIcon />
              <span className="text-[10px] font-bold tracking-widest uppercase">Verified Account</span>
            </div>
            <h1 className="text-[32px] sm:text-[40px] font-black text-[#2A3182] leading-tight mb-2">{displayName}</h1>
            <div className="flex items-center justify-center md:justify-start gap-2 text-gray-500 font-medium mb-6 text-[14px] sm:text-[15px]">
              <BuildingIcon />
              <span>{user?.email}</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button className="w-full sm:w-auto bg-[#EF4444] text-white px-6 py-3 rounded-full text-[14px] font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2 shadow-md shadow-red-500/20">
                <FolderIcon />
                My Prescriptions
              </button>
              <button
                onClick={async () => { await signOut(); router.push('/'); }}
                className="w-full sm:w-auto bg-white border border-gray-200 text-gray-600 px-6 py-3 rounded-full text-[14px] font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                <DownloadIcon />
                Sign Out
              </button>
            </div>
          </div>

          {/* Right Floating Pills */}
          <div className="flex flex-col gap-3 z-10 w-full md:w-auto mt-6 md:mt-0">
            <div className="bg-[#f8fafc] rounded-2xl p-4 flex items-center gap-4 border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <IdCardIcon />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">Customer ID</p>
                <p className="text-[14px] font-bold text-[#1a1a1a]">OP-{shortId}</p>
              </div>
            </div>
            <div className="bg-[#f8fafc] rounded-2xl p-4 flex items-center gap-4 border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <CalendarIcon />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">Member Since</p>
                <p className="text-[14px] font-bold text-[#1a1a1a]">{memberSince}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section */}
        <div className="flex flex-col lg:flex-row gap-8 mb-8">

          {/* Left — Prescription Record (fixture until prescriptions are wired) */}
          <div className="flex-[2] bg-white rounded-[24px] sm:rounded-[32px] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-6 sm:p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#fafbfc]">
              <div className="flex items-center gap-3">
                <div className="text-[#2A3182]"><TableIcon /></div>
                <h2 className="text-[16px] font-bold text-[#1a1a1a] tracking-wide uppercase">Vision Prescription Record</h2>
              </div>
              {prescription ? (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-gray-400">
                    {formatDate(prescription.created_at)}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                    prescription.status === 'processed' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {prescription.status === 'processed' ? 'Processed' : 'Pending'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-gray-400">No prescription on file</span>
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col">
              <div className="overflow-x-auto mb-8">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="pb-4 text-[11px] font-bold text-gray-400 tracking-widest uppercase w-1/3">Metric</th>
                      <th className="pb-4 text-[11px] font-bold text-[#2A3182] tracking-widest uppercase w-1/3">OD (Right Eye)</th>
                      <th className="pb-4 text-[11px] font-bold text-[#2A3182] tracking-widest uppercase w-1/3">OS (Left Eye)</th>
                    </tr>
                  </thead>
                  <tbody className="text-[16px] sm:text-[18px] font-black text-[#1a1a1a]">
                    <tr className="border-b border-gray-50">
                      <td className="py-5 text-[13px] font-medium text-gray-500">Sphere (SPH)</td>
                      <td className="py-5">{prescription ? (prescription.sphere_od != null ? (prescription.sphere_od > 0 ? '+' : '') + Number(prescription.sphere_od).toFixed(2) : '—') : '-2.50'}</td>
                      <td className="py-5">{prescription ? (prescription.sphere_os != null ? (prescription.sphere_os > 0 ? '+' : '') + Number(prescription.sphere_os).toFixed(2) : '—') : '-2.25'}</td>
                    </tr>
                    <tr className="border-b border-gray-50">
                      <td className="py-5 text-[13px] font-medium text-gray-500">Cylinder (CYL)</td>
                      <td className="py-5">{prescription ? (prescription.cyl_od != null ? (prescription.cyl_od > 0 ? '+' : '') + Number(prescription.cyl_od).toFixed(2) : '—') : '-0.75'}</td>
                      <td className="py-5">{prescription ? (prescription.cyl_os != null ? (prescription.cyl_os > 0 ? '+' : '') + Number(prescription.cyl_os).toFixed(2) : '—') : '-1.00'}</td>
                    </tr>
                    <tr className="border-b border-gray-50">
                      <td className="py-5 text-[13px] font-medium text-gray-500">Axis</td>
                      <td className="py-5">{prescription ? (prescription.axis_od != null ? prescription.axis_od + '°' : '—') : '165°'}</td>
                      <td className="py-5">{prescription ? (prescription.axis_os != null ? String(prescription.axis_os).padStart(3, '0') + '°' : '—') : '015°'}</td>
                    </tr>
                    <tr>
                      <td className="py-5 text-[13px] font-medium text-gray-500">PD (mm)</td>
                      <td className="py-5 text-gray-500 colspan={2}">{prescription ? (prescription.pd != null ? Number(prescription.pd).toFixed(1) : '—') : '—'}</td>
                      <td className="py-5 text-gray-300">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-auto">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-[#2A3182]">
                    <NotesIcon />
                  </div>
                  <h3 className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Clinical Notes & Recommendations</h3>
                </div>
                <p className="text-[15px] text-gray-600 font-medium leading-relaxed pl-11 mb-8">
                  Blue light filter recommended for digital screen usage. Anti-reflective coating recommended.
                </p>
                <div className="flex justify-between items-end border-t border-gray-100 pt-6 mt-4">
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">Upload your prescription to get personalised recommendations.</p>
                  </div>
                  <div className="flex items-center gap-4 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 mb-1 flex justify-center items-center"><ShieldCheckIcon /></div>
                      <span className="text-[8px] font-bold text-gray-500 tracking-wider">CERTIFIED PORTAL</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="flex-1 flex flex-col gap-8">
            <div className="bg-[#1a1a5c] rounded-[24px] sm:rounded-[32px] p-8 sm:p-10 text-white shadow-lg shadow-[#1a1a5c]/20 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
                <VirtualLensIcon />
              </div>
              <div className="mb-6 relative z-10"><VirtualLensIcon /></div>
              <h3 className="text-[20px] font-bold mb-3 relative z-10">Virtual Lens Calibration</h3>
              <p className="text-[14px] text-indigo-200 leading-relaxed mb-8 relative z-10">
                Map your latest RX to our precision frames using clinical-grade AR fitting.
              </p>
              <button className="w-full bg-white text-[#1a1a5c] py-3.5 rounded-full text-[14px] font-bold hover:bg-gray-50 transition-colors relative z-10 shadow-md">
                Launch Diagnostic Fit
              </button>
            </div>

            <div className="bg-white rounded-[24px] sm:rounded-[32px] shadow-sm border border-gray-100 p-6 flex-1">
              <div className="flex items-center gap-2 mb-6">
                <SecurityIcon />
                <h3 className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Account Settings</h3>
              </div>
              <ul className="flex flex-col">
                <li className="flex items-center justify-between py-4 border-b border-gray-50 cursor-pointer group">
                  <span className="text-[14px] font-medium text-gray-700 group-hover:text-[#2A3182] transition-colors">Security & Password</span>
                  <RightArrowIcon />
                </li>
                <li className="flex items-center justify-between py-4 border-b border-gray-50 cursor-pointer group">
                  <span className="text-[14px] font-medium text-gray-700 group-hover:text-[#2A3182] transition-colors">Order History</span>
                  <RightArrowIcon />
                </li>
                <li className="flex items-center justify-between py-4 cursor-pointer group">
                  <span className="text-[14px] font-medium text-gray-700 group-hover:text-[#2A3182] transition-colors">Delivery Addresses</span>
                  <RightArrowIcon />
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Order History Table */}
        <div className="bg-white rounded-[24px] sm:rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-center bg-[#fafbfc]">
            <div className="flex items-center gap-3">
              <HistoryNavIcon />
              <h2 className="text-[16px] font-bold text-[#1a1a1a] tracking-wide uppercase">Order History</h2>
            </div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{orders.length} orders</span>
          </div>

          {ordersLoading ? (
            <div className="p-10 text-center text-[14px] text-gray-400">Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-[15px] font-medium text-gray-500 mb-2">No orders yet</p>
              <p className="text-[13px] text-gray-400">Your order history will appear here once you place your first order.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b-2 border-gray-100 bg-white">
                    <th className="py-5 px-6 sm:px-8 text-[10px] font-bold text-gray-400 tracking-widest uppercase">Order #</th>
                    <th className="py-5 px-6 sm:px-8 text-[10px] font-bold text-gray-400 tracking-widest uppercase">Date</th>
                    <th className="py-5 px-6 sm:px-8 text-[10px] font-bold text-gray-400 tracking-widest uppercase">Payment</th>
                    <th className="py-5 px-6 sm:px-8 text-[10px] font-bold text-gray-400 tracking-widest uppercase">Status</th>
                    <th className="py-5 px-6 sm:px-8 text-[10px] font-bold text-gray-400 tracking-widest uppercase text-right">Total</th>
                    <th className="py-5 px-6 sm:px-8 text-[10px] font-bold text-gray-400 tracking-widest uppercase"></th>
                  </tr>
                </thead>
                <tbody className="text-[14px] font-medium text-[#1a1a1a]">
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-6 px-6 sm:px-8 font-bold">{order.order_number}</td>
                      <td className="py-6 px-6 sm:px-8 text-gray-500">{formatDate(order.created_at)}</td>
                      <td className="py-6 px-6 sm:px-8 text-gray-500 capitalize">{order.payment_method?.replace(/_/g, ' ')}</td>
                      <td className="py-6 px-6 sm:px-8">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[order.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${STATUS_DOTS[order.status] ?? 'bg-gray-400'}`}></span>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="py-6 px-6 sm:px-8 text-right">
                        <span className="text-[11px] font-bold text-gray-400 uppercase mr-1">KSH.</span>
                        <span className="text-[16px] font-black">{Number(order.total_kes).toFixed(2)}</span>
                      </td>
                      <td className="py-6 px-6 sm:px-8">
                        <Link
                          href={`/orders/${order.id}/tracking`}
                          className="inline-flex items-center gap-1.5 bg-[#2A3182] text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-[#1e2461] transition-colors whitespace-nowrap"
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
