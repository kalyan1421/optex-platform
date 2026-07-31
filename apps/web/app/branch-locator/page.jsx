'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@optex/db/browser';

// ── Fallback centre of Nairobi ────────────────────────────────────────────────
const NAIROBI_LAT = -1.2921;
const NAIROBI_LNG = 36.8219;

// ── Build the Google Maps embed URL ─────────────────────────────────────────
function buildMapUrl(branch) {
  if (branch?.lat && branch?.lng) {
    return `https://maps.google.com/maps?q=${branch.lat},${branch.lng}&z=15&output=embed`;
  }
  if (branch?.address) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(branch.address)}&output=embed`;
  }
  return `https://maps.google.com/maps?q=${NAIROBI_LAT},${NAIROBI_LNG}&z=13&output=embed`;
}

// ── Skeleton card ────────────────────────────────────────────────────────────
function BranchCardSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-[18px] border border-[#e5e7eb] bg-white p-5">
      <div className="h-4 w-2/3 rounded bg-gray-200" />
      <div className="h-3 w-full rounded bg-gray-100" />
      <div className="h-3 w-1/2 rounded bg-gray-100" />
      <div className="h-3 w-3/4 rounded bg-gray-100" />
      <div className="mt-2 h-8 w-36 rounded-full bg-gray-200" />
    </div>
  );
}

