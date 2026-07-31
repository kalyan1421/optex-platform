'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@optex/db/browser';
import {
  listProductReviews,
  getRatingSummary,
  submitReview,
  updateOwnReview,
  deleteOwnReview,
  toggleHelpfulVote,
  getCustomerIdForUser,
} from '@optex/db';

/**
 * Product reviews: list, rating summary, write, edit, delete and helpful votes.
 *
 * Replaces an inline block that only listed approved reviews and allowed a
 * one-shot submit. The moderation rules are enforced in the database
 * (migrations 0006 + 0009), not here:
 *   • one review per (product, customer) — UNIQUE constraint
 *   • verified_purchase — set by trigger from real order history
 *   • editing content resets status to 'pending' — trigger
 *   • you can only touch your own row — RLS
 */

function StarDisplay({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ color: i < rating ? '#E53935' : '#d1d5db', fontSize: '1.1rem', lineHeight: 1 }}
        >
          {i < rating ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

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
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          aria-pressed={value === star}
          className="text-[1.6rem] leading-none transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182]"
          style={{ color: star <= (hovered || value) ? '#E53935' : '#d1d5db' }}
        >
          ★
        </button>
      ))}
    </span>
  );
}

function formatReviewDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const VerifiedBadge = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-700">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    Verified purchase
  </span>
);

