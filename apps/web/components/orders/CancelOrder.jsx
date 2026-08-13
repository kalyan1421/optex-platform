'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Request cancellation of an order — SPEC-06 R1, the customer half.
 *
 * Optex decides every cancellation; this only asks. So the language matters:
 * the customer is told their request was **received**, never that the order is
 * cancelled, because an admin has not looked at it yet. Telling someone their
 * order is cancelled and then declining it is worse than the phone call this
 * feature replaces.
 *
 * Eligibility is never computed here. The API returns `canRequest` and, when
 * false, the reason — so the storefront explains the answer rather than
 * deciding it. A client that decides can be made to decide differently, and
 * the same rules are enforced again on POST.
 */

/** Four states: ineligible, requestable, pending, decided. */
export default function CancelOrder({ orderId, variant = 'block', onChanged }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setState(await api.orders.cancellationStatus(orderId));
    } catch (e) {
      // A failed eligibility read must not break the order page around it —
      // the control simply does not appear.
      console.error('cancellation status failed:', e);
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      await api.orders.requestCancellation(orderId, reason.trim() || undefined);
      setOpen(false);
      setReason('');
      await load();
      onChanged?.();
    } catch (e) {
      // The API returns a specific, readable reason — outside the window,
      // already dispatched, already pending. Show that, not a generic failure.
      setError(e?.message ?? 'Could not submit that request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !state) return null;

  const request = state.request;
  const compact = variant === 'compact';

  // ── Already decided or waiting ───────────────────────────────────────────
  if (request && request.status !== 'declined') {
    const pending = request.status === 'pending';
    return (
      <div
        className={`rounded-[12px] border px-4 py-3 ${
          pending
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-gray-200 bg-gray-50 text-gray-600'
        } ${compact ? 'text-[12px]' : 'text-[14px]'}`}
      >
        <p className="m-0 font-semibold">
          {pending ? 'Cancellation requested' : 'Cancellation approved'}
        </p>
        <p className="m-0 mt-0.5 opacity-90">
          {pending
            ? 'We have your request and will confirm shortly.'
            : 'This order has been cancelled.'}
        </p>
      </div>
    );
  }

  // A declined request is shown with its reason, and — if the order is still
  // eligible — the customer may ask again. Circumstances change.
  const declined = request?.status === 'declined' ? request : null;

  if (!state.canRequest) {
    // R1: no control, and the reason is stated rather than left to guesswork.
    if (!state.ineligibleReason && !declined) return null;
    return (
      <div
        className={`rounded-[12px] border border-gray-200 bg-gray-50 px-4 py-3 text-gray-600 ${
          compact ? 'text-[12px]' : 'text-[14px]'
        }`}
      >
        {declined && (
          <p className="m-0 mb-1 font-semibold text-gray-700">
            Cancellation declined{declined.decline_reason ? `: ${declined.decline_reason}` : ''}
          </p>
        )}
        {state.ineligibleReason && <p className="m-0">{state.ineligibleReason}</p>}
      </div>
    );
  }

  return (
    <>
      {declined && (
        <div
          className={`mb-2 rounded-[12px] border border-gray-200 bg-gray-50 px-4 py-3 text-gray-600 ${
            compact ? 'text-[12px]' : 'text-[14px]'
          }`}
        >
          <p className="m-0 font-semibold text-gray-700">
            Cancellation declined{declined.decline_reason ? `: ${declined.decline_reason}` : ''}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[#C7C5D4] font-bold uppercase tracking-wider text-[#464652] transition-colors hover:border-[#E53935] hover:text-[#E53935] ${
          compact ? 'px-3 py-1.5 text-[10px]' : 'px-5 py-2.5 text-[12px]'
        }`}
      >
        Request cancellation
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[480px] rounded-[24px] bg-white p-6 shadow-2xl">
            <h2
              className="m-0 mb-2 text-[#141776]"
              style={{ fontFamily: 'Poppins, sans-serif', fontSize: '22px', fontWeight: 700 }}
            >
              Request cancellation
            </h2>
            <p
              className="m-0 mb-4 text-[#464652]"
              style={{ fontFamily: 'Manrope, sans-serif', fontSize: '15px', lineHeight: '23px' }}
            >
              We will review your request and confirm by email and SMS. Your order is not cancelled
              until we do.
            </p>

            <label
              className="mb-1.5 block text-[13px] font-semibold text-[#464652]"
              htmlFor="cancel-reason"
            >
              Reason <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Ordered the wrong frame size"
              className="mb-4 w-full rounded-[12px] border border-[#C7C5D4] px-3 py-2 text-[15px] outline-none focus:border-[#2A3182]"
            />

            {error && (
              <p className="mb-3 rounded-[10px] bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError('');
                }}
                className="rounded-full border border-[#C7C5D4] px-5 py-2.5 text-[13px] font-bold text-[#464652] transition-colors hover:bg-gray-50"
              >
                Keep my order
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="rounded-full bg-[#141776] px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#2A3182] disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
