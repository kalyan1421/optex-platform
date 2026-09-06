'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { formatKes, formatKesNumber } from '@optex/ui';
import CancelOrder from '@/components/orders/CancelOrder';
import { api } from '@/lib/api';

// Icons
const VerifyBadgeIcon = () => (
  <svg className="h-5 w-5 text-[#2A3182]" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);

const ShieldCrossIcon = () => (
  <svg
    className="h-3 w-3 text-[#5C4415]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const BuildingIcon = ({ className = 'h-4 w-4 text-[#2A3182]' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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

const EyeGlyphIcon = () => (
  <svg
    className="h-5 w-5 text-[#2A3182]"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
    />
    <circle cx="12" cy="12" r="2.75" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v4l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const PinIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ApptNavIcon = () => (
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
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const CalendarPlainIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const RxEmptyIcon = () => (
  <svg
    className="h-7 w-7 text-[#2A3182]"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
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

// ─── Prescription formatting ─────────────────────────────────────────────────

/** The two eyes of an RX, in the order an optician reads them. */
const RX_EYES = [
  { key: 'od', abbr: 'OD', name: 'Right eye' },
  { key: 'os', abbr: 'OS', name: 'Left eye' },
];

/**
 * Dioptre values always carry a sign and two decimals — "+1.25", "-0.75" —
 * because in an RX the sign is the clinically meaningful part, not decoration.
 * Returns null (not a placeholder) when the optician left the field blank, so
 * the caller decides how an absent measurement is rendered.
 */
function formatDioptre(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return (n > 0 ? '+' : '') + n.toFixed(2);
}

/** Axis runs 1-180 and is conventionally written zero-padded to three digits. */
function formatAxis(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return String(Math.round(n)).padStart(3, '0') + '\u00B0';
}

// ─── Appointment formatting ──────────────────────────────────────────────────

const APPT_STATUS_STYLES = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rescheduled: 'border-blue-200 bg-blue-50 text-blue-700',
  completed: 'border-gray-200 bg-gray-50 text-gray-600',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
};

const APPT_STATUS_DOTS = {
  pending: 'bg-amber-500',
  confirmed: 'bg-emerald-500',
  rescheduled: 'bg-blue-500',
  completed: 'bg-gray-400',
  cancelled: 'bg-red-500',
};

const APPT_TYPE_LABELS = {
  eye_test: 'Eye Test',
  frame_fitting: 'Frame Fitting',
  consultation: 'Consultation',
};

function apptTypeLabel(type) {
  return APPT_TYPE_LABELS[type] ?? statusLabel(String(type ?? 'appointment'));
}

/**
 * Bookings are stored as UTC timestamptz but are always *about* a wall-clock
 * time in the branch, so every appointment formatter pins Africa/Nairobi
 * explicitly. Without it a customer travelling abroad sees their Nairobi eye
 * test shifted into a different hour, or a different day.
 */
const NAIROBI = 'Africa/Nairobi';

function formatApptDate(iso) {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: NAIROBI,
  });
}

function formatApptTime(iso) {
  return new Date(iso).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: NAIROBI,
  });
}

/** Day number + short month, for the date tile on an upcoming booking. */
function apptDayParts(iso) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('en-KE', { day: '2-digit', timeZone: NAIROBI }),
    month: d.toLocaleDateString('en-KE', { month: 'short', timeZone: NAIROBI }).toUpperCase(),
  };
}

/**
 * "Upcoming" is both a clock question and a status question: a cancelled or
 * already-completed booking is history even if its slot has not arrived yet.
 */
