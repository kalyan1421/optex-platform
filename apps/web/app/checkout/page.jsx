'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatKes, formatKesNumber } from '@optex/ui';

// Flat delivery fee mirrors the server (`place_order` RPC: 300 KES for delivery,
// 0 for branch pickup). Kept in sync so the displayed total equals what the API
// charges. NOTE: confirm with Optex whether standard delivery should be free.
const DELIVERY_FEE_KES = 300;

const CaretUpIcon = () => (
  <svg
    className="h-5 w-5 text-gray-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const CaretDownIcon = () => (
  <svg
    className="h-5 w-5 text-gray-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const TruckIcon = () => (
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
);

const DeliveryIcon = () => (
  <svg
    className="h-5 w-6 text-[#141776] lg:h-[18px] lg:w-[23px]"
    viewBox="0 0 23 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8.45 11.5C8.85 11.9 9.36667 12.0958 10 12.0875C10.6333 12.0792 11.1 11.85 11.4 11.4L17 3L8.6 8.6C8.15 8.9 7.9125 9.35833 7.8875 9.975C7.8625 10.5917 8.05 11.1 8.45 11.5ZM10 0C10.9833 0 11.9292 0.1375 12.8375 0.4125C13.7458 0.6875 14.6 1.1 15.4 1.65L13.5 2.85C12.95 2.56667 12.3792 2.35417 11.7875 2.2125C11.1958 2.07083 10.6 2 10 2C7.78333 2 5.89583 2.77917 4.3375 4.3375C2.77917 5.89583 2 7.78333 2 10C2 10.7 2.09583 11.3917 2.2875 12.075C2.47917 12.7583 2.75 13.4 3.1 14H16.9C17.2833 13.3667 17.5625 12.7083 17.7375 12.025C17.9125 11.3417 18 10.6333 18 9.9C18 9.3 17.9292 8.71667 17.7875 8.15C17.6458 7.58333 17.4333 7.03333 17.15 6.5L18.35 4.6C18.85 5.38333 19.2458 6.21667 19.5375 7.1C19.8292 7.98333 19.9833 8.9 20 9.85C20.0167 10.8 19.9083 11.7083 19.675 12.575C19.4417 13.4417 19.1 14.2667 18.65 15.05C18.4667 15.35 18.2167 15.5833 17.9 15.75C17.5833 15.9167 17.25 16 16.9 16H3.1C2.75 16 2.41667 15.9167 2.1 15.75C1.78333 15.5833 1.53333 15.35 1.35 15.05C0.916667 14.3 0.583333 13.5042 0.35 12.6625C0.116667 11.8208 0 10.9333 0 10C0 8.61667 0.2625 7.32083 0.7875 6.1125C1.3125 4.90417 2.02917 3.84583 2.9375 2.9375C3.84583 2.02917 4.90833 1.3125 6.125 0.7875C7.34167 0.2625 8.63333 0 10 0Z"
      fill="currentColor"
    />
  </svg>
);

const PaymentIcon = () => (
  <svg
    className="h-4 w-6 text-[#141776] lg:h-[16px] lg:w-[22px]"
    viewBox="0 0 22 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13 9C12.1667 9 11.4583 8.70833 10.875 8.125C10.2917 7.54167 10 6.83333 10 6C10 5.16667 10.2917 4.45833 10.875 3.875C11.4583 3.29167 12.1667 3 13 3C13.8333 3 14.5417 3.29167 15.125 3.875C15.7083 4.45833 16 5.16667 16 6C16 6.83333 15.7083 7.54167 15.125 8.125C14.5417 8.70833 13.8333 9 13 9ZM6 12C5.45 12 4.97917 11.8042 4.5875 11.4125C4.19583 11.0208 4 10.55 4 10V2C4 1.45 4.19583 0.979167 4.5875 0.5875C4.97917 0.195833 5.45 0 6 0H20C20.55 0 21.0208 0.195833 21.4125 0.5875C21.8042 0.979167 22 1.45 22 2V10C22 10.55 21.8042 11.0208 21.4125 11.4125C21.0208 11.8042 20.55 12 20 12H6ZM8 10H18C18 9.45 18.1958 8.97917 18.5875 8.5875C18.9792 8.19583 19.45 8 20 8V4C19.45 4 18.9792 3.80417 18.5875 3.4125C18.1958 3.02083 18 2.55 18 2H8C8 2.55 7.80417 3.02083 7.4125 3.4125C7.02083 3.80417 6.55 4 6 4V8C6.55 8 7.02083 8.19583 7.4125 8.5875C7.80417 8.97917 8 9.45 8 10ZM19 16H2C1.45 16 0.979167 15.8042 0.5875 15.4125C0.195833 15.0208 0 14.55 0 14V3H2V14H19V16ZM6 10V2V10Z"
      fill="currentColor"
    />
  </svg>
);

