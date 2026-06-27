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
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TruckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0M1 3h15v13H1V3zm14 0l3 4v10h-3V7" />
  </svg>
);

const PackageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const BackArrowIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const XCircleIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-4 h-4 text-[#2A3182]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const MpesaIcon = () => (
  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

// ── Status helpers ─────────────────────────────────────────────────────────

const STAGES = [
  { key: 'order_placed',        label: 'Order Placed' },
  { key: 'payment_confirmed',   label: 'Payment Confirmed' },
  { key: 'processing',          label: 'Processing' },
  { key: 'dispatched',          label: 'Dispatched' },
  { key: 'delivered',           label: 'Delivered' },
];

// Returns index of last completed stage (0-based). -1 = nothing reached yet.
function getActiveStageIndex(status) {
  switch (status) {
    case 'pending_payment': return 0;
    case 'received':        return 1;
    case 'processing':      return 2;
    case 'dispatched':      return 3;
    case 'delivered':       return 4;
    default:                return -1;
  }
}

const PAYMENT_STATUS_STYLES = {
  paid:    'bg-green-50 text-green-700 border-green-200',
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  failed:  'bg-red-50 text-red-700 border-red-200',
  refunded:'bg-gray-50 text-gray-600 border-gray-200',
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
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
      .select('id, order_number, status, payment_status, payment_method, mpesa_ref, total_kes, created_at, updated_at, shipping_address, order_items(id, quantity, unit_price_kes, product:products(name, images))')
      .eq('id', orderId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); return; }
        setOrder(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, authLoading, orderId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] pt-[15px] pb-16 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#2A3182] border-t-transparent animate-spin" />
          <p className="text-[14px] font-medium text-gray-500">Loading order details…</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] pt-[15px] pb-16 flex items-center justify-center">
        <div className="bg-white rounded-[24px] p-10 shadow-sm border border-gray-100 text-center max-w-sm mx-4">
          <div className="text-red-400 mb-4 flex justify-center"><XCircleIcon /></div>
          <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-2">Order not found</h2>
          <p className="text-[13px] text-gray-400 mb-6">{error ?? 'This order does not exist or you do not have access to it.'}</p>
          <Link href="/profile" className="inline-flex items-center gap-2 bg-[#2A3182] text-white px-6 py-3 rounded-full text-[13px] font-bold hover:bg-[#1e2461] transition-colors">
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
    <div className="min-h-screen bg-[#f4f6f8] pt-[15px] pb-16 sm:pb-24">
      <div className="site-container max-w-4xl mx-auto">

        {/* Back nav */}
        <div className="mb-6">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-[13px] font-bold text-gray-400 hover:text-[#2A3182] transition-colors uppercase tracking-widest"
          >
            <BackArrowIcon />
            Back to Profile
          </Link>
        </div>

        {/* Header Card */}
        <div className="bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 shadow-sm border border-gray-100 mb-8 relative overflow-hidden">
          <div className="absolute right-[-20px] top-[-20px] opacity-[0.03] pointer-events-none">
            <TruckIcon />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-[#2A3182] text-white px-3 py-1 rounded-full mb-3">
                <PackageIcon />
                <span className="text-[10px] font-bold tracking-widest uppercase">Order Tracking</span>
              </div>
              <h1 className="text-[28px] sm:text-[36px] font-black text-[#2A3182] leading-tight">
                Order #{order.order_number}
              </h1>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${PAYMENT_STATUS_STYLES[order.payment_status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                Payment: {order.payment_status?.replace(/_/g, ' ')}
              </span>
              <span className="text-[12px] text-gray-400 font-medium">
                Placed {formatDateShort(order.created_at)}
              </span>
            </div>
          </div>

          {/* Payment details row */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 bg-[#f8fafc] rounded-xl px-3 py-2 border border-gray-100">
              <MpesaIcon />
              <span className="text-[12px] font-bold text-gray-600 capitalize">
                {order.payment_method?.replace(/_/g, ' ') ?? '—'}
              </span>
            </div>
            {order.mpesa_ref && (
              <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2 border border-green-100">
                <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">M-Pesa Ref:</span>
                <span className="text-[12px] font-black text-green-800 font-mono">{order.mpesa_ref}</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase">Total:</span>
              <span className="text-[11px] font-bold text-gray-400 uppercase mr-1">KSH.</span>
              <span className="text-[20px] font-black text-[#2A3182]">{Number(order.total_kes).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Cancelled Banner */}
        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-[20px] p-6 mb-8 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <XCircleIcon />
            </div>
            <div>
              <h3 className="text-[16px] font-black text-red-700 mb-1">Order Cancelled</h3>
              <p className="text-[13px] text-red-500">This order has been cancelled. If you have any questions, please contact us.</p>
            </div>
          </div>
        )}

        {/* Status Timeline */}
        {!isCancelled && (
          <div className="bg-white rounded-[24px] sm:rounded-[32px] shadow-sm border border-gray-100 p-6 sm:p-10 mb-8">
            <div className="flex items-center gap-3 mb-8">
              <ClockIcon />
              <h2 className="text-[14px] font-bold text-[#1a1a1a] tracking-wide uppercase">Order Status</h2>
            </div>

            {/* Desktop: horizontal timeline */}
            <div className="hidden sm:flex items-start justify-between relative">
              {/* Connector lines — rendered as absolute background spans */}
              <div className="absolute top-[20px] left-0 right-0 flex items-center px-[40px] pointer-events-none">
                {STAGES.slice(0, -1).map((_, i) => {
                  const lineActive = i < activeStageIndex;
                  return (
                    <div
                      key={i}
                      className={`flex-1 h-[3px] mx-2 rounded-full transition-colors duration-300 ${
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
                  <div key={stage.key} className="flex flex-col items-center gap-3 z-10 flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        reached
                          ? 'bg-[#2A3182] border-[#2A3182] text-white shadow-md shadow-[#2A3182]/30'
                          : 'bg-white border-gray-200 text-gray-300'
                      } ${isActive && order.status === 'delivered' ? 'bg-green-500 border-green-500 shadow-green-500/30' : ''}`}
                    >
                      {reached ? <CheckIcon /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                    </div>
                    <span
                      className={`text-[11px] font-bold text-center leading-tight tracking-wide uppercase ${
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
            <div className="flex sm:hidden flex-col gap-0">
              {STAGES.map((stage, i) => {
                const reached = i <= activeStageIndex;
                const isLast = i === STAGES.length - 1;
                const lineActive = i < activeStageIndex;
                return (
                  <div key={stage.key} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all duration-300 ${
                          reached
                            ? 'bg-[#2A3182] border-[#2A3182] text-white shadow-md shadow-[#2A3182]/20'
                            : 'bg-white border-gray-200 text-gray-300'
                        } ${order.status === 'delivered' && reached ? 'bg-green-500 border-green-500 shadow-green-500/20' : ''}`}
                      >
                        {reached ? <CheckIcon /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                      </div>
                      {!isLast && (
                        <div className={`w-[3px] h-8 rounded-full mt-1 ${lineActive ? 'bg-[#2A3182]' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    <div className={`pt-2 pb-6 ${isLast ? 'pb-0' : ''}`}>
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
            <div className="mt-8 flex items-center gap-3 bg-blue-50 rounded-2xl px-5 py-4 border border-blue-100">
              <TruckIcon />
              <p className="text-[13px] font-medium text-[#2A3182]">
                Delivery within <strong>2-3 business days</strong> within Nairobi
              </p>
            </div>
          </div>
        )}

        {/* Two-column: Items + Shipping */}
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Order Items */}
          <div className="flex-[2] bg-white rounded-[24px] sm:rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-gray-100 bg-[#fafbfc]">
              <h2 className="text-[14px] font-bold text-[#1a1a1a] tracking-wide uppercase">Order Items</h2>
            </div>
            <div className="overflow-x-auto">
              {orderItems.length === 0 ? (
                <div className="p-10 text-center text-[13px] text-gray-400">No items found.</div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[380px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-4 px-6 text-[10px] font-bold text-gray-400 tracking-widest uppercase w-1/2">Product</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-gray-400 tracking-widest uppercase text-center">Qty</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-gray-400 tracking-widest uppercase text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50 last:border-b-0">
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-3">
                            {item.product?.images?.[0] && (
                              <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#f8f9fa] flex-shrink-0 border border-gray-100">
                                <img
                                  src={getProductImageUrl(item.product)}
                                  alt={item.product?.name ?? 'Product'}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <span className="text-[14px] font-bold text-[#1a1a1a] leading-snug">
                              {item.product?.name ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#f4f6f8] text-[13px] font-black text-[#2A3182]">
                            {item.quantity}
                          </span>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <span className="text-[15px] font-black text-[#1a1a1a]">
                            {formatKes(Number(item.unit_price_kes) * item.quantity)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-100">
                      <td colSpan={2} className="py-5 px-6 text-[12px] font-bold text-gray-400 uppercase tracking-widest">Order Total</td>
                      <td className="py-5 px-6 text-right">
                        <span className="text-[11px] font-bold text-gray-400 uppercase mr-1">KSH.</span>
                        <span className="text-[20px] font-black text-[#2A3182]">{Number(order.total_kes).toFixed(2)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          {shippingAddr && (
            <div className="flex-1 bg-white rounded-[24px] sm:rounded-[32px] shadow-sm border border-gray-100 p-6 sm:p-8 self-start">
              <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-5">
                <LocationIcon />
                <h2 className="text-[14px] font-bold text-[#1a1a1a] tracking-wide uppercase">Shipping Address</h2>
              </div>
              <div className="space-y-2">
                {shippingAddr.name && (
                  <p className="text-[15px] font-black text-[#1a1a1a]">{shippingAddr.name}</p>
                )}
                {shippingAddr.line1 && (
                  <p className="text-[14px] text-gray-600 font-medium">{shippingAddr.line1}</p>
                )}
                {shippingAddr.line2 && (
                  <p className="text-[14px] text-gray-500">{shippingAddr.line2}</p>
                )}
                {shippingAddr.city && (
                  <p className="text-[14px] text-gray-600 font-medium">{shippingAddr.city}</p>
                )}
                {shippingAddr.phone && (
                  <p className="text-[13px] text-gray-400 mt-4 pt-4 border-t border-gray-100">{shippingAddr.phone}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="mt-8 text-center">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-[#2A3182] text-white px-8 py-4 rounded-full text-[14px] font-bold hover:bg-[#1e2461] transition-colors shadow-lg shadow-[#2A3182]/20"
          >
            Continue Shopping
          </Link>
        </div>

      </div>
    </div>
  );
}
