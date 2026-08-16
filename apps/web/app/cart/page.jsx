'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { createBrowserSupabase } from '@optex/db/browser';
import { formatKesNumber } from '@optex/ui';

const TrashIcon = () => (
  <svg
    className="h-4 w-4 lg:h-[15px] lg:w-[14px]"
    viewBox="0 0 14 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2.5 15C2.04167 15 1.64931 14.8368 1.32292 14.5104C0.996528 14.184 0.833333 13.7917 0.833333 13.3333V2.5H0V0.833333H4.16667V0H9.16667V0.833333H13.3333V2.5H12.5V13.3333C12.5 13.7917 12.3368 14.184 12.0104 14.5104C11.684 14.8368 11.2917 15 10.8333 15H2.5ZM10.8333 2.5H2.5V13.3333H10.8333V2.5ZM4.16667 11.6667H5.83333V4.16667H4.16667V11.6667ZM7.5 11.6667H9.16667V4.16667H7.5V11.6667ZM2.5 2.5V13.3333V2.5Z"
      fill="currentColor"
    />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg
    className="h-6 w-5 text-[#141776] lg:h-[20px] lg:w-[16px]"
    viewBox="0 0 16 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.95 13.55L12.6 7.9L11.175 6.475L6.95 10.7L4.85 8.6L3.425 10.025L6.95 13.55ZM8 20C5.68333 19.4167 3.77083 18.0875 2.2625 16.0125C0.754167 13.9375 0 11.6333 0 9.1V3L8 0L16 3V9.1C16 11.6333 15.2458 13.9375 13.7375 16.0125C12.2292 18.0875 10.3167 19.4167 8 20ZM8 17.9C9.73333 17.35 11.1667 16.25 12.3 14.6C13.4333 12.95 14 11.1167 14 9.1V4.375L8 2.125L2 4.375V9.1C2 11.1167 2.56667 12.95 3.7 14.6C4.83333 16.25 6.26667 17.35 8 17.9Z"
      fill="currentColor"
    />
  </svg>
);

const ArrowRotateIcon = () => (
  <svg
    className="h-6 w-5 text-[#141776] lg:h-[21px] lg:w-[18px]"
    viewBox="0 0 18 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 21C7.75 21 6.57917 20.7625 5.4875 20.2875C4.39583 19.8125 3.44583 19.1708 2.6375 18.3625C1.82917 17.5542 1.1875 16.6042 0.7125 15.5125C0.2375 14.4208 0 13.25 0 12H2C2 13.95 2.67917 15.6042 4.0375 16.9625C5.39583 18.3208 7.05 19 9 19C10.95 19 12.6042 18.3208 13.9625 16.9625C15.3208 15.6042 16 13.95 16 12C16 10.05 15.3208 8.39583 13.9625 7.0375C12.6042 5.67917 10.95 5 9 5H8.85L10.4 6.55L9 8L5 4L9 0L10.4 1.45L8.85 3H9C10.25 3 11.4208 3.2375 12.5125 3.7125C13.6042 4.1875 14.5542 4.82917 15.3625 5.6375C16.1708 6.44583 16.8125 7.39583 17.2875 8.4875C17.7625 9.57917 18 10.75 18 12C18 13.25 17.7625 14.4208 17.2875 15.5125C16.8125 16.6042 16.1708 17.5542 15.3625 18.3625C14.5542 19.1708 13.6042 19.8125 12.5125 20.2875C11.4208 20.7625 10.25 21 9 21Z"
      fill="currentColor"
    />
  </svg>
);