const PAYMENT_METHODS = [
  {
    id: 'mpesa',
    label: 'M-Pesa',
    description: 'Pay via Safaricom M-Pesa STK Push',
    value: 'mpesa',
  },
  {
    id: 'pesapal',
    label: 'Pesapal',
    description: 'Pay via Pesapal (card, bank, mobile)',
    value: 'pesapal',
  },
  // Cash on delivery was withdrawn by the client (CLIENT-ANSWERS E6) and is now
  // rejected by the API, so offering it here would only produce a 400 at the
  // end of a filled-in checkout form.
];

const KENYA_COUNTIES = [
  'Nairobi',
  'Mombasa',
  'Kisumu',
  'Nakuru',
  'Eldoret',
  'Kiambu',
  'Machakos',
  'Kajiado',
  'Muranga',
  'Nyeri',
  'Meru',
  'Embu',
  'Kirinyaga',
  'Nyandarua',
  'Laikipia',
  'Samburu',
  'Trans Nzoia',
  'Uasin Gishu',
  'Elgeyo-Marakwet',
  'Nandi',
  'Baringo',
  'West Pokot',
  'Turkana',
  'Marsabit',
  'Isiolo',
  'Tharaka-Nithi',
  'Kitui',
  'Makueni',
  'Narok',
  'Kericho',
  'Bomet',
  'Kakamega',
  'Vihiga',
  'Bungoma',
  'Busia',
  'Siaya',
  'Homa Bay',
  'Migori',
  'Kisii',
  'Nyamira',
  'Kilifi',
  'Kwale',
  'Taita-Taveta',
  'Tana River',
  'Lamu',
  'Garissa',
  'Wajir',
  'Mandera',
];

