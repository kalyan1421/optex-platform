'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { createBrowserSupabase } from '@optex/db/browser';
import { getProductBySlug, listProducts } from '@optex/db';
import { formatKes } from '@optex/ui';
import { api } from '@/lib/api';
import { getProductImageUrl } from '@/lib/product-image';

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
      // status, the one-review-per-product guard and the verified-purchase
      // check. The previous direct insert set `status: 'pending'` itself and
      // skipped every one of those rules.
      await api.reviews.create(productId, { rating, body: body.trim() });
      setSubmitted(true);
    } catch (err) {
      console.error('review submit failed:', err);
      // Duplicate reviews and unverified purchases are expected outcomes with
      // specific messages, not generic failures.
      setFormError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-20 border-t border-[#e5e7eb] pt-16">
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
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('Features');
  const [selectedColor, setSelectedColor] = useState('black');
  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const { addToCart } = useCart();

  useEffect(() => {
    const db = createBrowserSupabase();
    const slug = params?.slug ?? 'executive-pro';
    Promise.all([getProductBySlug(db, slug), listProducts(db, { limit: 3 })])
      .then(([prod, prods]) => {
        setProduct(prod);
        setSimilar(prods.filter((p) => p.slug !== slug).slice(0, 3));
      })
      .catch(console.error);
  }, [params?.slug]);

  const mainImage = product ? getProductImageUrl(product) : '/images/executive_pro.png';

  return (
    <div className="min-h-screen bg-white pb-20 pt-[18px]">
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
      <div className="page-container">
        {/* Breadcrumb */}
        <div className="mb-8 flex items-center text-[13px]">
          <Link href="/" className="text-gray-500 hover:text-[#2A3182]">
            Home
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <Link href="/shop" className="text-gray-500 hover:text-[#2A3182]">
            Shop
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <span className="font-bold text-gray-900">{product?.name ?? '…'}</span>
        </div>

        {/* Product Section */}
        <div className="mb-16 flex flex-col gap-10 lg:flex-row lg:gap-12">
          {/* Image Gallery */}
          <div className="lg:w-1/2">
            <div className="mb-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[24px] bg-[#f8f9fa] p-5 sm:rounded-[30px] sm:p-8">
              <img
                src={mainImage}
                alt={product?.name ?? 'Product'}
                className="h-full w-full object-contain transition-transform duration-500 hover:scale-105"
              />
            </div>
            <div className="grid grid-cols-4 gap-3 sm:gap-4">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`aspect-square cursor-pointer rounded-[15px] border-2 bg-[#f8f9fa] p-2 transition-all ${idx === 0 ? 'border-[#ddd]' : 'border-transparent hover:border-[#ddd]'}`}
                >
                  <img
                    src={mainImage}
                    alt={`Thumbnail ${idx + 1}`}
                    className="h-full w-full rounded-[10px] object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex flex-col justify-center lg:w-1/2">
            <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.2em] text-[#ef4444]">
              {product?.brand ?? ''}
            </p>
            <h1 className="mb-3 text-[34px] font-black leading-tight text-gray-900 sm:text-[42px]">
              {product?.name ?? '…'}
            </h1>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex text-[#FBBF24]">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-[13px] font-medium text-gray-500">(324 Customer Reviews)</span>
            </div>

            <div className="mb-6">
              <span className="text-[32px] font-black text-[#2A3182]">
                {product ? formatKes(Number(product.price_kes)) : '…'}
              </span>
            </div>

            <p className="mb-8 text-[15px] leading-relaxed text-gray-600">
              {product?.description ?? ''}
            </p>

            <div className="mb-8">
              <p className="mb-3 text-[14px] font-bold text-gray-900">Select Color</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedColor('black')}
                  className={`h-8 w-8 rounded-full bg-[#1a1a1a] ${selectedColor === 'black' ? 'ring-2 ring-black ring-offset-2' : ''}`}
                ></button>
                <button
                  onClick={() => setSelectedColor('blue')}
                  className={`h-8 w-8 rounded-full bg-[#2A3182] ${selectedColor === 'blue' ? 'ring-2 ring-[#2A3182] ring-offset-2' : ''}`}
                ></button>
                <button
                  onClick={() => setSelectedColor('grey')}
                  className={`h-8 w-8 rounded-full bg-gray-500 ${selectedColor === 'grey' ? 'ring-2 ring-gray-500 ring-offset-2' : ''}`}
                ></button>
              </div>
            </div>

            <div className="mb-10 flex flex-col gap-4 sm:flex-row">
              <div className="flex w-full items-center justify-between rounded-full border border-[#ddd] px-5 py-3 sm:w-32">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="text-lg font-bold text-gray-500 hover:text-black"
                >
                  -
                </button>
                <span className="font-bold text-gray-900">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="text-lg font-bold text-gray-500 hover:text-black"
                >
                  +
                </button>
              </div>
              <button
                onClick={() =>
                  product &&
                  addToCart({
                    id: product.id,
                    title: product.name,
                    price: String(product.price_kes),
                    image: mainImage,
                    quantity,
                  })
                }
                disabled={!product}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#2A3182] py-3 font-bold text-white shadow-lg transition-all hover:bg-[#1e2361] hover:shadow-xl disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z"
                  />
                </svg>
                Add to Cart
              </button>
            </div>

            {/* Info Badges */}
            <div className="flex flex-wrap gap-8 border-t border-[#ddd] py-6">
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-[#2A3182]"
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
                <span className="text-[13px] font-medium text-gray-600">2 Year Warranty</span>
              </div>
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-[#2A3182]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                  />
                </svg>
                <span className="text-[13px] font-medium text-gray-600">Free Shipping</span>
              </div>
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-[#2A3182]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8m0 0V3m0 5h5"
                  />
                </svg>
                <span className="text-[13px] font-medium text-gray-600">30 Day Returns</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mb-20">
          <div className="mb-8 flex flex-wrap gap-6 border-b border-[#ddd]">
            {['Features', 'Specifications', 'Shipping'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative pb-4 text-[15px] font-bold transition-all ${activeTab === tab ? 'text-[#2A3182]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-[-1px] left-0 h-[2px] w-full bg-[#2A3182]"></div>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'Features' && (
            <div className="flex flex-col gap-10 md:flex-row md:gap-12">
              <div className="pt-2 md:w-1/2">
                <ul className="space-y-4">
                  {[
                    product?.frame_material && `${product.frame_material} construction`,
                    product?.frame_shape && `${product.frame_shape} frame shape`,
                    'Anti-reflective coating',
                    'Lightweight design',
                  ]
                    .filter(Boolean)
                    .map((feat, i) => (
                      <li
                        key={i}
                        className="flex items-center text-[15px] font-medium text-gray-600"
                      >
                        <span className="mr-4 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#ef4444]"></span>
                        {feat}
                      </li>
                    ))}
                </ul>
              </div>
              <div className="md:w-1/2">
                <div className="max-w-md rounded-[20px] bg-[#f8f9fa] p-6 sm:p-8">
                  <h4 className="mb-3 text-[16px] font-black text-gray-900">
                    Premium Packaging Included
                  </h4>
                  <p className="text-[14px] font-medium leading-relaxed text-gray-500">
                    Every pair of glasses comes with our signature hard case, a microfiber cleaning
                    cloth, and a certificate of authenticity.
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'Specifications' && (
            <div className="pt-2 text-[15px] font-medium text-gray-600">
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
            <div className="pt-2 text-[15px] font-medium text-gray-600">
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
        <div className="mt-20">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.2em] text-[#ef4444]">
                RECOMMENDATION
              </p>
              <h2 className="text-[32px] font-black text-gray-900">Similar Products</h2>
            </div>
            <Link
              href="/shop"
              className="mb-2 flex items-center gap-1 text-[14px] font-bold text-[#2A3182] hover:underline"
            >
              View All
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {similar.map((p) => (
              <div
                key={p.id}
                className="group flex flex-col rounded-[25px] border border-[#ddd] bg-white p-2.5 transition-all duration-500 hover:shadow-xl"
              >
                <Link href={`/product/${p.slug}`}>
                  <div className="relative aspect-square overflow-hidden rounded-[20px] bg-[#f8f9fa]">
                    <div className="absolute right-3 top-3 z-10">
                      <div className="rounded-full border border-[#ddd] bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur-sm">
                        <span className="text-[9px] font-black uppercase tracking-tighter text-[#2A3182]">
                          {p.frame_shape ?? p.brand}
                        </span>
                      </div>
                    </div>
                    <img
                      src={getProductImageUrl(p)}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>
                </Link>
                <div className="flex flex-1 flex-col p-4 pt-4">
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <Link href={`/product/${p.slug}`}>
                      <h3 className="text-[16px] font-bold leading-tight text-gray-900 transition-colors group-hover:text-[#2A3182]">
                        {p.name}
                      </h3>
                    </Link>
                    <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-gray-300">
                      {p.brand}
                    </span>
                  </div>
                  <p className="mb-4 line-clamp-2 flex-1 text-[12px] leading-relaxed text-gray-400">
                    {p.description}
                  </p>
                  <div className="flex items-center justify-between gap-3 border-t border-[#ddd] pt-2">
                    <p className="text-[18px] font-black tracking-tight text-[#2A3182]">
                      {formatKes(Number(p.price_kes))}
                    </p>
                    <button
                      onClick={() =>
                        addToCart({
                          id: p.id,
                          title: p.name,
                          price: String(p.price_kes),
                          image: getProductImageUrl(p),
                          quantity: 1,
                        })
                      }
                      className="rounded-full bg-[#EF4444] px-4 py-2 text-[11px] font-bold text-white shadow-md transition-all hover:bg-red-600 active:scale-95"
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
