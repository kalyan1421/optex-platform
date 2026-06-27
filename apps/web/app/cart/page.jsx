'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { createBrowserSupabase } from '@optex/db/browser';

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const ArrowRotateIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const Cart = () => {
  const { items, updateQuantity, removeItem } = useCart();
  const [promoInput, setPromoInput] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const estimatedTax = subtotal * 0.08;
  const total = subtotal + estimatedTax - promoDiscount;

  const formatCurrency = (value) => Math.max(0, value).toFixed(2);

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    if (code === promoApplied) { setPromoError('Code already applied.'); return; }
    setPromoLoading(true);
    setPromoError('');
    try {
      const db = createBrowserSupabase();
      const { data } = await db
        .from('promo_codes')
        .select('code, discount_type, value, max_uses, uses, starts_at, expires_at, is_active')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();
      if (!data) { setPromoError('Invalid or expired promo code.'); return; }
      // M-3 FIX: compare timestamps as numbers (ms since epoch) so timezone
      // differences between the DB (UTC) and the client locale don't cause
      // valid codes to appear expired in UTC+N timezones.
      if (data.expires_at && Date.parse(data.expires_at) < Date.now()) {
        setPromoError('This promo code has expired.');
        return;
      }
      if (data.max_uses && data.uses >= data.max_uses) {
        setPromoError('This promo code has reached its usage limit.');
        return;
      }
      const discount = data.discount_type === 'percent'
        ? subtotal * (Number(data.value) / 100)
        : Number(data.value);
      setPromoDiscount(Math.min(discount, subtotal));
      setPromoApplied(data.code);
      setPromoInput('');
    } catch {
      // M-3 FIX: catch DB / network errors and show a friendly message rather
      // than letting the unhandled rejection surface as a blank error state.
      setPromoError('Could not validate promo code. Please try again.');
    } finally {
      setPromoLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white pb-12 pt-[15px] sm:pb-20">
      <div className="site-container">

        {/* Header */}
        <div className="mb-6 text-center sm:mb-8 sm:text-left">
          <h1 className="mb-1 text-[28px] font-black leading-tight text-[#2A3182] sm:mb-2 sm:text-[36px]">
            Shopping Cart
          </h1>
          <p className="text-[14px] font-medium text-gray-500 sm:text-[15px]">
            You have {items.length} items in your bag.
          </p>

        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">

          {/* Left Column - Cart Items */}
          <div className="flex flex-1 flex-col gap-4 sm:gap-5">
            {items.map(item => (
              <div
                key={item.id}
                className="min-w-0 rounded-[26px] border border-gray-100 bg-white p-4 shadow-[0_4px_24px_-16px_rgba(0,0,0,0.16)] transition-shadow hover:shadow-[0_14px_36px_-22px_rgba(0,0,0,0.18)] sm:rounded-[30px] sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-4">
                  <div className="flex min-w-0 items-start gap-3 sm:gap-5">
                    {/* Product Image */}
                    <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-gray-50 sm:h-[140px] sm:w-[140px]">
                      <img src={item.image} alt={item.title} className="h-full w-full object-contain p-2 sm:p-3" />
                    </div>

                    {/* Product Info */}
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          {(item.badge || item.brand) && (
                            <p className={`mb-1 text-[10px] font-bold uppercase tracking-[0.22em] ${item.badgeColor ?? 'text-[#2A3182]'} sm:mb-1.5 sm:text-[11px]`}>
                              {item.badge || item.brand}
                            </p>
                          )}
                          <h3 className="mb-1 text-[17px] font-bold leading-tight text-[#2A3182] sm:mb-2 sm:text-[20px]">
                            {item.title}
                          </h3>
                          <p className="break-words text-[12px] font-medium leading-relaxed text-gray-500 sm:text-[13px]">
                            {item.variant}
                          </p>
                        </div>
                        <div className="flex items-end gap-1 self-start rounded-full bg-[#F5F7FB] px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0">
                          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#2A3182] sm:text-[11px]">
                            KSH.
                          </span>
                          <span className="text-[18px] font-black leading-none text-[#2A3182] sm:text-[20px]">
                            {item.price}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 sm:pt-5">
                        {/* Quantity Control */}
                        <div className="flex items-center rounded-full border border-gray-200 bg-[#F8F9FA] p-1">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-medium text-[#2A3182] transition-colors hover:bg-white sm:h-9 sm:w-9"
                            aria-label={`Decrease quantity for ${item.title}`}
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-[13px] font-bold text-[#2A3182] sm:w-10 sm:text-[14px]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-medium text-[#2A3182] transition-colors hover:bg-white sm:h-9 sm:w-9"
                            aria-label={`Increase quantity for ${item.title}`}
                          >
                            +
                          </button>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-[12px] font-semibold text-gray-500 transition-colors hover:border-red-200 hover:text-red-500 sm:min-h-0 sm:border-0 sm:px-0 sm:py-0 sm:text-[14px]"
                        >
                          <TrashIcon />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Promo Code Box */}
            <div className="mt-2 flex flex-col items-stretch gap-4 rounded-[26px] border-2 border-dashed border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-[30px] sm:p-6">
              <span className="flex-shrink-0 text-center text-[13px] font-bold uppercase tracking-wide text-[#2A3182] sm:text-left sm:text-[14px]">
                HAVE A PROMO CODE?
              </span>
              <div className="flex w-full flex-1 flex-col gap-2 sm:w-auto sm:max-w-sm">
                {promoApplied ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-full px-4 py-2.5">
                    <span className="text-[13px] font-bold text-green-700">✓ {promoApplied} applied</span>
                    <button
                      onClick={() => { setPromoApplied(''); setPromoDiscount(0); }}
                      className="text-[12px] text-gray-400 hover:text-red-500 font-medium ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={e => setPromoInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyPromo()}
                      placeholder="Enter code"
                      className="w-full min-w-0 rounded-full border border-gray-100 bg-[#f8f9fa] px-4 py-3 text-[13px] outline-none transition-all focus:border-[#2A3182] focus:ring-1 focus:ring-[#2A3182] sm:px-5 sm:text-[14px]"
                    />
                    <button
                      onClick={applyPromo}
                      disabled={promoLoading}
                      className="w-auto flex-shrink-0 rounded-full bg-[#1a1a5c] px-8 py-3 text-[13px] font-bold text-white transition-colors hover:bg-[#2A3182] disabled:opacity-60"
                    >
                      {promoLoading ? '…' : 'APPLY'}
                    </button>
                  </div>
                )}
                {promoError && (
                  <p className="text-[12px] text-red-500 font-medium px-2">{promoError}</p>
                )}
              </div>
            </div>

          </div>

          {/* Right Column - Order Summary */}
          <div className="w-full flex-shrink-0 lg:w-[380px]">
            <div className="overflow-hidden rounded-[28px] bg-white p-5 shadow-[0_14px_44px_-24px_rgba(0,0,0,0.22)] sm:rounded-[32px] sm:p-7 lg:sticky lg:top-32">
              <h2 className="mb-5 text-[20px] font-bold text-[#2A3182] sm:mb-7 sm:text-[24px]">Order Summary</h2>

              <div className="mb-6 space-y-4">
                <div className="flex items-center justify-between gap-4 text-[14px]">
                  <span className="text-gray-500 font-medium">Subtotal</span>
                  <span className="text-right font-medium text-[#2A3182]">KSH. {formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-[14px]">
                  <span className="text-gray-500 font-medium">Shipping</span>
                  <span className="font-medium text-gray-500">FREE</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-[14px]">
                  <span className="text-gray-500 font-medium">Estimated Tax</span>
                  <span className="text-right font-medium text-[#2A3182]">KSH. {formatCurrency(estimatedTax)}</span>
                </div>
                {promoDiscount > 0 && (
                  <div className="flex items-center justify-between gap-4 text-[14px]">
                    <span className="text-green-600 font-medium">Promo ({promoApplied})</span>
                    <span className="text-right font-medium text-green-600">- KSH. {formatCurrency(promoDiscount)}</span>
                  </div>
                )}
              </div>

              <div className="mb-7 flex items-end justify-between gap-4 border-t border-gray-100 pt-5">
                <span className="text-[20px] font-bold text-[#2A3182]">Total</span>
                <div className="flex items-end gap-1 text-right">
                  <span className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-900 sm:text-[12px]">KSH.</span>
                  <span className="text-[24px] font-black leading-none text-[#2A3182] sm:text-[26px]">{formatCurrency(total)}</span>
                </div>
              </div>

              <Link href="/checkout" className="mb-7 flex w-full items-center justify-center gap-2 rounded-full bg-[#c1272d] px-5 py-4 text-center text-[14px] font-bold text-white shadow-lg shadow-red-500/20 transition-colors hover:bg-red-800 sm:text-[15px]">
                Proceed to Checkout
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>

              <div className="space-y-4">
                <div className="flex items-start gap-3 text-[13px] font-medium leading-relaxed text-gray-600">
                  <div className="pt-0.5 text-[#2A3182]"><ShieldCheckIcon /></div>
                  Secure Checkout Powered by OptiPay
                </div>
                <div className="flex items-start gap-3 text-[13px] font-medium leading-relaxed text-gray-600">
                  <div className="pt-0.5 text-[#2A3182]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  Free standard delivery on all orders
                </div>
                <div className="flex items-start gap-3 text-[13px] font-medium leading-relaxed text-gray-600">
                  <div className="pt-0.5 text-[#2A3182]"><ArrowRotateIcon /></div>
                  30-day hassle-free return policy
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default function Page() { return <Cart />; }
