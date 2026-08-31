'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { formatKes, formatKesNumber } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

// ─── Icons ────────────────────────────────────────────────────────────────────

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

const SpinnerIcon = () => (
  <svg className="h-5 w-5 animate-spin text-yellow-600" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

const ShoppingBagIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
    />
  </svg>
);

const ListIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
  </svg>
);

const LocationIcon = () => (
  <svg
    className="h-4 w-4 text-[#2A3182]"
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PAYMENT_BADGE = {
  mpesa: { label: 'M-Pesa', cls: 'bg-green-50 text-green-700 border-green-200' },
  pesapal: { label: 'Pesapal', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  cod: { label: 'Cash on Delivery', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const PAYMENT_STATUS_BADGE = {
  paid: { label: 'Paid', cls: 'bg-green-50 text-green-700 border-green-200' },
  pending: { label: 'Pending', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 border-red-200' },
};

function toDisplayOrder(detail) {
  return {
    id: detail.id,
    order_number: detail.orderNumber,
    total_kes: detail.totalKes,
    subtotal_kes: detail.subtotalKes,
    vat_kes: detail.vatKes,
    shipping_kes: detail.shippingKes,
    status: detail.status,
    payment_status: detail.paymentStatus,
    payment_method: detail.paymentMethod,
    mpesa_ref: null,
    shipping: detail.shipping,
    created_at: detail.createdAt,
    order_items: (detail.items ?? []).map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unit_price_kes: item.unitPriceKes,
      product: item.product
        ? { name: item.product.name, images: item.product.image ? [item.product.image] : [] }
        : null,
    })),
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const { orderId } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(null);

  const pollRef = useRef(null);
  const attemptsRef = useRef(0);
  const MAX_POLL = 24;

  // ── Auth + initial fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    let cancelled = false;
    api.orders
      .get(orderId)
      .then((detail) => {
        if (cancelled) return;
        const displayOrder = toDisplayOrder(detail);
        setOrder(displayOrder);
        setPaymentStatus(displayOrder.payment_status);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error?.status === 404) setNotFound(true);
        else setLoadError(error?.message ?? 'Could not load this order.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, router, user, authLoading]);

  // ── M-Pesa pending poller ───────────────────────────────────────────────────
  useEffect(() => {
    if (!order) return;
    const isMpesaPending = order.payment_method === 'mpesa' && paymentStatus === 'pending';
    if (!isMpesaPending) return;

    pollRef.current = setInterval(async () => {
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_POLL) {
        clearInterval(pollRef.current);
        return;
      }
      try {
        const detail = await api.orders.get(orderId);
        if (detail.paymentStatus && detail.paymentStatus !== 'pending') {
          setPaymentStatus(detail.paymentStatus);
          setOrder(toDisplayOrder(detail));
          clearInterval(pollRef.current);
        }
      } catch (error) {
        console.error('Could not refresh payment status:', error);
      }
    }, 5000);

    return () => clearInterval(pollRef.current);
  }, [order, orderId, paymentStatus]);

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] pt-24">
        <div className="flex flex-col items-center gap-4">
          <svg className="h-10 w-10 animate-spin text-[#2A3182]" fill="none" viewBox="0 0 24 24">
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
          <p className="text-[14px] font-medium text-gray-500">Loading your order…</p>
        </div>
      </div>
    );
  }

  // ── 404 state ───────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] pt-24">
        <div className="mx-4 w-full max-w-md rounded-[24px] border border-gray-100 bg-white p-10 text-center shadow-sm sm:rounded-[32px]">
          <div className="mb-4 text-6xl">🔍</div>
          <h2 className="mb-2 text-[24px] font-black text-[#2A3182]">Order Not Found</h2>
          <p className="mb-8 text-[14px] text-gray-500">
            We couldn't find an order matching this link. It may have been removed or the link may
            be incorrect.
          </p>
          <button
            onClick={() => router.push('/profile')}
            className="rounded-full bg-[#2A3182] px-8 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-blue-900"
          >
            View Order History
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] pt-24">
        <div className="mx-4 w-full max-w-md rounded-[24px] border border-gray-100 bg-white p-10 text-center shadow-sm">
          <h2 className="mb-2 text-[24px] font-black text-[#2A3182]">
            We could not load your order
          </h2>
          <p className="mb-8 text-[14px] text-gray-500">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#2A3182] px-8 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-blue-900"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Derived display values ──────────────────────────────────────────────────
  const pmBadge = PAYMENT_BADGE[order.payment_method] ?? {
    label: order.payment_method,
    cls: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  const psBadge = PAYMENT_STATUS_BADGE[paymentStatus] ?? {
    label: paymentStatus,
    cls: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  const isMpesaPending = order.payment_method === 'mpesa' && paymentStatus === 'pending';
  const shipping = order.shipping ?? {};
  const subtotal = Number(order.subtotal_kes ?? 0);
  const vat = Number(order.vat_kes ?? 0);
  const total = Number(order.total_kes ?? 0);

  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-16 pt-28 sm:pb-24 sm:pt-36">
      <div className="site-container mx-auto max-w-2xl px-4">
        {/* ── Confirmation Card ── */}
        <div className="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm sm:rounded-[32px]">
          {/* Header strip */}
          <div className="bg-[#2A3182] px-6 py-5 sm:px-10 sm:py-7">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-blue-200">
              Optex Opticians
            </p>
            <p className="text-[13px] font-medium text-blue-100">Order Receipt</p>
          </div>

          {/* Main content */}
          <div className="p-6 sm:p-10">
            {/* Green checkmark + heading */}
            <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
              <CheckCircleIcon />
              <h1 className="mt-4 text-[28px] font-black leading-tight text-[#2A3182] sm:text-[34px]">
                Order Confirmed!
              </h1>
              <p className="mt-2 text-[14px] font-medium text-gray-500 sm:text-[15px]">
                Thank you for shopping with Optex Opticians.
              </p>
              <p className="mt-1 text-[13px] text-gray-400">
                Placed on {formatDate(order.created_at)}
              </p>

              {/* Order number */}
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-[#f4f6f8] px-5 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Order
                </span>
                <span className="text-[16px] font-black text-[#2A3182]">{order.order_number}</span>
              </div>
            </div>

            {/* Badges row */}
            <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${pmBadge.cls}`}
              >
                {pmBadge.label}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${psBadge.cls}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${paymentStatus === 'paid' ? 'bg-green-500' : paymentStatus === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`}
                />
                {psBadge.label}
              </span>
            </div>

            {/* M-Pesa pending STK banner */}
            {isMpesaPending && (
              <div className="mb-8 flex items-start gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-4">
                <SpinnerIcon />
                <div className="flex-1">
                  <p className="mb-0.5 text-[14px] font-bold text-yellow-800">
                    📱 Check your phone
                  </p>
                  <p className="text-[13px] leading-relaxed text-yellow-700">
                    STK Push has been sent to your M-Pesa number. Please enter your PIN to complete
                    the payment. Waiting for confirmation…
                  </p>
                </div>
              </div>
            )}

            {/* M-Pesa paid confirmation */}
            {order.payment_method === 'mpesa' && paymentStatus === 'paid' && order.mpesa_ref && (
              <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
                <p className="mb-0.5 text-[13px] font-bold text-green-700">
                  M-Pesa Payment Received
                </p>
                <p className="text-[12px] text-green-600">
                  Confirmation code: <span className="font-black">{order.mpesa_ref}</span>
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="mb-8 border-t border-gray-100" />

            {/* Order items */}
            <div className="mb-8">
              <h3 className="mb-5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Items Ordered
              </h3>
              <div className="flex flex-col gap-4">
                {(order.order_items ?? []).map((item) => {
                  const product = item.product ?? {};
                  const hasImage = Array.isArray(product.images) && product.images.length > 0;
                  return (
                    <div key={item.id} className="flex items-center gap-4">
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                        {hasImage ? (
                          <Image
                            src={getProductImageUrl(product)}
                            alt={product.name}
                            fill
                            sizes="64px"
                            className="object-contain p-2"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">
                            👓
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold leading-tight text-[#2A3182]">
                          {product.name ?? 'Product'}
                        </p>
                        <p className="mt-0.5 text-[12px] text-gray-400">Qty: {item.quantity}</p>
                      </div>
                      <p className="flex-shrink-0 text-[14px] font-bold text-[#2A3182]">
                        {formatKes(Number(item.unit_price_kes) * item.quantity)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals */}
            <div className="mb-8 space-y-3 rounded-2xl border border-gray-100 bg-[#f8fafc] p-5 sm:p-6">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-gray-500">Subtotal</span>
                <span className="font-medium text-[#2A3182]">{formatKes(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-gray-500">Shipping</span>
                <span className="font-medium text-gray-500">
                  {Number(order.shipping_kes) > 0 ? formatKes(Number(order.shipping_kes)) : 'FREE'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-gray-500">VAT (16%)</span>
                <span className="font-medium text-[#2A3182]">{formatKes(vat)}</span>
              </div>
              <div className="flex items-end justify-between border-t border-gray-200 pt-3">
                <span className="text-[16px] font-bold text-[#2A3182]">Total</span>
                <div className="flex items-center gap-1">
                  <span className="mb-0.5 text-[11px] font-bold uppercase tracking-tight text-gray-500">
                    KSH.
                  </span>
                  <span className="text-[22px] font-black text-[#2A3182]">
                    {formatKesNumber(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Shipping address */}
            {(shipping.name || shipping.address) && (
              <div className="mb-8">
                <div className="mb-3 flex items-center gap-2">
                  <LocationIcon />
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Shipping Address
                  </h3>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] px-5 py-4 text-[14px] leading-relaxed text-gray-700">
                  {shipping.name && <p className="font-bold text-[#2A3182]">{shipping.name}</p>}
                  {shipping.address && <p>{shipping.address}</p>}
                  {(shipping.city || shipping.county) && (
                    <p>{[shipping.city, shipping.county].filter(Boolean).join(', ')}</p>
                  )}
                  {shipping.phone && <p className="mt-1 text-gray-500">{shipping.phone}</p>}
                </div>
              </div>
            )}

            {/* CTA buttons */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push('/shop')}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#c1272d] py-4 text-[14px] font-bold text-white shadow-lg shadow-red-500/20 transition-colors hover:bg-red-800"
              >
                <ShoppingBagIcon />
                Continue Shopping
              </button>
              <button
                type="button"
                onClick={() => router.push('/profile')}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-[#2A3182] py-4 text-[14px] font-bold text-[#2A3182] transition-colors hover:bg-blue-50"
              >
                <ListIcon />
                View Order History
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
