'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { createBrowserSupabase } from '@optex/db/browser';
import { getProductBySlug, listProducts } from '@optex/db';
import { formatKes, formatKesNumber } from '@optex/ui';
import { api } from '@/lib/api';
import { getProductImageUrl } from '@/lib/product-image';
import WishlistToggle from '@/components/wishlist/WishlistToggle';

// ── Reviews helpers ─────────────────────────────────────────────────────────

function StarDisplay({ rating, max = 5 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[...Array(max)].map((_, i) => (
        <span
          key={i}
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

function formatReviewDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// ── ReviewsSection ────────────────────────────────────────────────────────────

function ReviewsSection({ productId }) {
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  // Auth / customer state
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = logged out
  const [customerId, setCustomerId] = useState(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  // Form state
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!productId) return;
    const db = createBrowserSupabase();

    // Fetch approved reviews
    db.from('product_reviews')
      .select('id, rating, body, created_at, customer:customers(full_name)')
      .eq('product_id', productId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setReviews(data ?? []);
        setReviewsLoading(false);
      })
      .catch(() => setReviewsLoading(false));

    // Check auth
    db.auth.getUser().then(async ({ data: { user } }) => {
      setAuthUser(user ?? null);
      if (!user) return;

      // Resolve customers.id from auth_user_id
      const { data: customer } = await db
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      const cid = customer?.id ?? null;
      setCustomerId(cid);

      // Check if customer already reviewed this product
      if (cid) {
        const { data: existing } = await db
          .from('product_reviews')
          .select('id')
          .eq('product_id', productId)
          .eq('customer_id', cid)
          .maybeSingle();
        if (existing) setAlreadyReviewed(true);
      }
    });
  }, [productId]);

  async function handleSubmitReview(e) {
    e.preventDefault();
    setFormError('');
    if (body.trim().length < 10) {
      setFormError('Review must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      // The API resolves the customer from the JWT and applies the moderation
      // status and the one-review-per-product guard. The previous direct insert
      // set `status: 'pending'` itself and skipped both — and migration 0009
      // now blocks that path at the RLS layer anyway.
      await api.reviews.create(productId, { rating, body: body.trim() });
      setSubmitted(true);
    } catch (err) {
      console.error('review submit failed:', err);
      // A duplicate review is an expected outcome with a specific message, not
      // a generic failure.
      setFormError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto mt-[12px] w-full max-w-[1240px] border-t-[0.8px] border-[#D4D4D4] pt-[40px]">
      <div className="mb-10">
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.2em] text-[#E53935]">
          FEEDBACK
        </p>
        <h2 className="text-[32px] font-black text-gray-900">Customer Reviews</h2>
      </div>

      {/* ── Reviews list ────────────────────────────── */}
      {reviewsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-[16px] bg-gray-100" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="mb-10 rounded-[20px] bg-[#f8f9fa] px-8 py-12 text-center">
          <p className="text-[15px] font-semibold text-gray-400">No reviews yet. Be the first!</p>
        </div>
      ) : (
        <div className="mb-12 space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-[20px] border border-[#e5e7eb] bg-white px-6 py-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2A3182] text-[13px] font-bold text-white">
                    {(review.customer?.full_name ?? 'A').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold leading-tight text-gray-900">
                      {review.customer?.full_name ?? 'Anonymous'}
                    </p>
                    <p className="text-[11px] font-medium text-gray-400">
                      {formatReviewDate(review.created_at)}
                    </p>
                  </div>
                </div>
                <StarDisplay rating={review.rating} />
              </div>
              <p className="text-[14px] leading-relaxed text-gray-600">{review.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Write a review ──────────────────────────── */}
      <div className="rounded-[24px] border border-[#e5e7eb] bg-white p-6 shadow-sm sm:p-8">
        <h3 className="mb-6 text-[20px] font-black text-gray-900">Write a Review</h3>

        {authUser === undefined ? (
          <div className="h-10 w-48 animate-pulse rounded-[10px] bg-gray-100" />
        ) : authUser === null ? (
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
          <form onSubmit={handleSubmitReview} className="space-y-5">
            {formError && (
              <div className="rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                {formError}
              </div>
            )}
            <div>
              <label className="mb-2 block text-[12px] font-bold text-gray-900">
                Your Rating *
              </label>
              <StarSelector value={rating} onChange={setRating} />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-bold text-gray-900">
                Your Review *
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                minLength={10}
                placeholder="Share your thoughts about this product (min. 10 characters)…"
                disabled={submitting}
                className="w-full resize-none rounded-[14px] border border-gray-200 bg-[#fdfdfd] px-4 py-3 text-[14px] text-gray-900 outline-none transition-all duration-300 placeholder:text-gray-400 hover:border-gray-300 focus:border-[#2A3182] focus:shadow-sm disabled:opacity-60"
              />
              <p className="mt-1 text-right text-[11px] text-gray-400">{body.length} chars</p>
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
    </section>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

const ProductDetails = ({ params }) => {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('Features');
  const [selectedColor, setSelectedColor] = useState('black');
  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [reviewStats, setReviewStats] = useState({ count: 0, average: 0 });
  const { addToCart } = useCart();

  useEffect(() => {
    const db = createBrowserSupabase();
    const slug = params?.slug ?? 'executive-pro';
    Promise.all([getProductBySlug(db, slug), listProducts(db, { limit: 3 })])
      .then(async ([prod, prods]) => {
        setProduct(prod);
        setSimilar(prods.filter((p) => p.slug !== slug).slice(0, 3));
        if (prod) {
          const { data: reviews } = await db
            .from('product_reviews')
            .select('rating')
            .eq('product_id', prod.id)
            .eq('status', 'approved');
          if (reviews && reviews.length > 0) {
            const avg = reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length;
            setReviewStats({ count: reviews.length, average: Math.round(avg * 10) / 10 });
          }
        }
      })
      .catch(console.error);
  }, [params?.slug]);

  const mainImage = product ? getProductImageUrl(product) : '/images/executive_pro.png';

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-[100px] pt-[38px]">
      {product && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: product.name,
              description: product.description || product.name,
              brand: { '@type': 'Brand', name: product.brand || 'Optex' },
              sku: product.sku,
              image: product.images?.[0] || '',
              offers: {
                '@type': 'Offer',
                price: product.price_kes,
                priceCurrency: 'KES',
                availability: product.is_active
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
                seller: { '@type': 'Organization', name: 'Optex Opticians' },
              },
            }),
          }}
        />
      )}
      <div className="mx-auto flex w-full max-w-[1440px] flex-col px-6 lg:px-[100px]">
        {/* Breadcrumb */}
        <div className="mx-auto mb-[38px] flex w-full max-w-[1240px] items-center gap-[8px]">
          <Link
            href="/"
            className="text-[#717182] hover:text-[#2A3182]"
            style={{
              fontFamily: 'Arimo, sans-serif',
              fontSize: '14px',
              lineHeight: '21px',
              fontWeight: 400,
            }}
          >
            Home
          </Link>
          <span
            className="text-[#717182]"
            style={{
              fontFamily: 'Arimo, sans-serif',
              fontSize: '14px',
              lineHeight: '21px',
              fontWeight: 400,
            }}
          >
            /
          </span>
          <Link
            href="/shop"
            className="text-[#717182] hover:text-[#2A3182]"
            style={{
              fontFamily: 'Arimo, sans-serif',
              fontSize: '14px',
              lineHeight: '21px',
              fontWeight: 400,
            }}
          >
            Shop
          </Link>
          <span
            className="text-[#717182]"
            style={{
              fontFamily: 'Arimo, sans-serif',
              fontSize: '14px',
              lineHeight: '21px',
              fontWeight: 400,
            }}
          >
            /
          </span>
          <span
            className="text-[#000000]"
            style={{
              fontFamily: 'Arimo, sans-serif',
              fontSize: '14px',
              lineHeight: '21px',
              fontWeight: 400,
            }}
          >
            {product?.name ?? '…'}
          </span>
        </div>

        {/* Product Section */}
        <div className="mx-auto mb-[60px] flex w-full max-w-[1240px] flex-col gap-[60px] lg:flex-row">
          {/* Image Gallery */}
          <div className="flex flex-col gap-[16px] lg:w-[590px]">
            <div className="flex w-full items-center justify-center overflow-hidden rounded-[40px] border-[0.8px] border-[#D4D4D4] bg-[#F5F5F5] p-[0.8px] lg:h-[459.6px]">
              <img
                src={mainImage}
                alt={product?.name ?? 'Product'}
                className="h-full w-full rounded-[40px] object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
            <div className="flex w-full snap-x snap-mandatory gap-[16px] overflow-x-auto">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`h-[102.9px] w-[102.9px] flex-shrink-0 cursor-pointer snap-center rounded-[16px] border-[0.8px] bg-[#F5F5F5] p-[0.8px] transition-opacity ${idx === 0 ? 'border-[#D4D4D4] opacity-100' : 'border-[#D4D4D4] opacity-60 hover:opacity-100'}`}
                >
                  <img
                    src={mainImage}
                    alt={`Thumbnail ${idx + 1}`}
                    className="h-full w-full rounded-[16px] object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex flex-col lg:w-[590px]">
            <p
              className="mb-[29px] uppercase text-[#E53935]"
              style={{
                fontFamily: 'Arimo, sans-serif',
                fontSize: '14px',
                lineHeight: '21px',
                fontWeight: 400,
                letterSpacing: '2px',
              }}
            >
              {product?.brand || '—'}
            </p>
            <h1
              className="-mt-[29px] mb-[16px] pt-[29px] text-[#000000]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '48px',
                lineHeight: '60px',
                fontWeight: 700,
              }}
            >
              {product?.name ?? '…'}
            </h1>

            <div className="mb-[29px] flex items-center gap-[16px]">
              {reviewStats.count > 0 ? (
                <>
                  <div className="flex items-center text-[#FFC107]">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className="h-[18px] w-[18px]"
                        fill={i < Math.round(reviewStats.average) ? 'currentColor' : '#d1d5db'}
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span
                    className="text-[#717182]"
                    style={{
                      fontFamily: 'Arimo, sans-serif',
                      fontSize: '14px',
                      lineHeight: '21px',
                      fontWeight: 400,
                    }}
                  >
                    ({reviewStats.count} Customer {reviewStats.count === 1 ? 'Review' : 'Reviews'})
                  </span>
                </>
              ) : (
                <span
                  className="text-[#717182]"
                  style={{
                    fontFamily: 'Arimo, sans-serif',
                    fontSize: '14px',
                    lineHeight: '21px',
                    fontWeight: 400,
                  }}
                >
                  No reviews yet
                </span>
              )}
            </div>

            <div className="mb-[32px]">
              <span
                className="text-[#2E3192]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '32px',
                  lineHeight: '48px',
                  fontWeight: 700,
                }}
              >
                {product ? `KSH. ${formatKesNumber(product.price_kes)}` : '…'}
              </span>
            </div>

            <p
              className="mb-[32px] text-[#4A4A4A]"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                lineHeight: '26px',
                fontWeight: 400,
              }}
            >
              {product?.description ??
                'The Executive Pro combines professional aesthetics with high-performance materials. Engineered for all-day comfort, these frames feature a lightweight titanium build and adjustable nose pads for a custom fit.'}
            </p>

            <div className="mb-[32px]">
              <p
                className="mb-[16px] text-[#000000]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '16px',
                  lineHeight: '24px',
                  fontWeight: 600,
                }}
              >
                Select Color
              </p>
              <div className="flex items-center gap-[16px]">
                <button
                  onClick={() => setSelectedColor('black')}
                  className={`flex items-center justify-center rounded-full transition-all ${selectedColor === 'black' ? 'h-[44px] w-[44px] border-[1.76px] border-[#2E3192] bg-[#1A1A1A]' : 'h-[40px] w-[40px] border-[1.6px] border-[#000000] bg-[#1A1A1A]'}`}
                ></button>
                <button
                  onClick={() => setSelectedColor('blue')}
                  className={`flex items-center justify-center rounded-full transition-all ${selectedColor === 'blue' ? 'h-[44px] w-[44px] border-[1.76px] border-[#2E3192] bg-[#2E3192]' : 'h-[40px] w-[40px] border-[1.6px] border-[#000000] bg-[#2E3192]'}`}
                ></button>
                <button
                  onClick={() => setSelectedColor('grey')}
                  className={`flex items-center justify-center rounded-full transition-all ${selectedColor === 'grey' ? 'h-[44px] w-[44px] border-[1.76px] border-[#2E3192] bg-[#717182]' : 'h-[40px] w-[40px] border-[1.6px] border-[#000000] bg-[#717182]'}`}
                ></button>
              </div>
            </div>

            <div className="mb-[56.8px] flex h-[63px] w-[459.6px] items-center gap-[24px]">
              <div className="flex h-[49.2px] w-[135.2px] items-center justify-between rounded-[26843500px] border-[1.6px] border-[#D4D4D4] bg-white px-[16px] py-[8px]">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex w-[24px] items-center justify-center bg-white/0 text-[#0A0A0A] transition-colors hover:bg-[#141776]/10"
                  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '20px' }}
                >
                  -
                </button>
                <span
                  className="flex w-[24px] justify-center text-[#0A0A0A]"
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 700,
                    fontSize: '18px',
                    lineHeight: '27px',
                  }}
                >
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="flex w-[24px] items-center justify-center bg-white/0 text-[#0A0A0A] transition-colors hover:bg-[#141776]/10"
                  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '20px' }}
                >
                  +
                </button>
              </div>
              <button
                onClick={() => {
                  if (product) {
                    addToCart({
                      id: product.id,
                      title: product.name,
                      price: String(product.price_kes),
                      image: mainImage,
                      quantity,
                      variant: `Frame: ${selectedColor.charAt(0).toUpperCase() + selectedColor.slice(1)} | Lens: Standard`,
                      brand: product.brand,
                    });
                    router.push('/cart');
                  }
                }}
                disabled={!product}
                className="flex h-[63px] w-[300.4px] items-center justify-center gap-[10px] rounded-[26843500px] bg-[#2E3192] text-[#FFFFFF] transition-all hover:bg-[#1e2361] disabled:opacity-50"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 700,
                  fontSize: '18px',
                  lineHeight: '27px',
                }}
              >
                <svg
                  className="h-[20px] w-[20px]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="1.67"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z"
                  />
                </svg>
                Add to Cart
              </button>
            </div>

            {product && (
              <div className="mb-[32px]">
                <WishlistToggle productId={product.id} variant="inline" />
              </div>
            )}

            {/* Info Badges */}
            <div className="flex h-[56.8px] flex-wrap items-center gap-[24px] border-t-[0.8px] border-[#D4D4D4] pt-[20px]">
              <div className="flex items-center gap-[12px]">
                <div className="relative flex h-[24px] w-[24px] items-center justify-center">
                  <svg
                    width="18"
                    height="22"
                    viewBox="0 0 18 22"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute left-[3px] top-[1px]"
                  >
                    <path
                      d="M17 12.0004C17 17.0004 13.5 19.5005 9.34 20.9505C9.12216 21.0243 8.88554 21.0207 8.67 20.9405C4.5 19.5005 1 17.0004 1 12.0004V5.00045C1 4.73523 1.10536 4.48088 1.29289 4.29334C1.48043 4.10581 1.73478 4.00045 2 4.00045C4 4.00045 6.5 2.80045 8.24 1.28045C8.45185 1.09945 8.72135 1 9 1C9.27865 1 9.54815 1.09945 9.76 1.28045C11.51 2.81045 14 4.00045 16 4.00045C16.2652 4.00045 16.5196 4.10581 16.7071 4.29334C16.8946 4.48088 17 4.73523 17 5.00045V12.0004Z"
                      stroke="#2E3192"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <svg
                    width="8"
                    height="6"
                    viewBox="0 0 8 6"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute left-[8px] top-[9px]"
                  >
                    <path
                      d="M1 3L3 5L7 1"
                      stroke="#2E3192"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span
                  className="text-[#4A4A4A]"
                  style={{
                    fontFamily: 'Arimo, sans-serif',
                    fontSize: '14px',
                    lineHeight: '21px',
                    fontWeight: 400,
                  }}
                >
                  2 Year Warranty
                </span>
              </div>
              <div className="flex items-center gap-[12px]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="flex-shrink-0"
                >
                  <path
                    d="M14 18V6C14 5.46957 13.7893 4.96086 13.4142 4.58579C13.0391 4.21071 12.5304 4 12 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V17C2 17.2652 2.10536 17.5196 2.29289 17.7071C2.48043 17.8946 2.73478 18 3 18H5"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M15 18H9"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 18H21C21.2652 18 21.5196 17.8946 21.7071 17.7071C21.8946 17.5196 22 17.2652 22 17V13.35C21.9996 13.1231 21.922 12.903 21.78 12.726L18.3 8.376C18.2065 8.25888 18.0878 8.16428 17.9528 8.0992C17.8178 8.03412 17.6699 8.00021 17.52 8H14"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17 20C18.1046 20 19 19.1046 19 18C19 16.8954 18.1046 16 17 16C15.8954 16 15 16.8954 15 18C15 19.1046 15.8954 20 17 20Z"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 20C8.10457 20 9 19.1046 9 18C9 16.8954 8.10457 16 7 16C5.89543 16 5 16.8954 5 18C5 19.1046 5.89543 20 7 20Z"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className="text-[#4A4A4A]"
                  style={{
                    fontFamily: 'Arimo, sans-serif',
                    fontSize: '14px',
                    lineHeight: '21px',
                    fontWeight: 400,
                  }}
                >
                  Free Shipping
                </span>
              </div>
              <div className="flex items-center gap-[12px]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="flex-shrink-0"
                >
                  <path
                    d="M3 12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3C14.516 3.00947 16.931 3.99122 18.74 5.74L21 8"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 3V8H16"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 12C21 14.3869 20.0518 16.6761 18.364 18.364C16.6761 20.0518 14.3869 21 12 21C9.48395 20.9905 7.06897 20.0088 5.26 18.26L3 16"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 16H3V21"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className="text-[#4A4A4A]"
                  style={{
                    fontFamily: 'Arimo, sans-serif',
                    fontSize: '14px',
                    lineHeight: '21px',
                    fontWeight: 400,
                  }}
                >
                  30-Day Returns
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mx-auto mb-[60px] w-full max-w-[1240px]">
          <div className="mb-[32px] flex h-[50.8px] gap-[40px] border-b-[0.8px] border-[#D4D4D4]">
            {['Features', 'Specifications', 'Shipping'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex h-[50px] items-center justify-center pb-[4px] transition-all ${activeTab === tab ? 'border-b-[4px] border-[#2E3192] text-[#2E3192]' : 'text-[#717182] hover:text-black'}`}
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '20px',
                  lineHeight: '30px',
                  fontWeight: 700,
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'Features' && (
            <div className="flex min-h-[185px] flex-col gap-[16px] md:flex-row">
              <div className="flex flex-col gap-[16px] py-[8px] md:w-[469.6px]">
                <ul className="flex flex-col gap-[16px]">
                  {[
                    product?.frame_material && `${product.frame_material} construction`,
                    product?.frame_shape && `${product.frame_shape} frame shape`,
                    'Anti-reflective coating',
                    'Lightweight design',
                  ]
                    .filter(Boolean)
                    .map((feat, i) => (
                      <li key={i} className="flex items-center">
                        <span className="mr-[12px] h-[8px] w-[8px] flex-shrink-0 rounded-[26843500px] bg-[#E53935]"></span>
                        <span
                          className="text-[#4A4A4A]"
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '16px',
                            lineHeight: '24px',
                            fontWeight: 400,
                          }}
                        >
                          {feat}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
              <div className="ml-[40px] md:w-[469.6px]">
                <div className="flex h-full w-full flex-col gap-[16px] rounded-[32px] bg-[#F9F9F9] p-[32px]">
                  <h4
                    className="text-[#0A0A0A]"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: '18px',
                      lineHeight: '27px',
                      fontWeight: 700,
                    }}
                  >
                    Premium Packaging Included
                  </h4>
                  <p
                    className="text-[#717182]"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '16px',
                      lineHeight: '26px',
                      fontWeight: 400,
                    }}
                  >
                    Every pair of glasses comes with our signature hard case, a microfiber cleaning
                    cloth, and a certificate of authenticity.
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'Specifications' && (
            <div
              className="text-[#4A4A4A]"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 400,
              }}
            >
              {product && (
                <dl className="grid max-w-md grid-cols-2 gap-4">
                  {[
                    ['SKU', product.sku],
                    ['Brand', product.brand],
                    ['Material', product.frame_material],
                    ['Shape', product.frame_shape],
                    ['Gender', product.gender],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <React.Fragment key={k}>
                        <dt className="font-bold text-gray-900">{k}</dt>
                        <dd className="capitalize">{v}</dd>
                      </React.Fragment>
                    ))}
                </dl>
              )}
            </div>
          )}
          {activeTab === 'Shipping' && (
            <div
              className="text-[#4A4A4A]"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 400,
              }}
            >
              <p>
                Delivery within Nairobi: 1-2 business days. Other counties: 3-5 business days. Free
                shipping on orders above KES 10,000.
              </p>
            </div>
          )}
        </div>

        {/* Customer Reviews */}
        {product && <ReviewsSection productId={product.id} />}

        {/* Similar Products */}
        <div className="mx-auto mt-[60px] w-full max-w-[1240px]">
          <div className="mb-[24px] flex h-[89px] w-full items-end justify-between">
            <div className="flex w-[339.56px] flex-col gap-[8px]">
              <p
                className="uppercase text-[#E53935]"
                style={{
                  fontFamily: 'Arimo, sans-serif',
                  fontSize: '14px',
                  lineHeight: '21px',
                  fontWeight: 400,
                  letterSpacing: '2px',
                }}
              >
                RECOMMENDATION
              </p>
              <h2
                className="h-[60px] text-[#000000]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '40px',
                  lineHeight: '60px',
                  fontWeight: 700,
                }}
              >
                Similar Products
              </h2>
            </div>
            <Link
              href="/shop"
              className="mb-[12px] flex items-center gap-[7px] text-[#2E3192]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 600,
              }}
            >
              View All
              <svg
                className="h-[11.67px] w-[11.67px]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="1.67"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="hide-scrollbar flex w-full snap-x snap-mandatory gap-[26.6px] overflow-x-auto pb-[20px]">
            {similar.map((p) => (
              <div
                key={p.id}
                className="relative h-[480px] w-[290px] flex-shrink-0 snap-start rounded-[32px] border-[0.8px] border-[#D4D4D4] bg-white"
              >
                <Link href={`/product/${p.slug}`}>
                  <div className="relative mx-[0.8px] mt-[0.8px] h-[288.4px] w-[288.4px] overflow-hidden rounded-t-[32px] bg-[#F5F5F5]">
                    <img
                      src={getProductImageUrl(p)}
                      alt={p.name}
                      className="h-full w-full object-cover mix-blend-multiply"
                    />
                    <div className="absolute right-[16px] top-[16px] flex h-[26px] items-center justify-center rounded-[26843500px] bg-[#FFFFFFE5] px-[12px]">
                      <span
                        className="capitalize text-[#2E3192]"
                        style={{
                          fontFamily: 'Arimo, sans-serif',
                          fontSize: '12px',
                          lineHeight: '18px',
                          fontWeight: 400,
                        }}
                      >
                        {p.frame_shape || 'Eyewear'}
                      </span>
                    </div>
                  </div>
                </Link>
                <div className="mt-[24.8px] px-[24.8px]">
                  <div className="mb-[8px] flex h-[27px] items-center justify-between">
                    <Link href={`/product/${p.slug}`}>
                      <h3
                        className="max-w-[135px] truncate text-[#000000]"
                        style={{
                          fontFamily: 'Poppins, sans-serif',
                          fontSize: '18px',
                          lineHeight: '27px',
                          fontWeight: 600,
                          letterSpacing: '-0.2px',
                        }}
                      >
                        {p.name}
                      </h3>
                    </Link>
                    <span
                      className="uppercase text-[#2E3192]"
                      style={{
                        fontFamily: 'Arimo, sans-serif',
                        fontSize: '14px',
                        lineHeight: '21px',
                        fontWeight: 400,
                      }}
                    >
                      {p.brand}
                    </span>
                  </div>
                  <p
                    className="line-clamp-2 h-[42px] text-[#717182]"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      lineHeight: '21px',
                      fontWeight: 400,
                    }}
                  >
                    {p.description ||
                      `Premium quality ${p.frame_shape?.toLowerCase() || 'eyewear'} designed for maximum comfort and style.`}
                  </p>
                  <div className="mt-[24px] flex h-[41px] items-center justify-between">
                    <p className="flex items-baseline gap-[4px] text-[#2E3192]">
                      <span
                        style={{
                          fontFamily: 'Poppins, sans-serif',
                          fontSize: '12px',
                          lineHeight: '33px',
                          fontWeight: 700,
                        }}
                      >
                        KSH.
                      </span>
                      <span
                        style={{
                          fontFamily: 'Poppins, sans-serif',
                          fontSize: '22px',
                          lineHeight: '33px',
                          fontWeight: 700,
                        }}
                      >
                        {formatKesNumber(p.price_kes)}
                      </span>
                    </p>
                    <button
                      onClick={() =>
                        addToCart({
                          id: p.id,
                          title: p.name,
                          price: String(p.price_kes),
                          image: getProductImageUrl(p),
                          quantity: 1,
                          brand: p.brand,
                        })
                      }
                      className="flex h-[41px] w-[121.375px] items-center justify-center rounded-[24px] bg-[#E53935] text-white transition-colors hover:bg-red-700"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: '14px',
                        lineHeight: '21px',
                        fontWeight: 600,
                      }}
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Page({ params }) {
  return <ProductDetails params={params} />;
}
