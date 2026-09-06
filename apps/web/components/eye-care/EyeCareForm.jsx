'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

/**
 * The eye-record intake form.
 *
 * This was previously ~340 lines of markup inside the Server Component page:
 * no `<form>`, no state, no handler, and a "Submit my eye record" button that
 * did nothing at all. Every input was uncontrolled and the whole thing was a
 * static mockup of the working flow at /appointments.
 *
 * It now books a real `eye_test` appointment through `POST /appointments`.
 * Two consequences of that contract are worth knowing:
 *
 *   1. The endpoint requires a `branchId` and resolves the caller to their
 *      `customers` row, so this form needs a branch picker and a signed-in
 *      user. Both are handled below.
 *   2. `notes` is the only free-text field on the appointment. The clinical
 *      answers (history + prescription) are serialized into it so nothing the
 *      customer typed is silently dropped. That is a stopgap: a real
 *      `eye_records` table is backend work, and until it exists these values
 *      are not queryable — see the note in the page's docblock.
 *
 * Times come from `GET /appointments/slots` rather than a free-text `<input
 * type="time">`. The old field let a customer pick 03:00 on a closed Sunday.
 */

const CONDITIONS = [
  'Diabetes',
  'Glaucoma',
  'Cataracts',
  'Previous eye surgery',
  'Family history of eye disease',
  'Currently wear glasses',
  'Currently wear contact lenses',
  'None of the above',
];

const NONE = 'None of the above';

/** SPH/CYL/AXIS/ADD/PD, in the order the printed prescription card uses. */
const RX_COLUMNS = [
  { key: 'sph', label: 'SPH', placeholder: '0.00' },
  { key: 'cyl', label: 'CYL', placeholder: '0.00' },
  { key: 'axis', label: 'AXIS', placeholder: '0' },
  { key: 'add', label: 'ADD', placeholder: '0.00' },
  { key: 'pd', label: 'PD (MM)', placeholder: '32' },
];

const RX_EYES = [
  { key: 'od', label: 'Right (OD)' },
  { key: 'os', label: 'Left (OS)' },
];

const emptyRx = () => ({
  od: { sph: '', cyl: '', axis: '', add: '', pd: '' },
  os: { sph: '', cyl: '', axis: '', add: '', pd: '' },
});

/** Validation keys in visual order, so errors focus top-down. */
const FIELD_ORDER = ['fullName', 'age', 'phone', 'email', 'branchId', 'date', 'time'];

const FIELD_IDS = {
  fullName: 'eye-full-name',
  age: 'eye-age',
  phone: 'eye-phone',
  email: 'eye-email',
  branchId: 'eye-branch',
  date: 'eye-date',
  time: 'eye-time',
};

const FIELD =
  'font-inter h-[44px] w-full rounded-[14px] border-[0.8px] border-[#E5E7EB] px-[16px] py-[12px] text-[16px] font-normal transition-colors focus:border-[#2E3192] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E3192]/40';
const LABEL = 'font-poppins text-[14px] font-semibold leading-[21px] text-[#0F0F0F]';

