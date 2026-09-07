'use client';

import React, { useId, useRef, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Customer-facing prescription upload.
 *
 * Closes the gap CLAUDE.md recorded: `POST /prescriptions/upload` and its
 * list/download siblings are built, typed and e2e-tested, but nothing in the
 * storefront ever called them — there was no way for a customer to send in the
 * paper prescription they already hold.
 *
 * The constraints below deliberately mirror `PrescriptionsService`:
 *   - the same three MIME types it allows,
 *   - the same 10 MB ceiling.
 * Checking here is a courtesy, not the enforcement: the server re-checks both,
 * and additionally sniffs the leading bytes, so a .exe renamed to .pdf is
 * refused there no matter what this form thinks. The point of the client-side
 * check is that a customer on a Kenyan mobile connection learns their 30 MB
 * photo is too big before spending the upload, not after.
 */

const ACCEPT = 'application/pdf,image/jpeg,image/png';
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Measurement fields the upload endpoint accepts alongside the file. */
const MEASUREMENTS = [
  { key: 'sphere_od', label: 'Sphere (right)', placeholder: '-1.25', step: '0.25' },
  { key: 'sphere_os', label: 'Sphere (left)', placeholder: '-1.00', step: '0.25' },
  { key: 'cyl_od', label: 'Cylinder (right)', placeholder: '-0.50', step: '0.25' },
  { key: 'cyl_os', label: 'Cylinder (left)', placeholder: '-0.50', step: '0.25' },
  { key: 'axis_od', label: 'Axis (right)', placeholder: '90', step: '1' },
  { key: 'axis_os', label: 'Axis (left)', placeholder: '85', step: '1' },
  { key: 'pd', label: 'PD (mm)', placeholder: '63', step: '0.5' },
];

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** `'-1.25'` → `-1.25`; blank or unparseable → undefined so the key is omitted. */
function num(value) {
  const t = String(value ?? '').trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export default function PrescriptionUpload({ onUploaded, compact = false }) {
  const inputId = useId();
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [fields, setFields] = useState({});
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  function pick(selected) {
    setError('');
    setDone(false);
    if (!selected) {
      setFile(null);
      return;
    }
    // An empty `type` happens on some Android pickers; fall back to the
    // extension rather than rejecting a legitimate file outright.
    const type = selected.type || guessType(selected.name);
    if (!ALLOWED_MIME.has(type)) {
      setFile(null);
      setError('That file type is not supported. Upload a PDF, JPG or PNG.');
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(null);
      setError(`That file is ${humanSize(selected.size)}. The limit is 10 MB.`);
      return;
    }
    setFile(selected);
  }

  function guessType(name) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file || uploading) return;

    setUploading(true);
    setError('');
    try {
      const payload = {};
      for (const m of MEASUREMENTS) {
        const v = num(fields[m.key]);
        if (v !== undefined) payload[m.key] = v;
      }
      const created = await api.prescriptions.upload(file, payload);

      setDone(true);
      setFile(null);
      setFields({});
      setShowMeasurements(false);
      if (fileRef.current) fileRef.current.value = '';
      onUploaded?.(created);
    } catch (err) {
      console.error('[profile] prescription upload failed:', err);
      // 429 is reachable in normal use — uploads are capped at 20/min — so it
      // gets its own wording rather than the generic failure message.
      const status = err?.status ?? err?.statusCode;
      if (status === 429) {
        setError('Too many uploads in a row. Wait a minute and try again.');
      } else if (status === 413) {
        setError('That file is over the 10 MB limit.');
      } else {
        setError(err?.message || 'Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? '' : 'w-full max-w-[420px]'}>
      <label htmlFor={inputId} className="font-poppins block text-[13px] font-bold text-[#1a1a1a]">
        Upload your prescription
      </label>
      <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
        A photo or scan of the card your optician gave you. PDF, JPG or PNG, up to 10 MB.
      </p>

      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-err` : undefined}
        className="mt-3 block w-full text-[13px] text-gray-600 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-[#2A3182] file:px-4 file:py-2 file:text-[13px] file:font-bold file:text-white hover:file:bg-[#1e2461] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182]/40"
      />

      {file ? (
        <p className="mt-2 text-[12px] text-gray-500">
          Selected: <span className="font-medium text-[#1a1a1a]">{file.name}</span> (
          {humanSize(file.size)})
        </p>
      ) : null}

      {/* Optional, and collapsed by default: the file is the point, and asking
          for ten numbers up front is how an upload form stops being used. */}
      <button
        type="button"
        onClick={() => setShowMeasurements((v) => !v)}
        aria-expanded={showMeasurements}
        className="mt-3 text-[12px] font-semibold text-[#2A3182] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182]/40"
      >
        {showMeasurements ? 'Hide measurements' : 'Add the measurements too (optional)'}
      </button>

      {showMeasurements ? (
        <fieldset className="mt-3 grid grid-cols-2 gap-3">
          <legend className="sr-only">Prescription measurements</legend>
          {MEASUREMENTS.map((m) => (
            <div key={m.key} className="flex flex-col gap-1">
              <label
                htmlFor={`${inputId}-${m.key}`}
                className="text-[11px] font-semibold text-gray-600"
              >
                {m.label}
              </label>
              <input
                id={`${inputId}-${m.key}`}
                type="number"
                step={m.step}
                inputMode="decimal"
                placeholder={m.placeholder}
                value={fields[m.key] ?? ''}
                onChange={(e) => setFields((f) => ({ ...f, [m.key]: e.target.value }))}
                className="h-9 rounded-[10px] border border-gray-200 px-3 text-[13px] focus:border-[#2A3182] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182]/40"
              />
            </div>
          ))}
        </fieldset>
      ) : null}

      {error ? (
        <p id={`${inputId}-err`} role="alert" className="mt-3 text-[12px] font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {done ? (
        <p role="status" className="mt-3 text-[12px] font-medium text-green-700">
          Uploaded. An optician will review it and it will appear here once processed.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!file || uploading}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#2A3182] px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#1e2461] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2A3182]/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : 'Upload prescription'}
      </button>
    </form>
  );
}