export default function ProductReviews({ productId }) {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ count: 0, average: null });
  const [customerId, setCustomerId] = useState(null);
  const [authKnown, setAuthKnown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(
    async (custId) => {
      const db = createBrowserSupabase();
      const [rows, sum] = await Promise.all([
        listProductReviews(db, productId, custId),
        getRatingSummary(db, productId),
      ]);
      setReviews(rows);
      setSummary(sum);
    },
    [productId],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const db = createBrowserSupabase();
      try {
        const {
          data: { session },
        } = await db.auth.getSession();
        const custId = session?.user?.id
          ? await getCustomerIdForUser(db, session.user.id)
          : null;
        if (!active) return;
        setCustomerId(custId);
        setAuthKnown(true);
        await load(custId);
      } catch (err) {
        console.error('Reviews load error:', err);
        if (active) setError('We could not load reviews for this product.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [productId, load]);

  const ownReview = reviews.find((r) => r.is_own);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (body.trim().length > 0 && body.trim().length < 10) {
      setFormError('Please write at least 10 characters, or leave the comment empty.');
      return;
    }
    setSubmitting(true);
    try {
      const db = createBrowserSupabase();
      if (editingId) {
        await updateOwnReview(db, editingId, customerId, { rating, body: body.trim() || null });
      } else {
        await submitReview(db, {
          productId,
          customerId,
          rating,
          body: body.trim() || null,
        });
      }
      setEditingId(null);
      setBody('');
      setRating(5);
      await load(customerId);
    } catch (err) {
      console.error('Review submit error:', err);
      setFormError(err.message || 'We could not save your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(review) {
    setEditingId(review.id);
    setRating(review.rating);
    setBody(review.body ?? '');
    document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function handleDelete(review) {
    if (!window.confirm('Delete your review? This cannot be undone.')) return;
    try {
      const db = createBrowserSupabase();
      await deleteOwnReview(db, review.id, customerId);
      if (editingId === review.id) {
        setEditingId(null);
        setBody('');
        setRating(5);
      }
      await load(customerId);
    } catch (err) {
      console.error('Review delete error:', err);
      setError('We could not delete that review. Please try again.');
    }
  }

  async function handleHelpful(review) {
    if (!customerId) return;
    // Optimistic: the count should move on click, not after a round-trip.
    setReviews((prev) =>
      prev.map((r) =>
        r.id === review.id
          ? {
              ...r,
              viewer_found_helpful: !r.viewer_found_helpful,
              helpful_count: r.helpful_count + (r.viewer_found_helpful ? -1 : 1),
            }
          : r,
      ),
    );
    try {
      const db = createBrowserSupabase();
      await toggleHelpfulVote(db, review.id, customerId);
    } catch (err) {
      console.error('Helpful vote error:', err);
      await load(customerId); // resync with the server
    }
  }

  return (
    <section aria-labelledby="reviews-heading">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#ef4444]">
            Feedback
          </p>
          <h2 id="reviews-heading" className="text-[26px] font-black text-gray-900">
            Customer Reviews
          </h2>
        </div>
        {summary.count > 0 && (
          <div className="flex items-center gap-3">
            <StarDisplay rating={Math.round(summary.average)} />
            <span className="text-[14px] font-bold text-gray-900">
              {summary.average.toFixed(1)}
            </span>
            <span className="text-[13px] text-gray-500">
              ({summary.count} review{summary.count === 1 ? '' : 's'})
            </span>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-[14px] bg-red-50 px-5 py-4 text-[13px] font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mb-12 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-[20px] bg-gray-100" aria-hidden="true" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="mb-12 rounded-[20px] bg-[#f8f9fa] px-6 py-12 text-center">
          <p className="text-[15px] font-semibold text-gray-500">No reviews yet. Be the first!</p>
        </div>
      ) : (
        <div className="mb-12 space-y-4">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-[20px] border border-[#e5e7eb] bg-white px-6 py-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2A3182] text-[13px] font-bold text-white">
                    {(review.author_name ?? 'A').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold leading-tight text-gray-900">
                      {review.author_name ?? 'Anonymous'}
                      {review.verified_purchase && <VerifiedBadge />}
                      {review.is_own && review.status === 'pending' && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          Awaiting approval
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] font-medium text-gray-400">
                      {formatReviewDate(review.created_at)}
                      {review.updated_at && review.updated_at !== review.created_at && ' · edited'}
                    </p>
                  </div>
                </div>
                <StarDisplay rating={review.rating} />
              </div>

              {review.body && (
                <p className="text-[14px] leading-relaxed text-gray-600">{review.body}</p>
              )}

              {review.admin_reply && (
                <div className="mt-3 rounded-[14px] bg-[#f4f6ff] px-4 py-3">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#2A3182]">
                    Optex replied
                  </p>
                  <p className="text-[13px] leading-relaxed text-gray-600">{review.admin_reply}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3">
                {/* Voting on your own review is not offered. */}
                {!review.is_own && (
                  <button
                    type="button"
                    onClick={() => handleHelpful(review)}
                    disabled={!customerId}
                    aria-pressed={review.viewer_found_helpful}
                    title={customerId ? 'Mark as helpful' : 'Sign in to vote'}
                    className={`flex items-center gap-1.5 text-[12px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182] disabled:cursor-not-allowed disabled:opacity-50 ${
                      review.viewer_found_helpful ? 'text-[#2A3182]' : 'text-gray-500 hover:text-[#2A3182]'
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={review.viewer_found_helpful ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M7 11v9H4a1 1 0 01-1-1v-7a1 1 0 011-1h3zm4-8l-4 8v9h9.5a2 2 0 001.96-1.6l1.4-7A2 2 0 0017.9 9H13V5a2 2 0 00-2-2z" strokeLinejoin="round" />
                    </svg>
                    Helpful{review.helpful_count > 0 ? ` (${review.helpful_count})` : ''}
                  </button>
                )}

                {review.is_own && (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(review)}
                      className="text-[12px] font-bold text-[#2A3182] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(review)}
                      className="text-[12px] font-bold text-[#E53935] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E53935]"
                    >
                      Delete
                    </button>
                    <span className="text-[11px] text-gray-400">
                      {review.helpful_count > 0 &&
                        `${review.helpful_count} found this helpful`}
                    </span>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ── Write / edit ────────────────────────────────────────────────── */}
      <div id="review-form" className="rounded-[24px] border border-[#e5e7eb] bg-white p-6 shadow-sm sm:p-8">
        <h3 className="mb-6 text-[20px] font-black text-gray-900">
          {editingId ? 'Edit your review' : 'Write a Review'}
        </h3>

        {!authKnown ? (
          <div className="h-10 w-48 animate-pulse rounded-[10px] bg-gray-100" aria-hidden="true" />
        ) : !customerId ? (
          <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-[#f8f9fa] px-5 py-4">
            <p className="text-[14px] text-gray-600">Sign in to write a review for this product.</p>
            <Link
              href="/login?next=%2Fproduct"
              className="rounded-full bg-[#2A3182] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#1f2666]"
            >
              Sign in
            </Link>
          </div>
        ) : ownReview && !editingId ? (
          <div className="rounded-[14px] bg-[#f8f9fa] px-5 py-4">
            <p className="text-[14px] text-gray-600">
              You have already reviewed this product. Use <strong>Edit</strong> above to change it.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <span className="mb-2 block text-[13px] font-bold text-gray-900">Your rating</span>
              <StarSelector value={rating} onChange={setRating} />
            </div>

            <div>
              <label htmlFor="review-body" className="mb-2 block text-[13px] font-bold text-gray-900">
                Your review <span className="font-medium text-gray-400">(optional)</span>
              </label>
              <textarea
                id="review-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Share your thoughts about this product (min. 10 characters)…"
                className="w-full rounded-[14px] border border-gray-200 px-4 py-3 text-[14px] outline-none focus:border-[#2A3182] focus:ring-1 focus:ring-[#2A3182]"
              />
              <p className="mt-1 text-right text-[11px] text-gray-400">{body.length}/2000</p>
            </div>

            {formError && (
              <p role="alert" className="text-[13px] font-medium text-red-600">
                {formError}
              </p>
            )}

            <p className="text-[12px] text-gray-400">
              Reviews are published after moderation. Editing a published review sends it back for
              review.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-[#2A3182] px-7 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#1f2666] disabled:opacity-60"
              >
                {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Submit review'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setBody('');
                    setRating(5);
                    setFormError('');
                  }}
                  className="rounded-full border border-gray-200 px-7 py-2.5 text-[13px] font-bold text-gray-600 hover:border-gray-400"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