function StepHeader({ number, title, subtitle }) {
  return (
    <div className="flex items-center gap-[12px]">
      <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[26px] border-[2px] border-[#2E3192] bg-[#2E3192]">
        <span className="font-outfit text-center text-[18px] font-extrabold leading-[100%] text-white">
          {number}
        </span>
      </div>
      <div className="flex flex-col justify-center gap-[2px]">
        <span className="font-poppins text-[16px] font-semibold leading-[21px] text-[#0F0F0F]">
          {title}
        </span>
        <span className="font-poppins text-[12px] font-normal leading-[21px] text-[#898989]">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

/** Inline error text, tied to its field by id so screen readers announce it. */
function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="font-inter text-[13px] leading-[18px] text-[#B51A13]">
      {children}
    </p>
  );
}

/** `'-1.25'` → `-1.25`; blank/garbage → undefined so the key is omitted. */
function num(value) {
  const t = String(value ?? '').trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Map the form state onto `POST /eye-records`.
 *
 * Blank prescription cells are omitted rather than sent as 0 — the form
 * explicitly invites the customer to leave them empty and be tested fresh, and
 * a stored 0.00 would be indistinguishable from a real plano reading.
 */
function buildEyeRecord(
  { fullName, age, phone, email, gender, conditions, historyNotes, rx },
  appointmentId,
) {
  const body = {
    appointmentId,
    fullName: fullName.trim(),
    phone: phone.trim(),
    conditions,
  };
  const maybe = {
    age: num(age),
    email: email.trim() || undefined,
    gender: gender || undefined,
    historyNotes: historyNotes.trim() || undefined,
    sphereOd: num(rx.od.sph),
    sphereOs: num(rx.os.sph),
    cylOd: num(rx.od.cyl),
    cylOs: num(rx.os.cyl),
    axisOd: num(rx.od.axis),
    axisOs: num(rx.os.axis),
    addOd: num(rx.od.add),
    addOs: num(rx.os.add),
    pdOd: num(rx.od.pd),
    pdOs: num(rx.os.pd),
  };
  for (const [k, v] of Object.entries(maybe)) {
    if (v !== undefined) body[k] = v;
  }
  return body;
}

export default function EyeCareForm() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [conditions, setConditions] = useState([]);
  const [historyNotes, setHistoryNotes] = useState('');
  const [rx, setRx] = useState(emptyRx);

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');

  const [errors, setErrors] = useState({});
  const [focusTarget, setFocusTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [booked, setBooked] = useState(null);

  // Prefill from the signed-in profile so a returning customer is not retyping
  // what we already hold.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.account
      .me()
      .then((me) => {
        if (cancelled || !me) return;
        setFullName((v) => v || me.full_name || '');
        setPhone((v) => v || me.phone || '');
        setEmail((v) => v || me.email || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    api.branches
      .list()
      .then((rows) => setBranches(rows ?? []))
      .catch((err) => console.error('[eye-care] branch list failed:', err));
  }, []);

  // Real availability, so a customer cannot request a slot that is already
  // taken or outside opening hours.
  useEffect(() => {
    if (!branchId || !date) {
      setSlots([]);
      setSlotsError('');
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError('');
    api.appointments
      .slots({ branchId, date })
      .then((res) => {
        if (cancelled) return;
        const available = res?.slots ?? [];
        setSlots(available);
        if (!available.length) setSlotsError('No times left on this date — please pick another.');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[eye-care] slots lookup failed:', err);
        setSlots([]);
        setSlotsError('Could not load available times. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, date]);

  // A slot chosen for one date must not survive a change of date or branch.
  useEffect(() => {
    setTime('');
  }, [branchId, date]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Runs after the commit that painted the error text, so the field is already
  // marked aria-invalid when it receives focus.
  useEffect(() => {
    if (!focusTarget) return;
    document.getElementById(FIELD_IDS[focusTarget])?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  function toggleCondition(label) {
    setConditions((prev) => {
      if (label === NONE) return prev.includes(NONE) ? [] : [NONE];
      const next = prev.includes(label)
        ? prev.filter((c) => c !== label)
        : [...prev.filter((c) => c !== NONE), label];
      return next;
    });
  }

  function setRxValue(eye, col, value) {
    setRx((prev) => ({ ...prev, [eye]: { ...prev[eye], [col]: value } }));
  }

  function validate() {
    const next = {};
    if (!fullName.trim()) next.fullName = 'Please tell us your name.';
    if (!phone.trim()) next.phone = 'We need a phone number to confirm by SMS.';
    else if (!/^[+\d][\d\s-]{6,}$/.test(phone.trim())) next.phone = 'Enter a valid phone number.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'Enter a valid email address.';
    if (age.trim() && (Number.isNaN(Number(age)) || Number(age) < 0 || Number(age) > 120))
      next.age = 'Enter an age between 0 and 120.';
    if (!branchId) next.branchId = 'Choose the branch you would like to visit.';
    if (!date) next.date = 'Choose a preferred date.';
    if (!time) next.time = 'Choose an available time.';
    setErrors(next);
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');

    const found = validate();
    if (Object.keys(found).length) {
      // Send focus to the first field the customer needs to fix. This is a
      // state flag consumed by an effect rather than a direct focus() call:
      // `aria-invalid` is not on the element yet at this point in the tick, and
      // a rAF callback would not run at all if the tab were backgrounded.
      setFocusTarget(FIELD_ORDER.find((k) => found[k]) ?? null);
      return;
    }

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent('/eye-care')}`);
      return;
    }

    setSubmitting(true);
    try {
      // Book the visit first: it owns the slot, and the eye record links to it.
      const appointment = await api.appointments.create({
        branchId,
        date,
        time,
        type: 'eye_test',
        notes: 'Eye-care intake submitted — see the linked eye record.',
      });

      // Then persist the clinical intake itself. If this second call fails the
      // appointment still stands, so the customer is told their visit is booked
      // rather than being sent back into a form that would double-book them.
      let recordSaved = true;
      try {
        await api.eyeRecords.create(
          buildEyeRecord(
            { fullName, age, phone, email, gender, conditions, historyNotes, rx },
            appointment?.id,
          ),
        );
      } catch (recordErr) {
        recordSaved = false;
        console.error('[eye-care] eye record save failed:', recordErr);
      }

      setBooked({
        date,
        time,
        branch: branches.find((b) => b.id === branchId)?.name ?? '',
        reference: appointment?.id ?? '',
        recordSaved,
      });
    } catch (err) {
      console.error('[eye-care] submission failed:', err);
      setSubmitError(
        err?.message || 'We could not submit your eye record. Please try again in a moment.',
      );
      // The slot may have been taken while the form was open.
      if (branchId && date) {
        api.appointments
          .slots({ branchId, date })
          .then((res) => setSlots(res?.slots ?? []))
          .catch(() => {});
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (booked) {
    return (
      <div
        role="status"
        className="flex w-full flex-col items-center rounded-[32px] border-t-[0.8px] border-[#F3F4F6] bg-white p-8 text-center shadow-[0px_25px_56px_-12px_rgba(0,0,0,0.25)] lg:p-10 xl:w-[786px]"
      >
        <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#2E3192]">
          <svg width="30" height="30" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M11.6663 3.5L5.24967 9.91667L2.33301 7" stroke="#FFFFFF" strokeWidth="1.6" />
          </svg>
        </div>
        <h2 className="font-poppins mt-6 text-[24px] font-bold text-[#0F0F0F]">
          Your eye record is in
        </h2>
        <p className="font-inter mt-3 max-w-[420px] text-[16px] leading-[24px] text-[#717182]">
          We have booked your eye test at {booked.branch} on {booked.date} at {booked.time}. We will
          confirm by SMS shortly.
        </p>
        {!booked.recordSaved ? (
          <p className="font-inter mt-4 max-w-[420px] rounded-[14px] bg-[#FFF6E5] px-4 py-3 text-[14px] leading-[20px] text-[#8A5A00]">
            Your appointment is confirmed, but we could not save your health and prescription
            details. Bring them with you and we will record them at the branch.
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/profile"
            className="font-poppins inline-flex h-[48px] items-center justify-center rounded-full bg-[#2E3192] px-8 text-[16px] font-semibold text-white transition-colors hover:bg-[#1e2361]"
          >
            View my appointments
          </a>
          <a
            href="/shop"
            className="font-poppins inline-flex h-[48px] items-center justify-center rounded-full border-2 border-[#2E3192] px-8 text-[16px] font-semibold text-[#2E3192] transition-colors hover:bg-[#2E3192]/5"
          >
            Browse frames
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="relative flex w-full flex-col rounded-[32px] border-t-[0.8px] border-[#F3F4F6] bg-white p-6 shadow-[0px_25px_56px_-12px_rgba(0,0,0,0.25)] lg:p-10 xl:w-[786px]"
    >
      {/* ── 01 Personal details ─────────────────────────────────────────── */}
      <StepHeader number="01" title="Personal details" subtitle="Who we're seeing today" />

      <div className="mt-[40px] flex flex-col gap-[20px]">
        <div className="flex flex-col gap-[20px] md:flex-row md:gap-[40px]">
          <div className="flex w-full flex-col gap-[8px] md:w-[333px]">
            <label htmlFor="eye-full-name" className={LABEL}>
              Full Name <span className="text-[#B51A13]">*</span>
            </label>
            <input
              id="eye-full-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={errors.fullName ? 'true' : undefined}
              aria-describedby={errors.fullName ? 'eye-full-name-err' : undefined}
              placeholder="Enter your name"
              className={FIELD}
            />
            <FieldError id="eye-full-name-err">{errors.fullName}</FieldError>
          </div>

          <div className="flex w-full flex-col gap-[8px] md:w-[333px]">
            <label htmlFor="eye-age" className={LABEL}>
              Age
            </label>
            <input
              id="eye-age"
              type="number"
              inputMode="numeric"
              min="0"
              max="120"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              aria-invalid={errors.age ? 'true' : undefined}
              aria-describedby={errors.age ? 'eye-age-err' : undefined}
              placeholder="Age"
              className={FIELD}
            />
            <FieldError id="eye-age-err">{errors.age}</FieldError>
          </div>
        </div>

        <div className="flex flex-col gap-[20px] md:flex-row md:gap-[40px]">
          <div className="flex w-full flex-col gap-[8px] md:w-[333px]">
            <label htmlFor="eye-phone" className={LABEL}>
              Phone number <span className="text-[#B51A13]">*</span>
            </label>
            <input
              id="eye-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={errors.phone ? 'true' : undefined}
              aria-describedby={errors.phone ? 'eye-phone-err' : undefined}
              placeholder="+254 700 000 000"
              className={FIELD}
            />
            <FieldError id="eye-phone-err">{errors.phone}</FieldError>
          </div>

          <div className="flex w-full flex-col gap-[8px] md:w-[333px]">
            <label htmlFor="eye-email" className={LABEL}>
              Email
            </label>
            <input
              id="eye-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'eye-email-err' : undefined}
              placeholder="yourname@gmail.com"
              className={`${FIELD} placeholder:text-[#0A0A0A]/50`}
            />
            <FieldError id="eye-email-err">{errors.email}</FieldError>
          </div>
        </div>

        <div className="flex flex-col gap-[20px] md:flex-row md:gap-[40px]">
          <div className="flex w-full flex-col gap-[8px] md:w-[333px]">
            <label htmlFor="eye-gender" className={LABEL}>
              Gender
            </label>
            <select
              id="eye-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={`${FIELD} cursor-pointer bg-white text-[#0A0A0A]`}
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Others">Others</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 02 Eye & health history ─────────────────────────────────────── */}
      <div className="mt-[40px] flex w-full flex-col gap-[24px]">
        <StepHeader
          number="02"
          title="Eye & health history"
          subtitle="Helps us catch what a fresh exam might miss"
        />

        <fieldset className="flex flex-col gap-[16px]">
          <legend className="font-poppins mb-2 text-[16px] font-semibold leading-[21px] text-[#161616]">
            Do any of these apply to you?{' '}
            <span className="font-normal text-[#898989]">(Select all that apply)</span>
          </legend>
          <div className="flex flex-wrap items-center gap-[12px]">
            {CONDITIONS.map((label) => {
              const checked = conditions.includes(label);
              return (
                <label
                  key={label}
                  className={`flex h-[44px] w-fit cursor-pointer items-center gap-[10px] rounded-[14px] border-[0.8px] px-[20px] py-[12px] transition-colors focus-within:ring-2 focus-within:ring-[#2E3192]/40 ${
                    checked ? 'border-[#2E3192] bg-[#EEF0FF]' : 'border-[#E5E7EB] bg-[#FBFBFF]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCondition(label)}
                    className="h-[19px] w-[19px] cursor-pointer rounded-[4px] border-[0.8px] border-[#E5E7EB] bg-white accent-[#2E3192]"
                  />
                  <span className="font-inter whitespace-nowrap text-[16px] font-normal leading-[100%] text-[#0A0A0A]">
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex w-full flex-col gap-[12px]">
          <label
            htmlFor="eye-history-notes"
            className="font-inter text-[16px] font-normal leading-[100%] text-[#0A0A0A]"
          >
            Past prescriptions or notes (optional)
          </label>
          <textarea
            id="eye-history-notes"
            value={historyNotes}
            onChange={(e) => setHistoryNotes(e.target.value)}
            placeholder="e.g. last tested in 2024"
            className="font-inter h-[76px] w-full resize-none rounded-[14px] border-[0.8px] border-[#E5E7EB] bg-[#FBFBFF] px-[20px] py-[12px] text-[16px] font-normal transition-colors placeholder:text-[#0A0A0A]/50 focus:border-[#2E3192] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E3192]/40"
          />
        </div>
      </div>

      {/* ── 03 Current prescription ─────────────────────────────────────── */}
      <div className="mt-[40px] flex w-full flex-col gap-[24px]">
        <StepHeader
          number="03"
          title="Current prescription"
          subtitle="(If known) Leave blank if you'd rather we test fresh"
        />

        {/*
          Was an absolutely-positioned pixel grid inside `hidden md:block`, so
          the whole section vanished on mobile and none of the ten inputs had a
          label. A real table keeps the same look, works at every width, and
          gives each cell an accessible name via scope="col"/scope="row".
        */}
        <div className="w-full overflow-x-auto rounded-[14px] border-[0.8px] border-[#E5E7EB] bg-[#FBFBFF]">
          <table className="w-full min-w-[560px] border-collapse">
            <caption className="sr-only">
              Current spectacle prescription for the right and left eye
            </caption>
            <thead>
              <tr className="border-b-[1px] border-[#E3E3E6] bg-[#F5F5FF]">
                <th
                  scope="col"
                  className="font-poppins px-[20px] py-[16px] text-left text-[16px] font-semibold leading-[21px] text-[#0F0F0F]"
                >
                  Eye
                </th>
                {RX_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className="font-poppins px-[8px] py-[16px] text-left text-[16px] font-semibold leading-[21px] text-[#0F0F0F]"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RX_EYES.map((eye) => (
                <tr key={eye.key}>
                  <th scope="row" className="px-[20px] py-[12px] text-left">
                    <span className="flex items-center gap-[8px]">
                      <span className="h-[12px] w-[12px] rounded-full bg-[#E53935]" />
                      <span className="font-poppins whitespace-nowrap text-[16px] font-semibold leading-[21px] text-[#E53935]">
                        {eye.label}
                      </span>
                    </span>
                  </th>
                  {RX_COLUMNS.map((c) => (
                    <td key={c.key} className="px-[8px] py-[12px]">
                      <label className="sr-only" htmlFor={`rx-${eye.key}-${c.key}`}>
                        {eye.label} {c.label}
                      </label>
                      <input
                        id={`rx-${eye.key}-${c.key}`}
                        type="text"
                        inputMode="decimal"
                        value={rx[eye.key][c.key]}
                        onChange={(ev) => setRxValue(eye.key, c.key, ev.target.value)}
                        placeholder={c.placeholder}
                        className="font-inter h-[38px] w-[76px] rounded-[8px] border-[0.8px] border-[#E5E7EB] bg-white px-[12px] text-[16px] font-normal transition-colors focus:border-[#2E3192] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E3192]/40"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 04 Preferred appointment ────────────────────────────────────── */}
      <div className="mt-[40px] flex w-full flex-col gap-[24px]">
        <StepHeader
          number="04"
          title="Preferred appointment"
          subtitle="We’ll confirm by SMS within the hour"
        />

        <div className="flex flex-col gap-[20px] md:flex-row md:gap-[40px]">
          <div className="flex w-full flex-col gap-[8px] md:w-[333px]">
            <label htmlFor="eye-branch" className={LABEL}>
              Branch <span className="text-[#B51A13]">*</span>
            </label>
            <select
              id="eye-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-invalid={errors.branchId ? 'true' : undefined}
              aria-describedby={errors.branchId ? 'eye-branch-err' : undefined}
              className={`${FIELD} cursor-pointer bg-white text-[#0A0A0A]`}
            >
              <option value="">{branches.length ? 'Select a branch' : 'Loading branches…'}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <FieldError id="eye-branch-err">{errors.branchId}</FieldError>
          </div>

          <div className="flex w-full flex-col gap-[8px] md:w-[333px]">
            <label htmlFor="eye-date" className={LABEL}>
              Preferred date <span className="text-[#B51A13]">*</span>
            </label>
            <input
              id="eye-date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={errors.date ? 'true' : undefined}
              aria-describedby={errors.date ? 'eye-date-err' : undefined}
              className={`${FIELD} bg-transparent text-[#0A0A0A]`}
            />
            <FieldError id="eye-date-err">{errors.date}</FieldError>
          </div>
        </div>

        <div className="flex w-full flex-col gap-[8px]">
          <label htmlFor="eye-time" className={LABEL}>
            Preferred time <span className="text-[#B51A13]">*</span>
          </label>
          <select
            id="eye-time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!branchId || !date || slotsLoading || !slots.length}
            aria-invalid={errors.time ? 'true' : undefined}
            aria-describedby={errors.time ? 'eye-time-err' : 'eye-time-hint'}
            className={`${FIELD} cursor-pointer bg-white text-[#0A0A0A] disabled:cursor-not-allowed disabled:bg-[#F5F5F5] disabled:text-[#898989] md:w-[333px]`}
          >
            <option value="">
              {slotsLoading
                ? 'Checking availability…'
                : !branchId || !date
                  ? 'Pick a branch and date first'
                  : slots.length
                    ? 'Select a time'
                    : 'No times available'}
            </option>
            {slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p id="eye-time-hint" className="font-inter text-[13px] leading-[18px] text-[#898989]">
            {slotsError || 'Only times the branch actually has free are listed.'}
          </p>
          <FieldError id="eye-time-err">{errors.time}</FieldError>
        </div>

        {submitError ? (
          <p
            role="alert"
            className="font-inter rounded-[14px] bg-[#FDECEA] px-[16px] py-[12px] text-[14px] leading-[20px] text-[#B51A13]"
          >
            {submitError}
          </p>
        ) : null}

        {!authLoading && !user ? (
          <p className="font-inter text-[14px] leading-[20px] text-[#717182]">
            You’ll be asked to sign in when you submit, so we can attach this record to your
            account.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-[16px] flex h-[54px] w-full items-center justify-center rounded-full bg-[#B51A13] transition-colors hover:bg-[#8e140f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B51A13]/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="font-poppins text-center text-[20.25px] font-semibold leading-[30.38px] text-white">
            {submitting ? 'Submitting…' : 'Submit my eye record'}
          </span>
        </button>
      </div>
    </form>
  );
}
