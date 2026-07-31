'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@optex/db/browser';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

// ── Icons ──────────────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const TruckIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0M1 3h15v13H1V3zm14 0l3 4v10h-3V7"
    />
  </svg>
);

const PackageIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
    />
  </svg>
);

const BackArrowIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const XCircleIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
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

const MpesaIcon = () => (
  <svg
    className="h-4 w-4 text-green-600"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
    />
  </svg>
);

// ── Status helpers ─────────────────────────────────────────────────────────

const STAGES = [
  { key: 'order_placed', label: 'Order Placed' },
  { key: 'payment_confirmed', label: 'Payment Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
];

// Returns index of last completed stage (0-based). -1 = nothing reached yet.
function getActiveStageIndex(status) {
  switch (status) {
    case 'pending_payment':
      return 0;
    case 'received':
      return 1;
    case 'processing':
      return 2;
    case 'dispatched':
      return 3;
    case 'delivered':
      return 4;
    default:
      return -1;
  }
}

const PAYMENT_STATUS_STYLES = {
  paid: 'bg-green-50 text-green-700 border-green-200',
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-gray-50 text-gray-600 border-gray-200',
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function OrderTrackingPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id;
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user || !orderId) return;

    const db = createBrowserSupabase();
    db.from('orders')
      .select(
        'id, order_number, status, payment_status, payment_method, mpesa_ref, total_kes, created_at, updated_at, shipping_address, order_items(id, quantity, unit_price_kes, product:products(name, images))',
      )
      .eq('id', orderId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          return;
        }
        setOrder(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, authLoading, orderId]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] pb-16 pt-[15px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#2A3182] border-t-transparent" />
          <p className="text-[14px] font-medium text-gray-500">Loading order details…</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] pb-16 pt-[15px]">
        <div className="mx-4 max-w-sm rounded-[24px] border border-gray-100 bg-white p-10 text-center shadow-sm">
          <div className="mb-4 flex justify-center text-red-400">
            <XCircleIcon />
          </div>
          <h2 className="mb-2 text-[18px] font-bold text-[#1a1a1a]">Order not found</h2>
          <p className="mb-6 text-[13px] text-gray-400">
            {error ?? 'This order does not exist or you do not have access to it.'}
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-full bg-[#2A3182] px-6 py-3 text-[13px] font-bold text-white transition-colors hover:bg-[#1e2461]"
          >
            <BackArrowIcon />
            Back to Profile
          </Link>
        </div>
      </div>
    );
  }

  const isCancelled = order.status === 'cancelled';
  const activeStageIndex = getActiveStageIndex(order.status);
  const orderItems = order.order_items ?? [];
  const shippingAddr = order.shipping_address;

  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-16 pt-[15px] sm:pb-24">
      <div className="site-container mx-auto max-w-4xl">
        {/* Back nav */}
        <div className="mb-6">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-[#2A3182]"
          >
            <BackArrowIcon />
            Back to Profile
          </Link>
        </div>

        {/* Header Card */}
        <div className="relative mb-8 overflow-hidden rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:rounded-[32px] sm:p-10">
          <div className="pointer-events-none absolute right-[-20px] top-[-20px] opacity-[0.03]">
            <TruckIcon />
          </div>

          <div className="mb-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#2A3182] px-3 py-1 text-white">
                <PackageIcon />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Order Tracking
                </span>
              </div>
              <h1 className="text-[28px] font-black leading-tight text-[#2A3182] sm:text-[36px]">
                Order #{order.order_number}
              </h1>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span
                className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${PAYMENT_STATUS_STYLES[order.payment_status] ?? 'border-gray-200 bg-gray-50 text-gray-600'}`}
              >
                Payment: {order.payment_status?.replace(/_/g, ' ')}
              </span>
              <span className="text-[12px] font-medium text-gray-400">
                Placed {formatDateShort(order.created_at)}
              </span>
            </div>
          </div>

          {/* Payment details row */}
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-[#f8fafc] px-3 py-2">
              <MpesaIcon />
              <span className="text-[12px] font-bold capitalize text-gray-600">
                {order.payment_method?.replace(/_/g, ' ') ?? '—'}
              </span>
            </div>
            {order.mpesa_ref && (
              <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">
                  M-Pesa Ref:
                </span>
                <span className="font-mono text-[12px] font-black text-green-800">
                  {order.mpesa_ref}
                </span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[11px] font-bold uppercase text-gray-400">Total:</span>
              <span className="mr-1 text-[11px] font-bold uppercase text-gray-400">KSH.</span>
              <span className="text-[20px] font-black text-[#2A3182]">
                {Number(order.total_kes).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Cancelled Banner */}
        {isCancelled && (
          <div className="mb-8 flex items-center gap-4 rounded-[20px] border border-red-200 bg-red-50 p-6">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
              <XCircleIcon />
            </div>
            <div>
              <h3 className="mb-1 text-[16px] font-black text-red-700">Order Cancelled</h3>
              <p className="text-[13px] text-red-500">
                This order has been cancelled. If you have any questions, please contact us.
              </p>
            </div>
          </div>
        )}

        {/* Status Timeline */}
        {!isCancelled && (
          <div className="mb-8 rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:rounded-[32px] sm:p-10">
            <div className="mb-8 flex items-center gap-3">
              <ClockIcon />
              <h2 className="text-[14px] font-bold uppercase tracking-wide text-[#1a1a1a]">
                Order Status
              </h2>
            </div>

            {/* Desktop: horizontal timeline */}
            <div className="relative hidden items-start justify-between sm:flex">
              {/* Connector lines — rendered as absolute background spans */}
              <div className="pointer-events-none absolute left-0 right-0 top-[20px] flex items-center px-[40px]">
                {STAGES.slice(0, -1).map((_, i) => {
                  const lineActive = i < activeStageIndex;
                  return (
                    <div
                      key={i}
                      className={`mx-2 h-[3px] flex-1 rounded-full transition-colors duration-300 ${
                        lineActive ? 'bg-[#2A3182]' : 'bg-gray-200'
                      }`}
                    />
                  );
                })}
              </div>

              {STAGES.map((stage, i) => {
                const reached = i <= activeStageIndex;
                const isActive = i === activeStageIndex;
                return (
                  <div key={stage.key} className="z-10 flex flex-1 flex-col items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        reached
                          ? 'border-[#2A3182] bg-[#2A3182] text-white shadow-md shadow-[#2A3182]/30'
                          : 'border-gray-200 bg-white text-gray-300'
                      } ${isActive && order.status === 'delivered' ? 'border-green-500 bg-green-500 shadow-green-500/30' : ''}`}
                    >
                      {reached ? (
                        <CheckIcon />
                      ) : (
                        <span className="text-[11px] font-bold">{i + 1}</span>
                      )}
                    </div>
                    <span
                      className={`text-center text-[11px] font-bold uppercase leading-tight tracking-wide ${
                        reached ? 'text-[#2A3182]' : 'text-gray-300'
                      } ${isActive && order.status === 'delivered' ? 'text-green-600' : ''}`}
                    >
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile: vertical timeline */}
            <div className="flex flex-col gap-0 sm:hidden">
              {STAGES.map((stage, i) => {
                const reached = i <= activeStageIndex;
                const isLast = i === STAGES.length - 1;
                const lineActive = i < activeStageIndex;
                return (
                  <div key={stage.key} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                          reached
                            ? 'border-[#2A3182] bg-[#2A3182] text-white shadow-md shadow-[#2A3182]/20'
                            : 'border-gray-200 bg-white text-gray-300'
                        } ${order.status === 'delivered' && reached ? 'border-green-500 bg-green-500 shadow-green-500/20' : ''}`}
                      >
                        {reached ? (
                          <CheckIcon />
                        ) : (
                          <span className="text-[11px] font-bold">{i + 1}</span>
                        )}
                      </div>
                      {!isLast && (
                        <div
                          className={`mt-1 h-8 w-[3px] rounded-full ${lineActive ? 'bg-[#2A3182]' : 'bg-gray-200'}`}
                        />
                      )}
                    </div>
                    <div className={`pb-6 pt-2 ${isLast ? 'pb-0' : ''}`}>
                      <span
                        className={`text-[13px] font-bold uppercase tracking-wide ${
                          reached ? 'text-[#2A3182]' : 'text-gray-300'
                        } ${order.status === 'delivered' && reached ? 'text-green-600' : ''}`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Estimated delivery note */}
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
              <TruckIcon />
              <p className="text-[13px] font-medium text-[#2A3182]">
                Delivery within <strong>2-3 business days</strong> within Nairobi
              </p>
            </div>
          </div>
        )}

        {/* Two-column: Items + Shipping */}
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Order Items */}
          <div className="flex-[2] overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm sm:rounded-[32px]">
            <div className="border-b border-gray-100 bg-[#fafbfc] p-6 sm:p-8">
              <h2 className="text-[14px] font-bold uppercase tracking-wide text-[#1a1a1a]">
                Order Items
              </h2>
            </div>
            <div className="overflow-x-auto">
              {orderItems.length === 0 ? (
                <div className="p-10 text-center text-[13px] text-gray-400">No items found.</div>
              ) : (
                <table className="w-full min-w-[380px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="w-1/2 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Product
                      </th>
                      <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Qty
                      </th>
                      <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50 last:border-b-0">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            {item.product?.images?.[0] && (
                              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-[#f8f9fa]">
                                <img
                                  src={getProductImageUrl(item.product)}
                                  alt={item.product?.name ?? 'Product'}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            )}
                            <span className="text-[14px] font-bold leading-snug text-[#1a1a1a]">
                              {item.product?.name ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f6f8] text-[13px] font-black text-[#2A3182]">
                            {item.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-[15px] font-black text-[#1a1a1a]">
                            {formatKes(Number(item.unit_price_kes) * item.quantity)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-100">
                      <td
                        colSpan={2}
                        className="px-6 py-5 text-[12px] font-bold uppercase tracking-widest text-gray-400"
                      >
                        Order Total
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="mr-1 text-[11px] font-bold uppercase text-gray-400">
                          KSH.
                        </span>
                        <span className="text-[20px] font-black text-[#2A3182]">
                          {Number(order.total_kes).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          {shippingAddr && (
            <div className="flex-1 self-start rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:rounded-[32px] sm:p-8">
              <div className="mb-6 flex items-center gap-2 border-b border-gray-100 pb-5">
                <LocationIcon />
                <h2 className="text-[14px] font-bold uppercase tracking-wide text-[#1a1a1a]">
                  Shipping Address
                </h2>
              </div>
              <div className="space-y-2">
                {shippingAddr.name && (
                  <p className="text-[15px] font-black text-[#1a1a1a]">{shippingAddr.name}</p>
                )}
                {shippingAddr.line1 && (
                  <p className="text-[14px] font-medium text-gray-600">{shippingAddr.line1}</p>
                )}
                {shippingAddr.line2 && (
                  <p className="text-[14px] text-gray-500">{shippingAddr.line2}</p>
                )}
                {shippingAddr.city && (
                  <p className="text-[14px] font-medium text-gray-600">{shippingAddr.city}</p>
                )}
                {shippingAddr.phone && (
                  <p className="mt-4 border-t border-gray-100 pt-4 text-[13px] text-gray-400">
                    {shippingAddr.phone}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="mt-8 text-center">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-full bg-[#2A3182] px-8 py-4 text-[14px] font-bold text-white shadow-lg shadow-[#2A3182]/20 transition-colors hover:bg-[#1e2461]"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