const Cart = () => {
  const { items, updateQuantity, removeItem, loading } = useCart();
  const [promoInput, setPromoInput] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const estimatedTax = subtotal * 0.08;
  const total = subtotal + estimatedTax - promoDiscount;

  const formatCurrency = (value) => formatKesNumber(Math.max(0, value));

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    if (code === promoApplied) {
      setPromoError('Code already applied.');
      return;
    }
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
      if (!data) {
        setPromoError('Invalid or expired promo code.');
        return;
      }
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
      const discount =
        data.discount_type === 'percent'
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

  // An empty cart got the full two-column layout: a promo-code box with
  // nothing to discount, an order summary of KSH 0.00, and a "Proceed to
  // Checkout" button that led to a checkout with nothing in it. Give it a
  // single panel and one obvious way forward instead.
  //
  // Gated on `loading` because both carts arrive asynchronously — the guest
  // cart from localStorage after mount, the account cart from the API — so
  // `items` is briefly empty for a customer who has one.
  if (!loading && items.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto w-full max-w-[1440px] px-6 pb-[100px] pt-[20px] lg:px-[100px]">
          <h1
            className="m-0 mb-[27px] text-[#141776]"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '36px',
              lineHeight: '46.8px',
              fontWeight: 700,
            }}
          >
            Shopping Cart
          </h1>

          <div className="mx-auto flex max-w-[736px] flex-col items-center rounded-[36px] border-[1.13px] border-[rgba(199,197,212,0.3)] bg-white px-6 py-[72px] text-center">
            <div className="mb-[24px] flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#F3F3F6]">
              <svg
                className="h-[40px] w-[40px] text-[#141776]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z"
                />
              </svg>
            </div>

            <h2
              className="m-0 mb-[9px] text-[#141776]"
              style={{ fontFamily: 'Poppins, sans-serif', fontSize: '27px', fontWeight: 700 }}
            >
              Your cart is empty
            </h2>
            <p
              className="m-0 mb-[32px] max-w-[420px] text-[#464652]"
              style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', lineHeight: '27px' }}
            >
              Nothing here yet. Browse the collection, or book an eye test and let an optometrist
              help you choose.
            </p>

            <div className="flex flex-col items-center gap-[16px] sm:flex-row">
              <Link
                href="/shop"
                className="flex h-[54px] items-center justify-center rounded-[26843500px] bg-[#141776] px-[36px] text-white transition-colors hover:bg-[#2A3182]"
                style={{ fontFamily: 'Manrope, sans-serif', fontSize: '16px', fontWeight: 700 }}
              >
                Browse the collection
              </Link>
              <Link
                href="/appointments"
                className="flex h-[54px] items-center justify-center rounded-[26843500px] border-[1.13px] border-[#C7C5D4] px-[36px] text-[#141776] transition-colors hover:bg-[#F3F3F6]"
                style={{ fontFamily: 'Manrope, sans-serif', fontSize: '16px', fontWeight: 700 }}
              >
                Book an eye test
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[1440px] px-[100px] pb-[100px] pt-[20px]">
        <div className="flex items-start gap-[54px]">
          {/* Left Column - Cart Items */}
          <div className="flex w-[736px] shrink-0 flex-col">
            {/* Header */}
            <div className="mb-[27px] flex flex-col gap-[9px]">
              <h1
                className="m-0 text-[#141776]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '36px',
                  lineHeight: '46.8px',
                  fontWeight: 700,
                }}
              >
                Shopping Cart
              </h1>
              <p
                className="m-0 text-[#464652]"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '18px',
                  lineHeight: '27px',
                  fontWeight: 400,
                }}
              >
                You have {items.length} {items.length === 1 ? 'item' : 'items'} in your bag.
              </p>
            </div>

            <div className="flex flex-col gap-[27px]">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="box-border flex w-full gap-[27px] rounded-[36px] border-[1.13px] border-[rgba(199,197,212,0.3)] bg-white p-[27px]"
                  style={{ boxShadow: '0px 1.13px 2.25px 0px rgba(0, 0, 0, 0.05)' }}
                >
                  {/* Product Image */}
                  <div className="relative h-[180px] w-[180px] shrink-0 overflow-hidden rounded-[26px] bg-[#EEEEF0]">
                    <Image
                      src={item.image || '/images/executive_pro.png'}
                      alt={item.title}
                      fill
                      sizes="180px"
                      className="object-contain"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="box-border flex h-[180px] w-[498px] flex-col justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col">
                          {(item.badge || item.brand) && (
                            <p
                              className="mb-[4px] uppercase text-[#B51A13]"
                              style={{
                                fontFamily: 'Manrope, sans-serif',
                                fontSize: '15.75px',
                                lineHeight: '18.9px',
                                fontWeight: 700,
                                letterSpacing: '1.57px',
                              }}
                            >
                              {item.badge || item.brand}
                            </p>
                          )}
                          <h3
                            className="m-0 text-[#141776]"
                            style={{
                              fontFamily: 'Manrope, sans-serif',
                              fontSize: '27px',
                              lineHeight: '37.8px',
                              fontWeight: 700,
                            }}
                          >
                            {item.title}
                          </h3>
                        </div>
                        <div className="flex items-end gap-1">
                          <span
                            className="mb-[3px] text-[#141776]"
                            style={{
                              fontFamily: 'Manrope, sans-serif',
                              fontSize: '12px',
                              lineHeight: '37.8px',
                              fontWeight: 700,
                            }}
                          >
                            KSH.
                          </span>
                          <span
                            className="text-[#141776]"
                            style={{
                              fontFamily: 'Manrope, sans-serif',
                              fontSize: '27px',
                              lineHeight: '37.8px',
                              fontWeight: 700,
                            }}
                          >
                            {formatCurrency(Number(item.price))}
                          </span>
                        </div>
                      </div>
                      {item.variant && (
                        <p
                          className="mb-0 mt-[4px] text-[#464652]"
                          style={{
                            fontFamily: 'Manrope, sans-serif',
                            fontSize: '18px',
                            lineHeight: '27px',
                            fontWeight: 400,
                          }}
                        >
                          {item.variant}
                        </p>
                      )}
                    </div>

                    <div className="mt-auto flex w-full items-center justify-between">
                      {/* Quantity Control */}
                      <div className="box-border flex h-[47.25px] w-[137.25px] items-center justify-between rounded-[11248px] border-[1.13px] border-[rgba(199,197,212,0.2)] bg-[#F3F3F6] px-[9px] py-[4.5px]">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="flex h-[36px] w-[36px] items-center justify-center rounded-[11248px] bg-white/0 text-[#141776] transition-colors hover:bg-[#141776]/10"
                          aria-label={`Decrease quantity for ${item.title}`}
                        >
                          <svg
                            width="12"
                            height="2"
                            viewBox="0 0 12 2"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <rect width="11.8125" height="1.6875" fill="#141776" />
                          </svg>
                        </button>
                        <span
                          className="text-center text-[#141776]"
                          style={{
                            fontFamily: 'Manrope, sans-serif',
                            fontSize: '18px',
                            lineHeight: '27px',
                            fontWeight: 400,
                          }}
                        >
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="flex h-[36px] w-[36px] items-center justify-center rounded-[11248px] bg-white/0 text-[#141776] transition-colors hover:bg-[#141776]/10"
                          aria-label={`Increase quantity for ${item.title}`}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M6.84375 0.09375H5.15625V5.15625H0.09375V6.84375H5.15625V11.9062H6.84375V6.84375H11.9062V5.15625H6.84375V0.09375Z"
                              fill="#141776"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="flex items-center gap-[9px] text-[#464652] transition-colors hover:text-red-500"
                      >
                        <TrashIcon />
                        <span
                          style={{
                            fontFamily: 'Manrope, sans-serif',
                            fontSize: '18px',
                            lineHeight: '27px',
                            fontWeight: 400,
                          }}
                        >
                          Remove
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Promo Code Box */}
            <div className="mt-[27px] box-border flex w-full flex-col gap-[13.5px] rounded-[36px] border-[1.13px] border-dashed border-[#C7C5D4] bg-white px-[27px] pb-[27px] pt-[25.88px]">
              <span
                className="text-[#141776]"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '15.75px',
                  lineHeight: '18.9px',
                  fontWeight: 700,
                  letterSpacing: '0.79px',
                }}
              >
                HAVE A PROMO CODE?
              </span>
              <div className="flex gap-[18px]">
                {promoApplied ? (
                  <div className="box-border flex h-[56.5px] w-[539.19px] items-center justify-between rounded-[11248px] border border-green-200 bg-green-50 px-4">
                    <span className="text-[15px] font-bold text-green-700">
                      ✓ {promoApplied} applied
                    </span>
                    <button
                      onClick={() => {
                        setPromoApplied('');
                        setPromoDiscount(0);
                      }}
                      className="ml-2 text-[14px] font-medium text-gray-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="box-border flex h-[56.5px] w-[539.19px] shrink-0 items-center rounded-[11248px] border-[1.13px] border-[#C7C5D4] bg-[#F3F3F6] px-[27px]">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                        placeholder="Enter code"
                        className="w-full bg-transparent text-[#6B7280] outline-none"
                        style={{
                          fontFamily: 'Manrope, sans-serif',
                          fontSize: '18px',
                          lineHeight: '100%',
                          fontWeight: 400,
                        }}
                      />
                    </div>
                    <button
                      onClick={applyPromo}
                      disabled={promoLoading}
                      className="box-border flex h-[56.25px] w-[122.56px] shrink-0 items-center justify-center rounded-[11248px] bg-[#141776] text-white transition-colors hover:bg-[#2A3182] disabled:opacity-60"
                      style={{
                        fontFamily: 'Manrope, sans-serif',
                        fontSize: '18px',
                        lineHeight: '27px',
                        fontWeight: 400,
                      }}
                    >
                      {promoLoading ? '…' : 'APPLY'}
                    </button>
                  </>
                )}
                {promoError && (
                  <p className="mt-2 text-[12px] font-medium text-red-500">{promoError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="w-[450px] shrink-0">
            <div className="box-border flex flex-col gap-[36px] rounded-[36px] border-[1.13px] border-[rgba(199,197,212,0.3)] bg-white p-[36px]">
              <h2
                className="m-0 text-[#141776]"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '27px',
                  lineHeight: '37.8px',
                  fontWeight: 700,
                }}
              >
                Order Summary
              </h2>

              <div className="flex flex-col gap-[18px]">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[#464652]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '18px',
                      lineHeight: '27px',
                      fontWeight: 400,
                    }}
                  >
                    Subtotal
                  </span>
                  <span
                    className="text-[#141776]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '18px',
                      lineHeight: '27px',
                      fontWeight: 400,
                    }}
                  >
                    KSH. {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-[#464652]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '18px',
                      lineHeight: '27px',
                      fontWeight: 400,
                    }}
                  >
                    Shipping
                  </span>
                  <span
                    className="text-[#464652]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '18px',
                      lineHeight: '27px',
                      fontWeight: 400,
                    }}
                  >
                    FREE
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-[#464652]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '18px',
                      lineHeight: '27px',
                      fontWeight: 400,
                    }}
                  >
                    Estimated Tax
                  </span>
                  <span
                    className="text-[#141776]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '18px',
                      lineHeight: '27px',
                      fontWeight: 400,
                    }}
                  >
                    KSH. {formatCurrency(estimatedTax)}
                  </span>
                </div>
                {promoDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <span
                      className="font-medium text-green-600"
                      style={{
                        fontFamily: 'Manrope, sans-serif',
                        fontSize: '18px',
                        lineHeight: '27px',
                        fontWeight: 400,
                      }}
                    >
                      Promo ({promoApplied})
                    </span>
                    <span
                      className="font-medium text-green-600"
                      style={{
                        fontFamily: 'Manrope, sans-serif',
                        fontSize: '18px',
                        lineHeight: '27px',
                        fontWeight: 400,
                      }}
                    >
                      - KSH. {formatCurrency(promoDiscount)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span
                  className="text-[#141776]"
                  style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: '27px',
                    lineHeight: '37.8px',
                    fontWeight: 700,
                  }}
                >
                  Total
                </span>
                <div className="flex items-end gap-1">
                  <span
                    className="mb-[4px] text-[#141776]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '18px',
                      lineHeight: '37.8px',
                      fontWeight: 700,
                    }}
                  >
                    KSH.
                  </span>
                  <span
                    className="text-[#141776]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '27px',
                      lineHeight: '37.8px',
                      fontWeight: 700,
                    }}
                  >
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="box-border flex h-[76px] w-full items-center justify-center gap-[13.5px] rounded-[11248px] bg-[#B51A13] text-white transition-colors hover:bg-red-800"
              >
                <span
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: '20.25px',
                    lineHeight: '30.38px',
                    fontWeight: 700,
                  }}
                >
                  Proceed to Checkout
                </span>
                <svg
                  className="h-[18px] w-[18px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>

              <div className="flex flex-col gap-[18px]">
                <div className="flex items-center gap-[13.5px]">
                  <div className="text-[#141776]">
                    <ShieldCheckIcon />
                  </div>
                  <span
                    className="text-[#464652]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '13.5px',
                      lineHeight: '16.2px',
                      fontWeight: 500,
                    }}
                  >
                    Secure Checkout Powered by OptiPay
                  </span>
                </div>
                <div className="flex items-center gap-[13.5px]">
                  <div className="text-[#141776]">
                    <svg
                      className="h-5 w-6 text-[#141776] lg:h-[18px] lg:w-[25px]"
                      viewBox="0 0 25 18"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M5 16C4.16667 16 3.45833 15.7083 2.875 15.125C2.29167 14.5417 2 13.8333 2 13H0V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H16V4H19L22 8V13H20C20 13.8333 19.7083 14.5417 19.125 15.125C18.5417 15.7083 17.8333 16 17 16C16.1667 16 15.4583 15.7083 14.875 15.125C14.2917 14.5417 14 13.8333 14 13H8C8 13.8333 7.70833 14.5417 7.125 15.125C6.54167 15.7083 5.83333 16 5 16ZM5 14C5.28333 14 5.52083 13.9042 5.7125 13.7125C5.90417 13.5208 6 13.2833 6 13C6 12.7167 5.90417 12.4792 5.7125 12.2875C5.52083 12.0958 5.28333 12 5 12C4.71667 12 4.47917 12.0958 4.2875 12.2875C4.09583 12.4792 4 12.7167 4 13C4 13.2833 4.09583 13.5208 4.2875 13.7125C4.47917 13.9042 4.71667 14 5 14ZM2 11H2.8C3.08333 10.7 3.40833 10.4583 3.775 10.275C4.14167 10.0917 4.55 10 5 10C5.45 10 5.85833 10.0917 6.225 10.275C6.59167 10.4583 6.91667 10.7 7.2 11H14V2H2V11ZM17 14C17.2833 14 17.5208 13.9042 17.7125 13.7125C17.9042 13.5208 18 13.2833 18 13C18 12.7167 17.9042 12.4792 17.7125 12.2875C17.5208 12.0958 17.2833 12 17 12C16.7167 12 16.4792 12.0958 16.2875 12.2875C16.0958 12.4792 16 12.7167 16 13C16 13.2833 16.0958 13.5208 16.2875 13.7125C16.4792 13.9042 16.7167 14 17 14ZM16 9H20.25L18 6H16V9Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <span
                    className="text-[#464652]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '13.5px',
                      lineHeight: '16.2px',
                      fontWeight: 500,
                    }}
                  >
                    Free standard delivery on all orders
                  </span>
                </div>
                <div className="flex items-center gap-[13.5px]">
                  <div className="text-[#141776]">
                    <ArrowRotateIcon />
                  </div>
                  <span
                    className="text-[#464652]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '13.5px',
                      lineHeight: '16.2px',
                      fontWeight: 500,
                    }}
                  >
                    30-day hassle-free return policy
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Page() {
  return <Cart />;
}