function isUpcoming(appt, now) {
  if (appt.status === 'cancelled' || appt.status === 'completed') return false;
  return new Date(appt.scheduled_at).getTime() >= now;
}

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [prescription, setPrescription] = useState(null);
  const [eyeRecords, setEyeRecords] = useState([]);
  const [eyeRecordsLoading, setEyeRecordsLoading] = useState(true);
  const [rxDownloading, setRxDownloading] = useState(false);
  const [rxDownloadError, setRxDownloadError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [apptsLoading, setApptsLoading] = useState(true);
  const [apptsError, setApptsError] = useState('');
  const [branchNames, setBranchNames] = useState({});
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;
    // Order history through the API.
    //
    // This used to call listOrdersForCustomer(db, user.id), which filters
    // `orders.customer_id` — but `user.id` is the auth user id, and those are
    // different values, so the table was empty for every customer who had ever
    // ordered. The API scopes to the caller's customers.id from the JWT, so
    // there is no id to pass and no id to get wrong. Also one fewer direct
    // Supabase read for Wave 3.
    api.orders
      .list()
      .then((res) => setOrders(res?.data ?? []))
      .catch((error) => {
        console.error('Could not load orders:', error);
        setOrdersError(error?.message ?? 'Could not load your orders.');
      })
      .finally(() => setOrdersLoading(false));
    api.eyeRecords
      .listMine()
      .then((rows) => setEyeRecords(rows ?? []))
      .catch((err) => console.error('[profile] eye records fetch failed:', err))
      .finally(() => setEyeRecordsLoading(false));

    api.prescriptions
      .listMine()
      .then((prescriptions) => setPrescription(prescriptions?.[0] ?? null))
      .catch((error) => console.error('Could not load prescription:', error));
    // Bookings for this customer. `GET /appointments` scopes to the caller's
    // customers.id from the JWT, so there is no id to pass here either.
    api.appointments
      .listMine()
      .then((rows) => setAppointments(Array.isArray(rows) ? rows : []))
      .catch((error) => {
        console.error('Could not load appointments:', error);
        setApptsError(error?.message ?? 'Could not load your appointments.');
      })
      .finally(() => setApptsLoading(false));
    // An appointment row carries only `branch_id`, so resolve the names once
    // rather than per row. A failure here is cosmetic — the bookings still
    // render, just without a branch name — so it must not surface an error.
    api.branches
      .list()
      .then((rows) => {
        const byId = {};
        for (const b of rows ?? []) byId[b.id] = b.name;
        setBranchNames(byId);
      })
      .catch((error) => console.error('Could not load branches:', error));
  }, [user, authLoading, router]);

  async function handleDownloadRx() {
    if (!prescription || rxDownloading) return;
    setRxDownloading(true);
    setRxDownloadError('');
    try {
      // The bucket is private; the API ownership-checks and hands back a
      // short-lived signed URL rather than a permanent public link.
      const { url } = await api.prescriptions.download(prescription.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Could not download prescription:', error);
      setRxDownloadError(error?.message ?? 'Could not open that file.');
    } finally {
      setRxDownloading(false);
    }
  }

  async function handleCancelAppointment(id) {
    setCancellingId(id);
    setApptsError('');
    try {
      const updated = await api.appointments.cancel(id);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
    } catch (error) {
      console.error('Could not cancel appointment:', error);
      setApptsError(error?.message ?? 'Could not cancel that appointment.');
    } finally {
      setCancellingId(null);
    }
  }

  if (authLoading) return null;

  const displayName = user?.user_metadata?.full_name || user?.email || 'Customer';
  const shortId = user?.id?.slice(0, 8).toUpperCase() ?? '—';
  const memberSince = user?.created_at ? formatDate(user.created_at) : '—';
  // Decorative "barcode" on the membership card, below. Derived from the
  // customer's own ID rather than random so it's stable across renders (no
  // hydration mismatch) and happens to be unique per customer.
  const barcodeBars = shortId.split('').map((char) => 35 + (char.charCodeAt(0) % 65));
  const lastOrder = orders[0] ? formatDate(orders[0].created_at) : '—';

  // Split once, here, so the two lists below stay pure markup. Upcoming reads
  // soonest-first (the next visit is the useful one); history reads
  // newest-first (the last visit is the useful one).
  const nowMs = Date.now();
  const upcomingAppts = appointments
    .filter((a) => isUpcoming(a, nowMs))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const pastAppts = appointments
    .filter((a) => !isUpcoming(a, nowMs))
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-16 pt-[15px] sm:pb-24">
      <div className="site-container">
        {/* Top Profile Card — styled as a physical membership card: an
            identity panel and a card-details panel separated by a
            perforated "tear" divider, the way a loyalty or boarding-pass
            card splits the holder's name from their printed number. */}
        <div className="relative mb-8 overflow-hidden rounded-[24px] bg-[#1A1A2E] shadow-lg sm:rounded-[32px]">
          {/* Fine dot-grid texture — depth without a gradient or glass
              effect, at low enough opacity to read as paper grain. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          />
          <div className="pointer-events-none absolute right-[-24px] top-[-24px] text-white opacity-[0.04]">
            <svg className="h-64 w-64" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
            </svg>
          </div>

          <div className="relative flex flex-col md:flex-row">
            {/* Identity panel */}
            <div className="flex flex-1 flex-col items-center gap-6 p-6 text-center sm:p-10 md:flex-row md:items-start md:text-left">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full border-2 border-white/40 bg-white/10 shadow-lg sm:h-[140px] sm:w-[140px]">
                  <span className="select-none text-[44px] font-black text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="absolute bottom-1 right-1 rounded-full bg-[#EFE1C0] p-1 shadow-sm">
                  <VerifyBadgeIcon />
                </div>
              </div>

              {/* Info */}
              <div className="z-10 flex-1">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#EFE1C0] px-3 py-1">
                  <ShieldCrossIcon />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#5C4415]">
                    Verified Account
                  </span>
                </div>
                <h1 className="mb-1.5 text-[32px] font-black leading-tight text-white sm:text-[40px]">
                  {displayName}
                </h1>
                <div className="mb-6 flex items-center justify-center gap-2 text-[14px] font-medium text-white/60 sm:text-[15px] md:justify-start">
                  <BuildingIcon className="h-4 w-4 text-white/50" />
                  <span>{user?.email}</span>
                </div>

                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <a
                    href="#prescription-record"
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[#E53935] px-6 py-3 text-[14px] font-bold text-white shadow-md shadow-black/20 transition-colors hover:bg-[#c62828] sm:w-auto"
                  >
                    <FolderIcon />
                    My Prescriptions
                  </a>
                  <button
                    onClick={async () => {
                      await signOut();
                      router.push('/');
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
                  >
                    <DownloadIcon />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>

            {/* Perforated tear divider — desktop: vertical, mobile: horizontal.
                The notch circles match the page background so the dashed
                line reads as a die-cut edge, not just a border. */}
            <div aria-hidden="true" className="relative hidden shrink-0 md:block md:w-px">
              <div className="absolute inset-y-8 left-0 border-l-2 border-dashed border-white/15" />
              <div className="absolute -left-[9px] -top-[9px] h-[18px] w-[18px] rounded-full bg-[#f4f6f8]" />
              <div className="absolute -bottom-[9px] -left-[9px] h-[18px] w-[18px] rounded-full bg-[#f4f6f8]" />
            </div>
            <div aria-hidden="true" className="relative mx-6 block md:hidden">
              <div className="border-t-2 border-dashed border-white/15" />
              <div className="absolute -left-[9px] -top-[9px] h-[18px] w-[18px] rounded-full bg-[#f4f6f8]" />
              <div className="absolute -right-[9px] -top-[9px] h-[18px] w-[18px] rounded-full bg-[#f4f6f8]" />
            </div>

            {/* Card details panel — printed like the imprint on the card */}
            <div className="z-10 flex flex-col justify-center gap-6 p-6 text-center sm:p-10 md:w-[240px] md:text-left">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  Customer ID
                </p>
                <p className="font-mono text-[18px] font-bold tracking-[0.08em] text-white">
                  OP-{shortId}
                </p>
                <div
                  aria-hidden="true"
                  className="mt-2 flex h-4 items-end justify-center gap-[2px] opacity-30 md:justify-start"
                >
                  {barcodeBars.map((height, i) => (
                    <span key={i} className="w-[2px] bg-white" style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  Member Since
                </p>
                <p className="text-[15px] font-bold text-white">{memberSince}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section */}
        <div className="mb-8 flex flex-col gap-8 lg:flex-row">
          {/* Left — Vision Prescription Record */}
          <section
            id="prescription-record"
            aria-labelledby="rx-heading"
            className="flex flex-[2] scroll-mt-24 flex-col overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm sm:rounded-[32px]"
          >
            <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-100 bg-[#fafbfc] p-6 sm:flex-row sm:items-center sm:p-8">
              <div className="flex items-center gap-3">
                <div className="text-[#2A3182]">
                  <TableIcon />
                </div>
                <h2
                  id="rx-heading"
                  className="text-[16px] font-bold uppercase tracking-wide text-[#1a1a1a]"
                >
                  Vision Prescription Record
                </h2>
              </div>
              {prescription ? (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-gray-400">
                    Issued {formatDate(prescription.created_at)}
                  </span>
                  <span
                    className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      prescription.status === 'processed'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {prescription.status === 'processed' ? 'Processed' : 'Pending review'}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] font-medium text-gray-400">
                  No prescription on file
                </span>
              )}
            </div>

            {prescription ? (
              <div className="flex flex-1 flex-col p-6 sm:p-8">
                {/* One card per eye. The old layout was a metric-by-eye table,
                    which forced a 500px min-width and read as a spreadsheet;
                    an RX is naturally two small groups of three numbers. */}
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  {RX_EYES.map((eye) => {
                    const measurements = [
                      {
                        label: 'Sphere',
                        abbr: 'SPH',
                        value: formatDioptre(prescription[`sphere_${eye.key}`]),
                      },
                      {
                        label: 'Cylinder',
                        abbr: 'CYL',
                        value: formatDioptre(prescription[`cyl_${eye.key}`]),
                      },
                      {
                        label: 'Axis',
                        abbr: 'AXIS',
                        value: formatAxis(prescription[`axis_${eye.key}`]),
                      },
                    ];
                    return (
                      <article
                        key={eye.key}
                        className="rounded-2xl border border-gray-100 bg-[#fafbfc] p-5"
                      >
                        <div className="mb-5 flex items-center justify-between">
                          <div>
                            <p className="text-[13px] font-black uppercase tracking-widest text-[#2A3182]">
                              {eye.abbr}
                            </p>
                            <p className="text-[12px] font-medium text-gray-400">{eye.name}</p>
                          </div>
                          <EyeGlyphIcon />
                        </div>
                        <dl className="flex flex-col gap-4">
                          {measurements.map((m) => (
                            <div key={m.abbr} className="flex items-baseline justify-between gap-4">
                              <dt className="text-[13px] font-medium text-gray-500">
                                {m.label}{' '}
                                <span className="text-[11px] uppercase tracking-wider text-gray-400">
                                  {m.abbr}
                                </span>
                              </dt>
                              <dd
                                className={
                                  m.value
                                    ? 'font-mono text-[19px] font-black tabular-nums text-[#1a1a1a]'
                                    : 'text-[16px] font-medium text-gray-500'
                                }
                              >
                                {m.value ?? (
                                  <>
                                    <span aria-hidden="true">—</span>
                                    <span className="sr-only">Not recorded</span>
                                  </>
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </article>
                    );
                  })}
                </div>

                {/* PD is a single binocular measurement, not one value per eye.
                    The old table gave it an OD and an OS cell (and tried to
                    span them with a `colspan={2}` that landed in className),
                    which is why the row always showed a stray dash. */}
                <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-5">
                  <div>
                    <p className="text-[13px] font-medium text-gray-500">
                      Pupillary Distance{' '}
                      <span className="text-[11px] uppercase tracking-wider text-gray-400">PD</span>
                    </p>
                    <p className="text-[12px] text-gray-400">Measured across both eyes</p>
                  </div>
                  <p
                    className={
                      prescription.pd != null
                        ? 'font-mono text-[19px] font-black tabular-nums text-[#1a1a1a]'
                        : 'text-[16px] font-medium text-gray-500'
                    }
                  >
                    {prescription.pd != null ? (
                      <>
                        {Number(prescription.pd).toFixed(1)}
                        <span className="ml-1 text-[12px] font-bold uppercase text-gray-400">
                          mm
                        </span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">Not recorded</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-4 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {prescription.file_url ? (
                      <>
                        <button
                          type="button"
                          onClick={handleDownloadRx}
                          disabled={rxDownloading}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-[13px] font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <DownloadIcon />
                          {rxDownloading ? 'Preparing…' : 'Download original'}
                        </button>
                        {rxDownloadError ? (
                          <p role="alert" className="mt-2 text-[12px] font-medium text-red-700">
                            {rxDownloadError}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-[12px] text-gray-400">
                        Recorded by an Optex optician. Ask at any branch for a printed copy.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-center">
                    <ShieldCheckIcon />
                    <span className="mt-1 text-[8px] font-bold tracking-wider text-gray-500">
                      CERTIFIED PORTAL
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty state. This deliberately shows no numbers: the previous
                 version fell back to a hardcoded sample RX (-2.50 / -2.25 …)
                 that a customer could not tell apart from their own. */
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center sm:px-8">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                  <RxEmptyIcon />
                </div>
                <h3 className="mb-2 text-[18px] font-bold text-[#1a1a1a]">
                  No prescription on file yet
                </h3>
                <p className="mb-7 max-w-[380px] text-[14px] font-medium leading-relaxed text-gray-500">
                  Once an Optex optician completes your eye test, your sphere, cylinder, axis and PD
                  measurements appear here.
                </p>
                <Link
                  href="/appointments"
                  className="inline-flex items-center gap-2 rounded-full bg-[#2A3182] px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#1e2461]"
                >
                  <CalendarPlainIcon />
                  Book an eye test
                </Link>
              </div>
            )}
          </section>

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
                <li className="border-b border-gray-50">
                  <Link
                    href="/profile/security"
                    className="group flex items-center justify-between py-4"
                  >
                    <span className="text-[14px] font-medium text-gray-700 transition-colors group-hover:text-[#2A3182]">
                      Security &amp; Password
                    </span>
                    <RightArrowIcon />
                  </Link>
                </li>
                <li className="border-b border-gray-50">
                  <a href="#order-history" className="group flex items-center justify-between py-4">
                    <span className="text-[14px] font-medium text-gray-700 transition-colors group-hover:text-[#2A3182]">
                      Order History
                    </span>
                    <RightArrowIcon />
                  </a>
                </li>
                <li>
                  <Link
                    href="/profile/addresses"
                    className="group flex items-center justify-between py-4"
                  >
                    <span className="text-[14px] font-medium text-gray-700 transition-colors group-hover:text-[#2A3182]">
                      Delivery Addresses
                    </span>
                    <RightArrowIcon />
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Appointments — upcoming, then past visits */}
        <section
          aria-labelledby="appointments-heading"
          className="mb-8 overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm sm:rounded-[32px]"
        >
          <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-100 bg-[#fafbfc] p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="flex items-center gap-3">
              <ApptNavIcon />
              <h2
                id="appointments-heading"
                className="text-[16px] font-bold uppercase tracking-wide text-[#1a1a1a]"
              >
                Appointments
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                {upcomingAppts.length} upcoming
              </span>
              <Link
                href="/appointments"
                className="inline-flex items-center gap-2 rounded-full bg-[#2A3182] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#1e2461]"
              >
                <CalendarPlainIcon />
                Book
              </Link>
            </div>
          </div>

          {apptsLoading ? (
            <div className="p-10 text-center text-[14px] text-gray-400">Loading appointments…</div>
          ) : apptsError && appointments.length === 0 ? (
            <div className="p-10 text-center">
              <p role="alert" className="mb-4 text-[15px] font-medium text-red-700">
                {apptsError}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-[#2A3182] px-5 py-2.5 text-[13px] font-bold text-white"
              >
                Try again
              </button>
            </div>
          ) : appointments.length === 0 ? (
            <div className="p-10 text-center">
              <p className="mb-2 text-[15px] font-medium text-gray-500">No appointments yet</p>
              <p className="text-[13px] text-gray-400">
                Book an eye test, frame fitting or consultation at any Optex branch.
              </p>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              {/* A cancel that failed still needs reporting even though the
                  list itself rendered fine. */}
              {apptsError ? (
                <p
                  role="alert"
                  className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700"
                >
                  {apptsError}
                </p>
              ) : null}

              {upcomingAppts.length > 0 ? (
                <div className="mb-8">
                  <h3 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Upcoming
                  </h3>
                  <ul className="flex flex-col gap-4">
                    {upcomingAppts.map((appt) => {
                      const { day, month } = apptDayParts(appt.scheduled_at);
                      return (
                        <li
                          key={appt.id}
                          className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-[#fafbfc] p-5 sm:flex-row sm:items-center sm:gap-6"
                        >
                          <div className="flex h-[64px] w-[64px] flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-[#2A3182] text-white">
                            <span className="text-[22px] font-black leading-none">{day}</span>
                            <span className="mt-1 text-[10px] font-bold tracking-widest">
                              {month}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="mb-2 text-[16px] font-bold text-[#1a1a1a]">
                              {apptTypeLabel(appt.type)}
                            </p>
                            <div className="flex flex-col gap-2 text-[13px] font-medium text-gray-500 sm:flex-row sm:items-center sm:gap-5">
                              <span className="flex items-center gap-1.5">
                                <ClockIcon />
                                {formatApptTime(appt.scheduled_at)}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <PinIcon />
                                {branchNames[appt.branch_id] ?? 'Optex branch'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex items-center rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${APPT_STATUS_STYLES[appt.status] ?? 'border-gray-200 bg-gray-50 text-gray-600'}`}
                            >
                              <span
                                className={`mr-1.5 h-1.5 w-1.5 rounded-full ${APPT_STATUS_DOTS[appt.status] ?? 'bg-gray-400'}`}
                              />
                              {statusLabel(appt.status)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelAppointment(appt.id)}
                              disabled={cancellingId === appt.id}
                              className="whitespace-nowrap rounded-full border border-gray-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {cancellingId === appt.id ? 'Cancelling…' : 'Cancel'}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="mb-8 rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                  <p className="mb-1 text-[14px] font-medium text-gray-500">
                    No upcoming appointments
                  </p>
                  <p className="text-[13px] text-gray-400">Your past visits are listed below.</p>
                </div>
              )}

              {pastAppts.length > 0 ? (
                <div>
                  <h3 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Visit history
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse text-left">
                      <thead>
                        <tr className="border-b-2 border-gray-100">
                          <th className="pb-4 pr-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Date
                          </th>
                          <th className="pb-4 pr-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Time
                          </th>
                          <th className="pb-4 pr-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Service
                          </th>
                          <th className="pb-4 pr-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Branch
                          </th>
                          <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-[14px] font-medium text-[#1a1a1a]">
                        {pastAppts.map((appt) => (
                          <tr key={appt.id} className="border-b border-gray-50 last:border-b-0">
                            <td className="py-5 pr-6 font-bold">
                              {formatApptDate(appt.scheduled_at)}
                            </td>
                            <td className="py-5 pr-6 text-gray-500">
                              {formatApptTime(appt.scheduled_at)}
                            </td>
                            <td className="py-5 pr-6 text-gray-500">{apptTypeLabel(appt.type)}</td>
                            <td className="py-5 pr-6 text-gray-500">
                              {branchNames[appt.branch_id] ?? '—'}
                            </td>
                            <td className="py-5">
                              <span
                                className={`inline-flex items-center rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${APPT_STATUS_STYLES[appt.status] ?? 'border-gray-200 bg-gray-50 text-gray-600'}`}
                              >
                                <span
                                  className={`mr-1.5 h-1.5 w-1.5 rounded-full ${APPT_STATUS_DOTS[appt.status] ?? 'bg-gray-400'}`}
                                />
                                {statusLabel(appt.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* Eye-care intake records (migration 0037). Distinct from the
            Vision Prescription Record above: that is an uploaded document
            reviewed by staff, this is what the customer reported themselves
            through the /eye-care form. */}
        <section
          aria-labelledby="eye-records-heading"
          className="mb-8 overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm sm:rounded-[32px]"
        >
          <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-100 bg-[#fafbfc] p-6 sm:flex-row sm:items-center sm:p-8">
            <h2
              id="eye-records-heading"
              className="text-[16px] font-bold uppercase tracking-wide text-[#1a1a1a]"
            >
              Eye Care Records
            </h2>
            <Link
              href="/eye-care"
              className="inline-flex items-center gap-2 rounded-full bg-[#2A3182] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#1e2461]"
            >
              Submit a new record
            </Link>
          </div>

          {eyeRecordsLoading ? (
            <div className="p-10 text-center text-[14px] text-gray-400">Loading eye records…</div>
          ) : eyeRecords.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-[15px] text-gray-500">
                You haven’t submitted an eye-care record yet.
              </p>
              <p className="mt-1 text-[13px] text-gray-400">
                Fill one in before your next eye test and we’ll have your history ready.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {eyeRecords.map((r) => {
                const hasRx =
                  r.sphere_od != null ||
                  r.sphere_os != null ||
                  r.cyl_od != null ||
                  r.cyl_os != null ||
                  r.pd_od != null ||
                  r.pd_os != null;
                return (
                  <li
                    key={r.id}
                    className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[15px] font-bold text-[#1a1a1a]">{r.full_name}</span>
                        <span
                          className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            r.status === 'reviewed'
                              ? 'bg-green-50 text-green-600'
                              : r.status === 'archived'
                                ? 'bg-gray-100 text-gray-500'
                                : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          {r.status === 'reviewed'
                            ? 'Reviewed'
                            : r.status === 'archived'
                              ? 'Archived'
                              : 'Awaiting review'}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-gray-400">
                        Submitted {formatDate(r.created_at)}
                      </p>
                      {r.conditions?.length ? (
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {r.conditions.map((c) => (
                            <li
                              key={c}
                              className="rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-600"
                            >
                              {c}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      {hasRx ? (
                        <div className="font-mono text-[13px] tabular-nums text-[#1a1a1a]">
                          <div>
                            OD {formatDioptre(r.sphere_od)}
                            {r.cyl_od != null ? ` / ${formatDioptre(r.cyl_od)}` : ''}
                          </div>
                          <div>
                            OS {formatDioptre(r.sphere_os)}
                            {r.cyl_os != null ? ` / ${formatDioptre(r.cyl_os)}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[12px] italic text-gray-400">
                          Testing fresh — no prescription given
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Order History Table. `id` is the anchor target for the "Order
            History" link in the Account Settings panel above — it lives on
            this page already, so that link is a scroll, not a route. */}
        <div
          id="order-history"
          className="scroll-mt-24 overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm sm:rounded-[32px]"
        >
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
          ) : ordersError ? (
            <div className="p-10 text-center">
              <p className="mb-4 text-[15px] font-medium text-red-700">{ordersError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-[#2A3182] px-5 py-2.5 text-[13px] font-bold text-white"
              >
                Try again
              </button>
            </div>
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
                      <td className="px-6 py-6 font-bold sm:px-8">{order.orderNumber}</td>
                      <td className="px-6 py-6 text-gray-500 sm:px-8">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-6 capitalize text-gray-500 sm:px-8">
                        {order.paymentMethod?.replace(/_/g, ' ')}
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
                          {formatKesNumber(order.totalKes)}
                        </span>
                      </td>
                      <td className="px-6 py-6 sm:px-8">
                        <div className="flex flex-col items-start gap-2">
                          <Link
                            href={`/orders/${order.id}/tracking`}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#2A3182] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#1e2461]"
                          >
                            Track
                          </Link>
                          {/* SPEC-06 R1 — also reachable from order history, so a
                              customer does not have to open the order first. */}
                          {order.status !== 'cancelled' && (
                            <CancelOrder
                              orderId={order.id}
                              variant="compact"
                              onChanged={() => window.location.reload()}
                            />
                          )}
                        </div>
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