export default function Page() {
  const router = useRouter();
  const { items } = useCart();
  const { user, loading: authLoading } = useAuth();

  const [activeStep, setActiveStep] = useState(1);
  const [shipping, setShipping] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    county: '',
    postal: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Saved addresses. `selectedAddressId === null` means "typing a new one" —
  // the only state that matters for whether the free-text form or a saved
  // card is driving `shipping`. Starts empty/null so a customer with no
  // saved addresses sees exactly today's plain form, unchanged.
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [saveAddress, setSaveAddress] = useState(false);

  // H-3 FIX: guard on authLoading so we don't redirect while the session is
  // still being resolved (user starts as undefined, not null, during load).
  useEffect(() => {
    if (!authLoading && user === null) router.push('/login?redirect=/checkout');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.addresses
      .listMine()
      .then((list) => {
        if (cancelled) return;
        setSavedAddresses(list);
        const preferred = list.find((a) => a.is_default) ?? list[0];
        if (preferred) {
          selectSavedAddress(preferred);
        } else {
          // No saved addresses yet — offer to save the one they're about to
          // type, since there's nothing to pick from instead.
          setSaveAddress(true);
        }
      })
      .catch((err) => console.error('Failed to load saved addresses:', err));
    return () => {
      cancelled = true;
    };
    // Deliberately keyed on `user` alone — `selectSavedAddress` is re-created
    // every render but only ever called with the freshly-fetched list here.
  }, [user]);

  /** Populates the shipping form from a saved address and marks it selected. */
  function selectSavedAddress(addr) {
    setSelectedAddressId(addr.id);
    const [firstName, ...rest] = addr.name.split(' ');
    setShipping({
      firstName: firstName ?? '',
      lastName: rest.join(' '),
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      county: addr.county,
      postal: addr.postal ?? '',
    });
  }

  /** Switches to a blank free-text form, e.g. for a first-time delivery address. */
  function startNewAddress() {
    setSelectedAddressId(null);
    setShipping({
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      city: '',
      county: '',
      postal: '',
    });
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const shippingKes = DELIVERY_FEE_KES;
  const vat = +(subtotal * 0.16).toFixed(2);
  const total = +(subtotal + vat + shippingKes).toFixed(2);

  async function handlePlaceOrder() {
    if (!user) {
      router.push('/login');
      return;
    }
    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (
      !shipping.firstName ||
      !shipping.lastName ||
      !shipping.phone ||
      !shipping.address ||
      !shipping.city ||
      !shipping.county
    ) {
      setError('Please complete the shipping address fields.');
      setActiveStep(1);
      return;
    }

    setLoading(true);
    setError('');
    try {
      // 1. Create the order through the API. The server reads the customer's
      //    cart from the DB, recomputes every amount, and (for COD) queues it
      //    immediately. No prices/totals are trusted from the client.
      const { order, payment } = await api.orders.checkout({
        paymentMethod,
        deliveryOption: 'delivery',
        shippingAddress: {
          name: `${shipping.firstName} ${shipping.lastName}`.trim(),
          phone: shipping.phone,
          address: shipping.address,
          city: shipping.city,
          county: shipping.county,
          postal: shipping.postal || undefined,
        },
      });

      // 1b. Save the address for next time, if asked — after order creation
      // succeeds, never before: a failed save here must not block a checkout
      // that otherwise went through, and there's nothing to save until the
      // form has actually been validated above.
      if (selectedAddressId === null && saveAddress) {
        try {
          await api.addresses.create({
            name: `${shipping.firstName} ${shipping.lastName}`.trim(),
            phone: shipping.phone,
            address: shipping.address,
            city: shipping.city,
            county: shipping.county,
            postal: shipping.postal || undefined,
            // The customer's first saved address becomes their default —
            // nothing to prefer it over yet.
            isDefault: savedAddresses.length === 0,
          });
        } catch (err) {
          console.error('Could not save address for next time:', err);
        }
      }

      // 2. Route by payment method. Every remaining method requires payment
      // before fulfilment — the COD branch that skipped straight to the
      // confirmation page went with the method itself (E6).
      if (paymentMethod === 'mpesa') {
        // Trigger the STK push to the customer's phone, then poll briefly for the
        // result. Final confirmation also arrives via the Daraja webhook + cron.
        const push = await api.payments.mpesaStkPush({
          orderId: order.id,
          phone: shipping.phone,
        });
        setError('');
        const paid = await pollMpesa(push.checkoutRequestId);
        if (!paid) {
          // Not confirmed yet — still send them to confirmation; the webhook/cron
          // will reconcile and the page reflects live payment status.
          console.warn('M-Pesa not confirmed within polling window; reconciling async.');
        }
        router.push(`/order-confirmation/${order.id}`);
        return;
      }

      if (paymentMethod === 'pesapal') {
        // Redirect the customer to Pesapal's hosted payment page.
        const init = await api.payments.pesapalInitiate({ orderId: order.id });
        if (init.redirectUrl) {
          window.location.href = init.redirectUrl;
          return;
        }
        router.push(`/order-confirmation/${order.id}`);
        return;
      }

      // Fallback (shouldn't happen): rely on the payment instruction.
      router.push(`/order-confirmation/${order.id}`);
    } catch (err) {
      console.error('checkout error:', err);
      setError(err?.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Poll the M-Pesa STK status a few times (~18s). Returns true once paid.
   * The webhook + cron reconcile independently, so this is best-effort UX.
   */
  async function pollMpesa(checkoutRequestId) {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const status = await api.payments.mpesaQuery({ checkoutRequestId });
        if (status.paid) return true;
        if (status.status === 'failed') {
          setError('M-Pesa payment failed or was cancelled. You can retry from your order.');
          return false;
        }
      } catch {
        // transient — keep polling
      }
    }
    return false;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-10 pt-32 lg:bg-white lg:pb-[50px] lg:pt-[50px]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col px-6 lg:px-[100px]">
        {/* F-16: role="alert" so the failure is ANNOUNCED, not just shown.
            Checkout is where this mattered most — a silent refusal here reads
            as a broken button. */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[14px] font-medium text-red-600"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-[32px]">
          {/* Left Column (Header + Steps) */}
          <div className="flex flex-col lg:w-[747px]">
            {/* Section Header */}
            <div className="mb-[36px] flex flex-col gap-[9px]">
              <h2
                className="text-[#141776]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 700,
                  fontSize: '32px',
                  lineHeight: '27px',
                }}
              >
                Checkout
              </h2>
              <p
                className="text-[#464652]"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '18px',
                  fontWeight: 400,
                  lineHeight: '27px',
                }}
              >
                Please complete each step to finalize your order.
              </p>
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-[18px]">
              {/* Step 1 — Shipping Address */}
              <div
                className={`overflow-hidden bg-white transition-all`}
                style={{
                  borderRadius: '36px',
                  border: '1.13px solid #F1F5F9',
                  boxShadow:
                    activeStep === 1 ? '0px 11.25px 33.75px 0px rgba(45, 50, 140, 0.05)' : 'none',
                }}
              >
                <div
                  className="flex cursor-pointer items-center justify-between p-[20px] lg:p-[27px]"
                  onClick={() => setActiveStep(1)}
                >
                  <div className="flex items-center gap-[18px]">
                    <div
                      className={`flex h-[36px] w-[36px] items-center justify-center rounded-full text-[18px]`}
                      style={{
                        fontFamily: 'Manrope, sans-serif',
                        backgroundColor: activeStep === 1 ? '#141776' : 'transparent',
                        color: activeStep === 1 ? '#FFFFFF' : '#767683',
                        border: activeStep === 1 ? 'none' : '2.25px solid #C7C5D4',
                      }}
                    >
                      1
                    </div>
                    <div className="flex items-center gap-[9px]">
                      <TruckIcon />
                      <h3
                        className={`${activeStep === 1 ? 'text-[#141776]' : 'text-[#141776]'}`}
                        style={{
                          fontFamily: 'Manrope, sans-serif',
                          fontSize: '18px',
                          fontWeight: 400,
                          lineHeight: '27px',
                        }}
                      >
                        Shipping Address
                      </h3>
                    </div>
                  </div>
                  {activeStep === 1 ? <CaretUpIcon /> : <CaretDownIcon />}
                </div>

                {activeStep === 1 && (
                  <div className="px-5 pb-6 lg:px-[36px] lg:pb-[36px]">
                    <div className="border-t border-[#F8FAFC] pt-[27px]">
                      <div className="flex flex-col gap-[27px]">
                        {savedAddresses.length > 0 && (
                          <div className="flex flex-col gap-[12px]">
                            {savedAddresses.map((addr) => (
                              <label
                                key={addr.id}
                                className={`flex cursor-pointer items-start gap-4 rounded-[18px] border p-[18px] transition-colors ${
                                  selectedAddressId === addr.id
                                    ? 'border-[#141776] bg-white'
                                    : 'border-[#C7C5D4] bg-[#F3F3F6] hover:border-[#141776]'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="savedAddress"
                                  checked={selectedAddressId === addr.id}
                                  onChange={() => selectSavedAddress(addr)}
                                  className="mt-1 accent-[#141776]"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    {addr.label && (
                                      <span
                                        className="text-[13px] font-semibold text-[#141776]"
                                        style={{ fontFamily: 'Manrope, sans-serif' }}
                                      >
                                        {addr.label}
                                      </span>
                                    )}
                                    {addr.is_default && (
                                      <span
                                        className="rounded-full bg-[#E8E7F5] px-2 py-0.5 text-[11px] font-medium text-[#141776]"
                                        style={{ fontFamily: 'Manrope, sans-serif' }}
                                      >
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <p
                                    className="mt-1 text-[15px] text-[#141776]"
                                    style={{ fontFamily: 'Manrope, sans-serif' }}
                                  >
                                    {addr.name} &middot; {addr.phone}
                                  </p>
                                  <p
                                    className="text-[14px] text-[#6B7280]"
                                    style={{ fontFamily: 'Manrope, sans-serif' }}
                                  >
                                    {addr.address}, {addr.city}, {addr.county}
                                  </p>
                                </div>
                              </label>
                            ))}
                            <button
                              type="button"
                              onClick={startNewAddress}
                              className={`flex items-center rounded-[18px] border border-dashed p-[18px] text-left transition-colors ${
                                selectedAddressId === null
                                  ? 'border-[#141776] bg-white'
                                  : 'border-[#C7C5D4] hover:border-[#141776]'
                              }`}
                            >
                              <span
                                className="text-[16px] text-[#141776]"
                                style={{ fontFamily: 'Manrope, sans-serif' }}
                              >
                                + Add a new address
                              </span>
                            </button>
                          </div>
                        )}

                        {selectedAddressId === null && (
                          <>
                            {/* Name Row */}
                            <div className="grid grid-cols-1 gap-[27px] sm:grid-cols-2">
                              <div className="flex flex-col gap-[9px]">
                                <label
                                  className="text-[18px] text-[#141776]"
                                  style={{ fontFamily: 'Manrope, sans-serif', lineHeight: '27px' }}
                                >
                                  First Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="Jane"
                                  value={shipping.firstName}
                                  onChange={(e) =>
                                    setShipping((s) => ({ ...s, firstName: e.target.value }))
                                  }
                                  className="h-[56.5px] w-full rounded-[18px] border border-[#C7C5D4] bg-[#F3F3F6] px-[18px] text-[18px] text-[#6B7280] outline-none transition-colors placeholder:text-[#6B7280] focus:border-[#141776] focus:bg-white"
                                  style={{ fontFamily: 'Manrope, sans-serif' }}
                                />
                              </div>
                              <div className="flex flex-col gap-[9px]">
                                <label
                                  className="text-[18px] text-[#141776]"
                                  style={{ fontFamily: 'Manrope, sans-serif', lineHeight: '27px' }}
                                >
                                  Last Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="Doe"
                                  value={shipping.lastName}
                                  onChange={(e) =>
                                    setShipping((s) => ({ ...s, lastName: e.target.value }))
                                  }
                                  className="h-[56.5px] w-full rounded-[18px] border border-[#C7C5D4] bg-[#F3F3F6] px-[18px] text-[18px] text-[#6B7280] outline-none transition-colors placeholder:text-[#6B7280] focus:border-[#141776] focus:bg-white"
                                  style={{ fontFamily: 'Manrope, sans-serif' }}
                                />
                              </div>
                            </div>

                            {/* Address Row */}
                            <div className="flex flex-col gap-[9px]">
                              <label
                                className="text-[18px] text-[#141776]"
                                style={{ fontFamily: 'Manrope, sans-serif', lineHeight: '27px' }}
                              >
                                Address Line 1
                              </label>
                              <input
                                type="text"
                                placeholder="123 Vision Avenue"
                                value={shipping.address}
                                onChange={(e) =>
                                  setShipping((s) => ({ ...s, address: e.target.value }))
                                }
                                className="h-[56.5px] w-full rounded-[18px] border border-[#C7C5D4] bg-[#F3F3F6] px-[18px] text-[18px] text-[#6B7280] outline-none transition-colors placeholder:text-[#6B7280] focus:border-[#141776] focus:bg-white"
                                style={{ fontFamily: 'Manrope, sans-serif' }}
                              />
                            </div>

                            {/* City/Postcode Row */}
                            <div className="grid grid-cols-1 gap-[27px] sm:grid-cols-2">
                              <div className="flex flex-col gap-[9px]">
                                <label
                                  className="text-[18px] text-[#141776]"
                                  style={{ fontFamily: 'Manrope, sans-serif', lineHeight: '27px' }}
                                >
                                  City
                                </label>
                                <input
                                  type="text"
                                  placeholder="London"
                                  value={shipping.city}
                                  onChange={(e) =>
                                    setShipping((s) => ({ ...s, city: e.target.value }))
                                  }
                                  className="h-[56.5px] w-full rounded-[18px] border border-[#C7C5D4] bg-[#F3F3F6] px-[18px] text-[18px] text-[#6B7280] outline-none transition-colors placeholder:text-[#6B7280] focus:border-[#141776] focus:bg-white"
                                  style={{ fontFamily: 'Manrope, sans-serif' }}
                                />
                              </div>
                              <div className="flex flex-col gap-[9px]">
                                <label
                                  className="text-[18px] text-[#141776]"
                                  style={{ fontFamily: 'Manrope, sans-serif', lineHeight: '27px' }}
                                >
                                  Postcode
                                </label>
                                <input
                                  type="text"
                                  placeholder="EC1V 2NX"
                                  value={shipping.postal}
                                  onChange={(e) =>
                                    setShipping((s) => ({ ...s, postal: e.target.value }))
                                  }
                                  className="h-[56.5px] w-full rounded-[18px] border border-[#C7C5D4] bg-[#F3F3F6] px-[18px] text-[18px] text-[#6B7280] outline-none transition-colors placeholder:text-[#6B7280] focus:border-[#141776] focus:bg-white"
                                  style={{ fontFamily: 'Manrope, sans-serif' }}
                                />
                              </div>
                            </div>

                            {/* Phone/County Row */}
                            <div className="grid grid-cols-1 gap-[27px] sm:grid-cols-2">
                              <div className="flex flex-col gap-[9px]">
                                <label
                                  className="text-[18px] text-[#141776]"
                                  style={{ fontFamily: 'Manrope, sans-serif', lineHeight: '27px' }}
                                >
                                  Phone Number
                                </label>
                                <input
                                  type="tel"
                                  placeholder="0712 345 678"
                                  value={shipping.phone}
                                  onChange={(e) =>
                                    setShipping((s) => ({ ...s, phone: e.target.value }))
                                  }
                                  className="h-[56.5px] w-full rounded-[18px] border border-[#C7C5D4] bg-[#F3F3F6] px-[18px] text-[18px] text-[#6B7280] outline-none transition-colors placeholder:text-[#6B7280] focus:border-[#141776] focus:bg-white"
                                  style={{ fontFamily: 'Manrope, sans-serif' }}
                                />
                              </div>
                              <div className="flex flex-col gap-[9px]">
                                <label
                                  className="text-[18px] text-[#141776]"
                                  style={{ fontFamily: 'Manrope, sans-serif', lineHeight: '27px' }}
                                >
                                  County
                                </label>
                                <select
                                  value={shipping.county}
                                  onChange={(e) =>
                                    setShipping((s) => ({ ...s, county: e.target.value }))
                                  }
                                  className="h-[56.5px] w-full rounded-[18px] border border-[#C7C5D4] bg-[#F3F3F6] px-[18px] text-[18px] text-[#6B7280] outline-none transition-colors focus:border-[#141776] focus:bg-white"
                                  style={{ fontFamily: 'Manrope, sans-serif' }}
                                >
                                  <option value="">Select county</option>
                                  {KENYA_COUNTIES.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <label
                              className="flex items-center gap-[9px] text-[15px] text-[#141776]"
                              style={{ fontFamily: 'Manrope, sans-serif' }}
                            >
                              <input
                                type="checkbox"
                                checked={saveAddress}
                                onChange={(e) => setSaveAddress(e.target.checked)}
                                className="h-[18px] w-[18px] accent-[#141776]"
                              />
                              Save this address for next time
                            </label>
                          </>
                        )}

                        {/* Button */}
                        <div className="pt-[9px]">
                          <button
                            onClick={() => setActiveStep(2)}
                            className="h-[54px] rounded-full bg-[#141776] px-[36px] text-[18px] text-white transition-colors hover:bg-black"
                            style={{ fontFamily: 'Manrope, sans-serif', lineHeight: '27px' }}
                          >
                            Continue to Delivery
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2 — Delivery Method */}
              <div
                className={`overflow-hidden bg-white transition-all`}
                style={{
                  borderRadius: '36px',
                  border: '1.13px solid #F1F5F9',
                  boxShadow:
                    activeStep === 2 ? '0px 11.25px 33.75px 0px rgba(45, 50, 140, 0.05)' : 'none',
                }}
              >
                <div
                  className="flex cursor-pointer items-center justify-between p-[20px] lg:p-[27px]"
                  onClick={() => setActiveStep(2)}
                >
                  <div className="flex items-center gap-[18px]">
                    <div
                      className={`flex h-[36px] w-[36px] items-center justify-center rounded-full text-[18px]`}
                      style={{
                        fontFamily: 'Manrope, sans-serif',
                        backgroundColor: activeStep === 2 ? '#141776' : 'transparent',
                        color: activeStep === 2 ? '#FFFFFF' : '#767683',
                        border: activeStep === 2 ? 'none' : '2.25px solid #C7C5D4',
                      }}
                    >
                      2
                    </div>
                    <div className="flex items-center gap-[9px]">
                      <DeliveryIcon />
                      <h3
                        className={`text-[#141776]`}
                        style={{
                          fontFamily: 'Manrope, sans-serif',
                          fontSize: '18px',
                          fontWeight: 400,
                          lineHeight: '27px',
                        }}
                      >
                        Delivery Method
                      </h3>
                    </div>
                  </div>
                  {activeStep === 2 ? <CaretUpIcon /> : <CaretDownIcon />}
                </div>

                {activeStep === 2 && (
                  <div className="px-5 pb-6 lg:px-[36px] lg:pb-[36px]">
                    <div className="border-t border-[#F8FAFC] pt-[27px]">
                      <div className="flex flex-col gap-[27px]">
                        <label className="flex cursor-pointer items-start gap-4 rounded-[18px] border border-[#C7C5D4] bg-[#F3F3F6] p-[18px] transition-colors focus-within:border-[#141776] focus-within:bg-white">
                          <input
                            type="radio"
                            name="delivery"
                            defaultChecked
                            className="mt-1 accent-[#141776]"
                            readOnly
                          />
                          <div>
                            <p
                              className="text-[18px] text-[#141776]"
                              style={{ fontFamily: 'Manrope, sans-serif' }}
                            >
                              Standard Delivery — KSH. {formatKesNumber(DELIVERY_FEE_KES)}
                            </p>
                            <p
                              className="mt-0.5 text-[14px] text-[#6B7280]"
                              style={{ fontFamily: 'Manrope, sans-serif' }}
                            >
                              2–5 business days within Nairobi; 3–7 days upcountry
                            </p>
                          </div>
                        </label>
                        <div className="pt-[9px]">
                          <button
                            onClick={() => setActiveStep(3)}
                            className="h-[54px] rounded-full bg-[#141776] px-[36px] text-[18px] text-white transition-colors hover:bg-black"
                            style={{ fontFamily: 'Manrope, sans-serif', lineHeight: '27px' }}
                          >
                            Continue to Payment
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3 — Payment */}
              <div
                className={`overflow-hidden bg-white transition-all`}
                style={{
                  borderRadius: '36px',
                  border: '1.13px solid #F1F5F9',
                  boxShadow:
                    activeStep === 3 ? '0px 11.25px 33.75px 0px rgba(45, 50, 140, 0.05)' : 'none',
                }}
              >
                <div
                  className="flex cursor-pointer items-center justify-between p-[20px] lg:p-[27px]"
                  onClick={() => setActiveStep(3)}
                >
                  <div className="flex items-center gap-[18px]">
                    <div
                      className={`flex h-[36px] w-[36px] items-center justify-center rounded-full text-[18px]`}
                      style={{
                        fontFamily: 'Manrope, sans-serif',
                        backgroundColor: activeStep === 3 ? '#141776' : 'transparent',
                        color: activeStep === 3 ? '#FFFFFF' : '#767683',
                        border: activeStep === 3 ? 'none' : '2.25px solid #C7C5D4',
                      }}
                    >
                      3
                    </div>
                    <div className="flex items-center gap-[9px]">
                      <PaymentIcon />
                      <h3
                        className={`text-[#141776]`}
                        style={{
                          fontFamily: 'Manrope, sans-serif',
                          fontSize: '18px',
                          fontWeight: 400,
                          lineHeight: '27px',
                        }}
                      >
                        Payment Information
                      </h3>
                    </div>
                  </div>
                  {activeStep === 3 ? <CaretUpIcon /> : <CaretDownIcon />}
                </div>

                {activeStep === 3 && (
                  <div className="px-5 pb-6 lg:px-[36px] lg:pb-[36px]">
                    <div className="border-t border-[#F8FAFC] pt-[27px]">
                      <div className="flex flex-col gap-[18px]">
                        {PAYMENT_METHODS.map((pm) => (
                          <label
                            key={pm.id}
                            className={`flex cursor-pointer items-start gap-4 rounded-[18px] border p-[18px] transition-colors ${paymentMethod === pm.value ? 'border-[#141776] bg-white' : 'border-[#C7C5D4] bg-[#F3F3F6] hover:border-[#141776]'}`}
                          >
                            <input
                              type="radio"
                              name="payment"
                              value={pm.value}
                              checked={paymentMethod === pm.value}
                              onChange={() => setPaymentMethod(pm.value)}
                              className="mt-1 accent-[#141776]"
                            />
                            <div>
                              <p
                                className="text-[18px] text-[#141776]"
                                style={{ fontFamily: 'Manrope, sans-serif' }}
                              >
                                {pm.label}
                              </p>
                              <p
                                className="mt-0.5 text-[14px] text-[#6B7280]"
                                style={{ fontFamily: 'Manrope, sans-serif' }}
                              >
                                {pm.description}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="w-full flex-shrink-0 lg:w-[461px] lg:flex-1">
            <div
              className="sticky top-28 flex flex-col bg-white p-6 sm:p-8 lg:p-[36px]"
              style={{
                borderRadius: '36px',
                border: '1.13px solid #F8FAFC',
                boxShadow: '0px 11.25px 33.75px 0px rgba(45, 50, 140, 0.05)',
                gap: '35.1px',
              }}
            >
              <h2
                className="text-[#141776]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 700,
                  fontSize: '32px',
                  lineHeight: '27px',
                  paddingBottom: '18px',
                  borderBottom: '1.13px solid #F1F5F9',
                }}
              >
                Order Summary
              </h2>

              <div className="flex flex-col gap-[27px]">
                {items.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-gray-400">Your cart is empty.</p>
                ) : (
                  items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="flex items-start gap-[18px]">
                      <div className="relative h-[90px] w-[90px] flex-shrink-0 rounded-[18px] border-[0.8px] border-[#D4D4D4] bg-[#F5F5F5] p-[0.8px]">
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          sizes="90px"
                          className="rounded-[18px] object-cover mix-blend-multiply"
                        />
                        <span
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-[26843500px] bg-[#E53935] text-[12px] font-bold text-white shadow-sm"
                          style={{ fontFamily: 'Poppins, sans-serif' }}
                        >
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col py-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex flex-col">
                            {item.brand && (
                              <p
                                className="uppercase text-[#E53935]"
                                style={{
                                  fontFamily: 'Arimo, sans-serif',
                                  fontWeight: 400,
                                  fontSize: '11px',
                                  letterSpacing: '1px',
                                }}
                              >
                                {item.brand}
                              </p>
                            )}
                            <h4
                              className="mt-1 line-clamp-2 text-[#000000]"
                              style={{
                                fontFamily: 'Poppins, sans-serif',
                                fontWeight: 600,
                                fontSize: '16px',
                                lineHeight: '22px',
                              }}
                            >
                              {item.title}
                            </h4>
                            {item.variant && (
                              <p
                                className="mt-1.5 text-[#717182]"
                                style={{
                                  fontFamily: 'Inter, sans-serif',
                                  fontWeight: 400,
                                  fontSize: '12px',
                                }}
                              >
                                {item.variant}
                              </p>
                            )}
                          </div>
                          <p
                            className="whitespace-nowrap text-[#2E3192]"
                            style={{
                              fontFamily: 'Poppins, sans-serif',
                              fontWeight: 700,
                              fontSize: '16px',
                            }}
                          >
                            KSH. {formatKesNumber(Number(item.price) * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-[18px] border-t border-[#F1F5F9] pt-[27px]">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[#464652]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 400,
                      fontSize: '18px',
                      lineHeight: '27px',
                    }}
                  >
                    Subtotal
                  </span>
                  <span
                    className="text-[#141776]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 400,
                      fontSize: '18px',
                      lineHeight: '27px',
                    }}
                  >
                    KSH. {formatKesNumber(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-[#464652]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 400,
                      fontSize: '18px',
                      lineHeight: '27px',
                    }}
                  >
                    Shipping
                  </span>
                  <span
                    className="text-[#141776]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 400,
                      fontSize: '18px',
                      lineHeight: '27px',
                    }}
                  >
                    {shippingKes === 0 ? 'FREE' : `KSH. ${formatKesNumber(shippingKes)}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-[#464652]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 400,
                      fontSize: '18px',
                      lineHeight: '27px',
                    }}
                  >
                    Estimated Tax
                  </span>
                  <span
                    className="text-[#141776]"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 400,
                      fontSize: '18px',
                      lineHeight: '27px',
                    }}
                  >
                    KSH. {formatKesNumber(vat)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-[27px]">
                <span
                  className="text-[#141776]"
                  style={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 700,
                    fontSize: '27px',
                    lineHeight: '37.8px',
                  }}
                >
                  Total
                </span>
                <div
                  className="flex items-baseline gap-[6px] text-[#141776]"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  <span style={{ fontWeight: 700, fontSize: '18px', lineHeight: '37.8px' }}>
                    KSH.
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '27px', lineHeight: '37.8px' }}>
                    {formatKesNumber(total)}
                  </span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={loading || items.length === 0}
                className="flex h-[78px] w-full items-center justify-center gap-[9px] rounded-[11248px] bg-[#B51A13] text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 400,
                  fontSize: '20.25px',
                  lineHeight: '31.5px',
                }}
              >
                {loading ? 'Placing Order…' : 'Place Order'}
                {!loading && (
                  <svg
                    className="ml-1 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>

              <p
                className="px-4 text-center text-[#464652]"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 500,
                  fontSize: '13.5px',
                  lineHeight: '16.2px',
                }}
              >
                By placing your order, you agree to our{' '}
                <a
                  href="#terms"
                  className="underline decoration-solid hover:text-gray-800"
                  style={{ lineHeight: '100%' }}
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="#privacy"
                  className="underline decoration-solid hover:text-gray-800"
                  style={{ lineHeight: '100%' }}
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
