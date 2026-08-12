'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// ─── Icons ────────────────────────────────────────────────────────────────────

const EyeIcon = () => (
  <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const GlassesIcon = () => (
  <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 7h2a2 2 0 012 2v1a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2zm8 0h2a2 2 0 012 2v1a2 2 0 01-2 2h-2a2 2 0 01-2-2V9a2 2 0 012-2zm-4 2h.01"
    />
  </svg>
);

const ConsultIcon = () => (
  <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
    />
  </svg>
);

const MapPinIcon = () => (
  <svg
    className="h-4 w-4 flex-shrink-0 text-gray-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const PhoneIcon = () => (
  <svg
    className="h-4 w-4 flex-shrink-0 text-gray-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
    />
  </svg>
);

const ClockIcon = () => (
  <svg
    className="h-4 w-4 flex-shrink-0 text-gray-400"
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

const CheckCircleIcon = () => (
  <svg
    className="h-20 w-20 text-green-500"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const HomeIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

const RefreshIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

// ─── Constants ────────────────────────────────────────────────────────────────

const APPT_TYPES = [
  {
    value: 'eye_test',
    label: 'Eye Test',
    desc: 'Comprehensive vision examination',
    Icon: EyeIcon,
  },
  {
    value: 'frame_fitting',
    label: 'Frame Fitting',
    desc: 'Find your perfect frame fit',
    Icon: GlassesIcon,
  },
  {
    value: 'consultation',
    label: 'Consultation',
    desc: 'Expert optical advice & guidance',
    Icon: ConsultIcon,
  },
];

/**
 * Render a 24h `HH:MM` slot returned by `GET /appointments/slots` as a
 * 12-hour display label. The slot grid itself comes from the API — it is
 * derived from the branch's opening hours for that weekday, minus times
 * already taken. Never generate candidate slots on the client: the server
 * is the only thing that knows a branch's hours or what is already booked.
 */
function formatSlotLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${suffix}`;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatApptDate(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const dt = new Date(`${dateStr}T${timeStr}`);
  return dt.toLocaleString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Progress Indicator ───────────────────────────────────────────────────────

function ProgressBar({ step }) {
  const steps = ['Branch', 'Details', 'Your Info'];
  return (
    <div className="mb-8 flex items-center gap-0 sm:mb-10">
      {steps.map((label, i) => {
        const num = i + 1;
        const active = step === num;
        const done = step > num;
        return (
          <React.Fragment key={num}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${done ? 'bg-green-500 text-white' : active ? 'bg-[#2A3182] text-white' : 'border border-gray-200 bg-gray-100 text-gray-400'}`}
              >
                {done ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  num
                )}
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-[#2A3182]' : done ? 'text-green-600' : 'text-gray-400'}`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-2 mb-4 h-0.5 flex-1 rounded transition-colors ${done ? 'bg-green-400' : 'bg-gray-200'}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Branch Hours display ─────────────────────────────────────────────────────

function BranchHoursSummary({ hours }) {
  if (!hours) return <span className="text-gray-400">Hours not listed</span>;
  const obj = hours;
  // Summarise weekday/weekend pattern
  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const weekend = ['sat', 'sun'];
  const wdSlot = obj[weekdays[0]];
  const wdSame = weekdays.every((d) => JSON.stringify(obj[d]) === JSON.stringify(wdSlot));
  if (wdSame && wdSlot) {
    return (
      <span>
        Mon–Fri {wdSlot[0]}–{wdSlot[1]}
        {obj.sat ? `, Sat ${obj.sat[0]}–${obj.sat[1]}` : ', Sat closed'}
      </span>
    );
  }
  return <span>Mon–Fri: open</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(1);
  const [branches, setBranches] = useState([]);
  const [branchLoading, setBranchLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null);

  // Step 2
  const [apptType, setApptType] = useState('eye_test');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [stepNotes, setStepNotes] = useState('');

  // Real availability for the selected branch + date, from the API.
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');

  // Step 3
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Success
  const [success, setSuccess] = useState(false);
  const [bookedData, setBookedData] = useState(null);

  // Load branches
  useEffect(() => {
    api.branches
      .list()
      .then(setBranches)
      .catch(console.error)
      .finally(() => setBranchLoading(false));
  }, []);

  // Bookings require an account — `POST /appointments` rejects an anonymous
  // caller with a 401. Send the customer to sign in on arrival rather than
  // after they have picked a branch, a date, a slot and filled in their
  // details, which is what the submit-time check used to do. Matches
  // /checkout, which has always redirected on mount.
  //
  // Guarded on `authLoading`: `user` is undefined while the session resolves,
  // and redirecting then would bounce signed-in customers too (the H-3 fix on
  // checkout was exactly this bug).
  useEffect(() => {
    if (!authLoading && user === null) {
      router.replace(`/login?redirect=${encodeURIComponent('/appointments')}`);
    }
  }, [authLoading, user, router]);

  // Pre-fill contact details from the caller's own profile (best-effort).
  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const me = await api.account.me();
        if (me.full_name) setContactName(me.full_name);
        if (me.phone) setContactPhone(me.phone);
      } catch (_) {
        /* pre-fill is best-effort — never block the booking flow */
      }
    })();
  }, [user]);

  /**
   * Load real availability whenever the branch or date changes.
   *
   * The server derives the slot grid from the branch's opening hours for that
   * weekday and removes times already taken, so a slot shown here is a slot
   * that can actually be booked. A stale in-flight response must never
   * overwrite a newer one, hence the `cancelled` guard.
   */
  useEffect(() => {
    if (!selectedBranch || !date) {
      setSlots([]);
      setTime('');
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError('');

    api.appointments
      .slots({ branchId: selectedBranch.id, date })
      .then((res) => {
        if (cancelled) return;
        const available = res.slots ?? [];
        setSlots(available);
        // Keep the current choice only if it survived; otherwise clear it so
        // the customer cannot submit a time that is no longer offered.
        setTime((current) => (available.includes(current) ? current : ''));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('slots lookup failed:', err);
        setSlots([]);
        setTime('');
        setSlotsError('Could not load available times. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBranch, date]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedBranch) return;

    // An account is required to book (client decision B4). The mount-time
    // effect above is the real gate; this remains as a backstop for the
    // session expiring while the form is open, which would otherwise surface
    // as a raw 401 on submit.
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent('/appointments')}`);
      return;
    }

    if (!contactName.trim() || !contactPhone.trim()) {
      setSubmitError('Please enter your name and phone number.');
      return;
    }
    if (!date) {
      setSubmitError('Please select a date in Step 2.');
      return;
    }
    if (!time) {
      setSubmitError('Please select an available time in Step 2.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      // The API resolves the customer from the JWT and validates the slot
      // against branch opening hours, the slot grid, and existing bookings.
      // Contact details are collected for the branch's benefit and appended
      // to the note — the booking itself is owned by the authenticated user.
      const allNotes =
        [`Contact: ${contactName.trim()} (${contactPhone.trim()})`, stepNotes, notes]
          .filter(Boolean)
          .join(' | ') || undefined;

      await api.appointments.create({
        branchId: selectedBranch.id,
        date,
        time,
        type: apptType,
        notes: allNotes,
      });

      setBookedData({
        branchName: selectedBranch.name,
        type: APPT_TYPES.find((t) => t.value === apptType)?.label ?? apptType,
        datetime: formatApptDate(date, time),
      });
      setSuccess(true);
    } catch (err) {
      console.error('appointment booking failed:', err);
      // The API returns a specific, user-safe reason for the cases customers
      // actually hit — slot taken, branch closed, time not on the grid.
      // Surface it rather than a generic failure, and refresh availability so
      // the customer sees the current picture.
      setSubmitError(err?.message || 'Failed to book appointment. Please try again.');
      if (selectedBranch && date) {
        api.appointments
          .slots({ branchId: selectedBranch.id, date })
          .then((res) => {
            const available = res.slots ?? [];
            setSlots(available);
            setTime((current) => (available.includes(current) ? current : ''));
          })
          .catch(() => {
            /* the error above is already shown */
          });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetWizard() {
    setStep(1);
    setSelectedBranch(null);
    setApptType('eye_test');
    setDate('');
    setTime('');
    setSlots([]);
    setSlotsError('');
    setStepNotes('');
    setContactPhone('');
    setNotes('');
    setSubmitError('');
    setSuccess(false);
    setBookedData(null);
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success && bookedData) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] pb-16 pt-28 sm:pb-24 sm:pt-36">
        <div className="site-container mx-auto max-w-lg px-4">
          <div className="rounded-[24px] border border-gray-100 bg-white p-8 text-center shadow-sm sm:rounded-[32px] sm:p-12">
            <div className="mb-4 flex justify-center">
              <CheckCircleIcon />
            </div>
            <h1 className="mb-2 text-[28px] font-black leading-tight text-[#2A3182] sm:text-[34px]">
              Appointment Requested!
            </h1>
            <p className="mb-8 text-[14px] text-gray-500">We'll confirm via SMS within 2 hours.</p>

            <div className="mb-8 space-y-3 rounded-2xl border border-gray-100 bg-[#f8fafc] p-5 text-left">
              <div className="flex items-start gap-3">
                <MapPinIcon />
                <div>
                  <p className="mb-0.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Branch
                  </p>
                  <p className="text-[14px] font-bold text-[#2A3182]">{bookedData.branchName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ClockIcon />
                <div>
                  <p className="mb-0.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Type
                  </p>
                  <p className="text-[14px] font-bold text-[#2A3182]">{bookedData.type}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ClockIcon />
                <div>
                  <p className="mb-0.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Date & Time
                  </p>
                  <p className="text-[14px] font-bold text-[#2A3182]">{bookedData.datetime}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={resetWizard}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-[#2A3182] py-4 text-[14px] font-bold text-[#2A3182] transition-colors hover:bg-blue-50"
              >
                <RefreshIcon />
                Book Another
              </button>
              <button
                onClick={() => router.push('/')}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#2A3182] py-4 text-[14px] font-bold text-white transition-colors hover:bg-blue-900"
              >
                <HomeIcon />
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main wizard ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-16 pt-28 sm:pb-24 sm:pt-36">
      <div className="site-container mx-auto max-w-2xl px-4">
        {/* Page header */}
        <div className="mb-8 text-center sm:mb-10">
          <h1 className="mb-1 text-[28px] font-black leading-tight text-[#2A3182] sm:text-[36px]">
            Book an Appointment
          </h1>
          <p className="text-[14px] font-medium text-gray-500 sm:text-[15px]">
            {step === 1
              ? 'Select your preferred Optex branch'
              : step === 2
                ? 'Choose your appointment type and time'
                : 'Enter your contact details to confirm'}
          </p>
        </div>

        {/* Progress bar */}
        <ProgressBar step={step} />

        {/* ── Step 1: Choose Branch ── */}
        {step === 1 && (
          <div>
            {branchLoading ? (
              <div className="flex items-center justify-center py-16">
                <svg
                  className="h-10 w-10 animate-spin text-[#2A3182]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
            ) : branches.length === 0 ? (
              <div className="rounded-[24px] border border-gray-100 bg-white p-10 text-center shadow-sm sm:rounded-[32px]">
                <p className="mb-2 text-[15px] font-medium text-gray-500">No branches available</p>
                <p className="text-[13px] text-gray-400">
                  Please check back later or contact us directly.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {branches.map((branch) => {
                  const isSelected = selectedBranch?.id === branch.id;
                  return (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setSelectedBranch(branch);
                        setStep(2);
                      }}
                      className={`rounded-2xl border-2 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md sm:p-6 ${
                        isSelected
                          ? 'border-[#2A3182] shadow-[0_0_0_3px_rgba(42,49,130,0.12)]'
                          : 'border-gray-100 hover:border-[#2A3182]/40'
                      }`}
                    >
                      {/* Branch name */}
                      <div className="mb-3 flex items-start justify-between">
                        <h3 className="pr-2 text-[16px] font-black leading-tight text-[#2A3182]">
                          {branch.name}
                        </h3>
                        {isSelected && (
                          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#2A3182]">
                            <svg
                              className="h-3 w-3 text-white"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Address */}
                      {branch.address && (
                        <div className="mb-2 flex items-start gap-2">
                          <MapPinIcon />
                          <span className="text-[13px] leading-snug text-gray-600">
                            {branch.address}
                          </span>
                        </div>
                      )}

                      {/* Phone */}
                      {branch.phone && (
                        <div className="mb-2 flex items-center gap-2">
                          <PhoneIcon />
                          <span className="text-[13px] text-gray-600">{branch.phone}</span>
                        </div>
                      )}

                      {/* Hours */}
                      {branch.hours && (
                        <div className="flex items-center gap-2">
                          <ClockIcon />
                          <span className="text-[12px] text-gray-500">
                            <BranchHoursSummary hours={branch.hours} />
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Appointment Details ── */}
        {step === 2 && (
          <div className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:rounded-[32px] sm:p-10">
            {/* Selected branch summary */}
            {selectedBranch && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                <MapPinIcon />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Selected Branch
                  </p>
                  <p className="text-[14px] font-bold text-[#2A3182]">{selectedBranch.name}</p>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="ml-auto text-[12px] font-bold text-[#2A3182] hover:underline"
                >
                  Change
                </button>
              </div>
            )}

            {/* Appointment type */}
            <div className="mb-6">
              <label className="mb-3 block text-[13px] font-bold uppercase tracking-widest text-[#2A3182]">
                Appointment Type
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {APPT_TYPES.map(({ value, label, desc, Icon }) => {
                  const active = apptType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setApptType(value)}
                      className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-5 text-center transition-all ${
                        active
                          ? 'border-[#2A3182] bg-blue-50/40 shadow-[0_0_0_3px_rgba(42,49,130,0.10)]'
                          : 'border-gray-200 bg-white hover:border-[#2A3182]/40'
                      }`}
                    >
                      <span className={active ? 'text-[#2A3182]' : 'text-gray-400'}>
                        <Icon />
                      </span>
                      <div>
                        <p
                          className={`text-[14px] font-bold ${active ? 'text-[#2A3182]' : 'text-gray-700'}`}
                        >
                          {label}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-gray-400">{desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date and time */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">
                  Preferred Date
                </label>
                <input
                  type="date"
                  min={todayString()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors focus:border-[#2A3182] focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">
                  Available Time
                </label>
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={!date || slotsLoading || slots.length === 0}
                  className="w-full rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors focus:border-[#2A3182] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {!date && <option value="">Select a date first</option>}
                  {date && slotsLoading && <option value="">Loading available times…</option>}
                  {date && !slotsLoading && slots.length === 0 && (
                    <option value="">No times available on this date</option>
                  )}
                  {date && !slotsLoading && slots.length > 0 && (
                    <>
                      <option value="">Select a time</option>
                      {slots.map((slot) => (
                        <option key={slot} value={slot}>
                          {formatSlotLabel(slot)}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {slotsError && <p className="mt-1.5 text-[12px] text-[#E53935]">{slotsError}</p>}
                {date && !slotsLoading && !slotsError && slots.length === 0 && (
                  <p className="mt-1.5 text-[12px] text-gray-500">
                    This branch is closed or fully booked on that date. Try another day.
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-8">
              <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">
                Notes <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Any specific concerns or requests…"
                value={stepNotes}
                onChange={(e) => setStepNotes(e.target.value)}
                className="w-full resize-none rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-gray-200 bg-white px-6 py-3.5 text-[14px] font-bold text-gray-600 transition-colors hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!date || !time) {
                    return;
                  }
                  setStep(3);
                }}
                disabled={!date || !time}
                className="rounded-full bg-[#111827] px-8 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to Your Details
              </button>
            </div>
            {!date && (
              <p className="mt-3 text-[12px] font-medium text-red-500">
                Please select a date to continue.
              </p>
            )}
            {date && !time && !slotsLoading && slots.length > 0 && (
              <p className="mt-3 text-[12px] font-medium text-red-500">
                Please select an available time to continue.
              </p>
            )}
          </div>
        )}

        {/* ── Step 3: Your Details ── */}
        {step === 3 && (
          <div className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:rounded-[32px] sm:p-10">
            {/* Summary pills */}
            <div className="mb-6 flex flex-wrap gap-2">
              {selectedBranch && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-[#2A3182]">
                  <MapPinIcon />
                  {selectedBranch.name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-[#2A3182]">
                {APPT_TYPES.find((t) => t.value === apptType)?.label}
              </span>
              {date && time && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-[#2A3182]">
                  <ClockIcon />
                  {formatApptDate(date, time)}
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4 sm:mb-6">
                <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">
                  Contact Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Jane Mwangi"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white"
                />
              </div>

              <div className="mb-4 sm:mb-6">
                <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">
                  Contact Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="07XXXXXXXX"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white"
                />
                <p className="mt-1.5 text-[12px] text-gray-400">
                  Kenyan format: 07XXXXXXXX or +2547XXXXXXXX
                </p>
              </div>

              <div className="mb-8">
                <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">
                  Additional Notes <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Any additional information for the branch…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full resize-none rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white"
                />
              </div>

              {submitError && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[14px] font-medium text-red-600">
                  {submitError}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-full border border-gray-200 bg-white px-6 py-3.5 text-[14px] font-bold text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 rounded-full bg-[#c1272d] px-8 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-red-500/20 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Booking…
                    </>
                  ) : (
                    <>
                      Book Appointment
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