// ── Branch hours formatter ───────────────────────────────────────────────────
function HoursDisplay({ hours }) {
  if (!hours) return null;
  const rows = [];
  if (hours.weekday) rows.push({ label: 'Mon–Fri', value: hours.weekday });
  if (hours.saturday) rows.push({ label: 'Saturday', value: hours.saturday });
  if (hours.sunday) rows.push({ label: 'Sunday', value: hours.sunday });
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-start gap-2 text-[12.5px] text-gray-500">
          <span className="w-16 flex-shrink-0 font-semibold text-gray-700">{label}:</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Single branch card ────────────────────────────────────────────────────────
function BranchCard({ branch, isSelected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[18px] border p-5 text-left transition-all duration-200 focus:outline-none ${
        isSelected
          ? 'border-[#2A3182] bg-blue-50 shadow-md'
          : 'border-[#e5e7eb] bg-white hover:border-[#2A3182]/40 hover:shadow-sm'
      }`}
    >
      {/* Branch name */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold leading-tight text-gray-900">{branch.name}</h3>
        {isSelected && (
          <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#2A3182]">
            <svg
              className="h-3 w-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </span>
        )}
      </div>

      {/* Address */}
      {branch.address && (
        <div className="mb-2 flex items-start gap-2 text-[13px] text-gray-600">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E53935]"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          <span>{branch.address}</span>
        </div>
      )}

      {/* Phone */}
      {branch.phone && (
        <div className="mb-3 flex items-center gap-2 text-[13px]">
          <svg
            className="h-4 w-4 flex-shrink-0 text-gray-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
          <a
            href={`tel:${branch.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-[#2A3182] hover:underline"
          >
            {branch.phone}
          </a>
        </div>
      )}

      {/* Hours */}
      {branch.hours && (
        <div className="mb-4 flex items-start gap-2">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
          <HoursDisplay hours={branch.hours} />
        </div>
      )}

      {/* Book Appointment */}
      <Link
        href={`/appointments?branch=${branch.id}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#2A3182] px-5 py-2 text-[12px] font-bold text-white shadow transition-all hover:bg-[#1e2361] hover:shadow-md active:scale-95"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Book Appointment
      </Link>
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BranchLocatorPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const db = createBrowserSupabase();
    db.from('branches')
      .select('id, name, address, phone, hours, lat, lng')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        const list = data ?? [];
        setBranches(list);
        if (list.length > 0) setSelectedBranch(list[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleSelectBranch(branch) {
    setSelectedBranch(branch);
    // Smooth-scroll the map into view on mobile
    if (mapRef.current) {
      mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const mapUrl = selectedBranch
    ? buildMapUrl(selectedBranch)
    : `https://maps.google.com/maps?q=${NAIROBI_LAT},${NAIROBI_LNG}&z=13&output=embed`;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ──────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1A1A2E] py-16 sm:py-20">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#2A3182]/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-[#E53935]/20 blur-3xl" />

        <div className="relative mx-auto max-w-screen-xl px-4 text-center sm:px-8">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.25em] text-[#E53935]">
            OUR LOCATIONS
          </p>
          <h1 className="text-[36px] font-black leading-tight text-white sm:text-[50px]">
            Find an Optex Store Near You
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] font-medium leading-relaxed text-white/70">
            Discover your nearest Optex Opticians branch across Kenya. Walk in or book an
            appointment at a time that suits you.
          </p>
        </div>
      </section>

      {/* ── Main content ──────────────────────────────── */}
      <main className="mx-auto max-w-screen-xl px-4 py-12 sm:px-8 sm:py-16">
        {/* Info bar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-gray-500">
              {loading
                ? 'Loading branches…'
                : `${branches.length} location${branches.length !== 1 ? 's' : ''} found`}
            </p>
          </div>
          {selectedBranch && !loading && (
            <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-4 py-1.5 text-[12px] font-semibold text-[#2A3182]">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              {selectedBranch.name}
            </div>
          )}
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
          {/* ── Left: Branch list sidebar ────────────── */}
          <div className="w-full flex-shrink-0 lg:w-[380px] xl:w-[420px]">
            <div className="lg:scrollbar-thin space-y-3 lg:max-h-[calc(100vh-240px)] lg:overflow-y-auto lg:pr-1">
              {loading ? (
                <>
                  <BranchCardSkeleton />
                  <BranchCardSkeleton />
                  <BranchCardSkeleton />
                </>
              ) : branches.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[#e5e7eb] bg-[#f8f9fa] px-6 py-12 text-center">
                  <div className="mb-3 flex items-center justify-center">
                    <svg
                      className="h-10 w-10 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-[14px] font-semibold text-gray-400">
                    No active branches found.
                  </p>
                  <p className="mt-1 text-[12px] text-gray-400">Please check back soon.</p>
                </div>
              ) : (
                branches.map((branch) => (
                  <BranchCard
                    key={branch.id}
                    branch={branch}
                    isSelected={selectedBranch?.id === branch.id}
                    onClick={() => handleSelectBranch(branch)}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Right: Map area ──────────────────────── */}
          <div ref={mapRef} className="flex-1">
            <div className="sticky top-6 overflow-hidden rounded-[24px] border border-[#e5e7eb] shadow-md transition-shadow hover:shadow-xl">
              {/* Map header strip */}
              {selectedBranch && !loading && (
                <div className="flex items-center gap-2 border-b border-[#e5e7eb] bg-white px-5 py-3">
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-[#E53935]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-gray-900">
                      {selectedBranch.name}
                    </p>
                    {selectedBranch.address && (
                      <p className="truncate text-[11px] text-gray-400">{selectedBranch.address}</p>
                    )}
                  </div>
                  <a
                    href={
                      selectedBranch.lat && selectedBranch.lng
                        ? `https://maps.google.com/maps?q=${selectedBranch.lat},${selectedBranch.lng}`
                        : `https://maps.google.com/maps?q=${encodeURIComponent(selectedBranch.address ?? '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex-shrink-0 rounded-full bg-[#2A3182] px-4 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#1e2361]"
                  >
                    Open in Maps
                  </a>
                </div>
              )}

              {/* Skeleton / iframe */}
              {loading ? (
                <div className="flex h-[400px] animate-pulse items-center justify-center bg-gray-100">
                  <div className="flex flex-col items-center gap-3 text-gray-300">
                    <svg
                      className="h-12 w-12"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                    <p className="text-[13px] font-medium">Loading map…</p>
                  </div>
                </div>
              ) : (
                <iframe
                  key={mapUrl}
                  src={mapUrl}
                  width="100%"
                  height="400"
                  style={{ border: 0, display: 'block' }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  title={
                    selectedBranch ? `Map for ${selectedBranch.name}` : 'Optex Opticians locations'
                  }
                />
              )}
            </div>

            {/* All branches overview link */}
            {!loading && branches.length > 1 && selectedBranch && (
              <button
                type="button"
                onClick={() => setSelectedBranch(null)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-[#e5e7eb] py-2.5 text-[12.5px] font-semibold text-gray-500 transition-all hover:border-[#2A3182] hover:text-[#2A3182]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
                Show all branches overview
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
