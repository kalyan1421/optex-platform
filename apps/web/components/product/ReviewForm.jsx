'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

function StarSelector({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="text-[1.6rem] leading-none transition-transform hover:scale-110 focus:outline-none"
          style={{ color: star <= (hovered || value) ? '#E53935' : '#d1d5db' }}
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

/**
 * The write half of Customer Reviews (SPEC-03 R2's "review form" client
 * island). The read half — the approved-reviews list and its aggregate —
 * renders server-side in `page.jsx`, since it needs no browser.
 *
 * There's no "has this customer already reviewed this product" endpoint, so
 * — unlike the pre-SSR version, which pre-fetched that via a direct Supabase
 * read — this relies on the 409 the API already returns from
 * `POST /products/:id/reviews` for a duplicate. A returning reviewer
 * discovers this on submit rather than before typing; the API's guarantee
 * (one review per customer per product) is unchanged, only when the message
 * appears.
 */
export default function ReviewForm({ productId }) {
  const { user, loading: authLoading } = useAuth();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (body.trim().length < 10) {
      setFormError('Review must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await api.reviews.create(productId, { rating, body: body.trim() });
      setSubmitted(true);
    } catch (err) {
      console.error('review submit failed:', err);
      if (err?.status === 409) {
        setAlreadyReviewed(true);
      } else {
        setFormError(err?.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-[#e5e7eb] bg-white p-6 shadow-sm sm:p-8">
      <h3 className="mb-6 text-[20px] font-black text-gray-900">Write a Review</h3>

      {authLoading ? (
        <div className="h-10 w-48 animate-pulse rounded-[10px] bg-gray-100" />
      ) : !user ? (
        <div className="flex items-center gap-3 rounded-[14px] bg-[#f8f9fa] px-5 py-4">
          <svg
            className="h-5 w-5 flex-shrink-0 text-[#2A3182]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <p className="text-[14px] font-medium text-gray-600">
            <Link href="/login" className="font-bold text-[#2A3182] hover:underline">
              Login
            </Link>{' '}
            to write a review for this product.
          </p>
        </div>
      ) : alreadyReviewed ? (
        <div className="flex items-center gap-3 rounded-[14px] border border-blue-100 bg-blue-50 px-5 py-4">
          <svg
            className="h-5 w-5 flex-shrink-0 text-[#2A3182]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-[14px] font-semibold text-[#2A3182]">
            You've already reviewed this product.
          </p>
        </div>
      ) : submitted ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-7 w-7 text-green-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[17px] font-bold text-gray-900">Thank you for your review!</p>
            <p className="mt-1 text-[13px] text-gray-500">
              Review submitted! It will appear after moderation.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* F-16: role="alert" so a screen reader announces the failure. The
              message used to render silently — a blind reviewer pressed submit,
              nothing was spoken, and the form appeared to do nothing at all. */}
          {formError && (
            <div
              role="alert"
              className="rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600"
            >
              {formError}
            </div>
          )}
          <div>
            {/* The star selector is a group of buttons, not a single control, so
                this is a group label rather than a `for=` label. */}
            <span
              id="review-rating-label"
              className="mb-2 block text-[12px] font-bold text-gray-900"
            >
              Your Rating *
            </span>
            <div role="group" aria-labelledby="review-rating-label">
              <StarSelector value={rating} onChange={setRating} />
            </div>
          </div>
          <div>
            <label htmlFor="review-body" className="mb-2 block text-[12px] font-bold text-gray-900">
              Your Review *
            </label>
            <textarea
              id="review-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              minLength={10}
              // Points at the character counter, so the length requirement is
              // read out with the field instead of being visual-only.
              aria-describedby="review-body-count"
              placeholder="Share your thoughts about this product (min. 10 characters)…"
              disabled={submitting}
              className="w-full resize-none rounded-[14px] border border-gray-200 bg-[#fdfdfd] px-4 py-3 text-[14px] text-gray-900 outline-none transition-all duration-300 placeholder:text-gray-400 hover:border-gray-300 focus:border-[#2A3182] focus:shadow-sm disabled:opacity-60"
            />
            <p id="review-body-count" className="mt-1 text-right text-[11px] text-gray-400">
              {body.length} chars — 10 minimum
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-full bg-[#2A3182] px-7 py-3 text-[14px] font-bold text-white shadow-lg transition-all hover:bg-[#1e2361] hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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
                Submitting…
              </>
            ) : (
              'Submit Review'
            )}
          </button>
        </form>
      )}
    </div>
  );
}
