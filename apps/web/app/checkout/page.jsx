'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatKes } from '@optex/ui';

// Flat delivery fee mirrors the server (`place_order` RPC: 300 KES for delivery,
// 0 for branch pickup). Kept in sync so the displayed total equals what the API
// charges. NOTE: confirm with Optex whether standard delivery should be free.
const DELIVERY_FEE_KES = 300;

const CaretUpIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const CaretDownIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const TruckIcon = () => (
  <svg className="w-5 h-5 text-[#2A3182]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
  </svg>
);

const DeliveryIcon = () => (
  <svg className="w-5 h-5 text-[#2A3182]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const PaymentIcon = () => (
  <svg className="w-5 h-5 text-[#2A3182]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const PAYMENT_METHODS = [
  { id: 'mpesa', label: 'M-Pesa', description: 'Pay via Safaricom M-Pesa STK Push', value: 'mpesa' },
  { id: 'pesapal', label: 'Pesapal', description: 'Pay via Pesapal (card, bank, mobile)', value: 'pesapal' },
  { id: 'cod', label: 'Cash on Delivery', description: 'Pay in cash when your order arrives', value: 'cod' },
];

const KENYA_COUNTIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Kiambu', 'Machakos',
  'Kajiado', 'Muranga', 'Nyeri', 'Meru', 'Embu', 'Kirinyaga', 'Nyandarua',
  'Laikipia', 'Samburu', 'Trans Nzoia', 'Uasin Gishu', 'Elgeyo-Marakwet',
  'Nandi', 'Baringo', 'West Pokot', 'Turkana', 'Marsabit', 'Isiolo',
  'Tharaka-Nithi', 'Kitui', 'Makueni', 'Narok', 'Kericho', 'Bomet',
  'Kakamega', 'Vihiga', 'Bungoma', 'Busia', 'Siaya', 'Homa Bay',
  'Migori', 'Kisii', 'Nyamira', 'Kilifi', 'Kwale', 'Taita-Taveta',
  'Tana River', 'Lamu', 'Garissa', 'Wajir', 'Mandera',
];

export default function Page() {
  const router = useRouter();
  const { items } = useCart();
  const { user } = useAuth();

  const [activeStep, setActiveStep] = useState(1);
  const [shipping, setShipping] = useState({
    firstName: '', lastName: '', phone: '',
    address: '', city: '', county: '', postal: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect to login immediately if not authenticated
  useEffect(() => {
    if (user === null) router.push('/login?redirect=/checkout');
  }, [user, router]);

  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const shippingKes = DELIVERY_FEE_KES;
  const vat = +(subtotal * 0.16).toFixed(2);
  const total = +(subtotal + vat + shippingKes).toFixed(2);

  async function handlePlaceOrder() {
    if (!user) { router.push('/login'); return; }
    if (items.length === 0) { setError('Your cart is empty.'); return; }
    if (!shipping.firstName || !shipping.lastName || !shipping.phone || !shipping.address || !shipping.city || !shipping.county) {
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

      // 2. Route by payment method.
      if (paymentMethod === 'cod') {
        // COD: already accepted into the fulfilment queue — straight to confirmation.
        router.push(`/order-confirmation/${order.id}`);
        return;
      }

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
      void payment;
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
    <div className="min-h-screen bg-white pb-10 pt-32 sm:pb-20 sm:pt-40">
      <div className="site-container">
        <div className="mb-8 text-center sm:mb-10 sm:text-left">
          <h1 className="mb-1 text-[28px] font-black leading-tight text-[#2A3182] sm:mb-2 sm:text-[36px]">Checkout</h1>
          <p className="text-[14px] font-medium text-gray-500 sm:text-[15px]">Please complete each step to finalize your order.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-[14px] font-medium text-red-600">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          {/* Steps */}
          <div className="flex flex-1 flex-col gap-4">

            {/* Step 1 — Shipping Address */}
            <div className={`rounded-2xl border border-gray-100 bg-white sm:rounded-3xl ${activeStep === 1 ? 'shadow-[0_8px_30px_rgb(0,0,0,0.06)]' : 'shadow-sm'}`}>
              <div className="flex cursor-pointer items-center justify-between p-5 sm:p-6" onClick={() => setActiveStep(1)}>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${activeStep === 1 ? 'bg-[#111827] text-white' : 'border border-gray-200 bg-white text-gray-400'}`}>1</div>
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <TruckIcon />
                    <h3 className="text-[15px] font-bold text-[#2A3182] sm:text-[16px]">Shipping Address</h3>
                  </div>
                </div>
                {activeStep === 1 ? <CaretUpIcon /> : <CaretDownIcon />}
              </div>

              {activeStep === 1 && (
                <div className="px-5 pb-6 sm:px-6 sm:pb-8">
                  <div className="border-t border-gray-100 pt-6">
                    <div className="mb-4 grid grid-cols-1 gap-4 sm:mb-6 sm:grid-cols-2 sm:gap-6">
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">First Name</label>
                        <input type="text" placeholder="Jane" value={shipping.firstName}
                          onChange={(e) => setShipping(s => ({ ...s, firstName: e.target.value }))}
                          className="w-full rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">Last Name</label>
                        <input type="text" placeholder="Doe" value={shipping.lastName}
                          onChange={(e) => setShipping(s => ({ ...s, lastName: e.target.value }))}
                          className="w-full rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white" />
                      </div>
                    </div>

                    <div className="mb-4 sm:mb-6">
                      <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">Phone Number</label>
                      <input type="tel" placeholder="0712 345 678" value={shipping.phone}
                        onChange={(e) => setShipping(s => ({ ...s, phone: e.target.value }))}
                        className="w-full rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white" />
                    </div>

                    <div className="mb-4 sm:mb-6">
                      <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">Address</label>
                      <input type="text" placeholder="123 Moi Avenue" value={shipping.address}
                        onChange={(e) => setShipping(s => ({ ...s, address: e.target.value }))}
                        className="w-full rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white" />
                    </div>

                    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">City / Town</label>
                        <input type="text" placeholder="Nairobi" value={shipping.city}
                          onChange={(e) => setShipping(s => ({ ...s, city: e.target.value }))}
                          className="w-full rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">County</label>
                        <select value={shipping.county}
                          onChange={(e) => setShipping(s => ({ ...s, county: e.target.value }))}
                          className="w-full rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors focus:border-[#2A3182] focus:bg-white">
                          <option value="">Select county</option>
                          {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[#2A3182]">Postal Code</label>
                        <input type="text" placeholder="00100" value={shipping.postal}
                          onChange={(e) => setShipping(s => ({ ...s, postal: e.target.value }))}
                          className="w-full rounded-xl border border-transparent bg-[#f3f4f6] px-4 py-3 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-[#2A3182] focus:bg-white" />
                      </div>
                    </div>

                    <button onClick={() => setActiveStep(2)}
                      className="rounded-full bg-[#111827] px-8 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-black">
                      Continue to Delivery
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2 — Delivery Method */}
            <div className={`rounded-2xl border border-gray-100 bg-white sm:rounded-3xl ${activeStep === 2 ? 'shadow-[0_8px_30px_rgb(0,0,0,0.06)]' : 'shadow-sm'}`}>
              <div className="flex cursor-pointer items-center justify-between p-5 sm:p-6" onClick={() => setActiveStep(2)}>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${activeStep === 2 ? 'bg-[#111827] text-white' : 'border border-gray-200 bg-white text-gray-400'}`}>2</div>
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <DeliveryIcon />
                    <h3 className="text-[15px] font-bold text-[#2A3182] sm:text-[16px]">Delivery Method</h3>
                  </div>
                </div>
                {activeStep === 2 ? <CaretUpIcon /> : <CaretDownIcon />}
              </div>

              {activeStep === 2 && (
                <div className="px-5 pb-6 sm:px-6 sm:pb-8">
                  <div className="border-t border-gray-100 pt-6">
                    <div className="flex flex-col gap-3 mb-8">
                      <label className="flex items-start gap-4 rounded-xl border-2 border-[#2A3182] bg-blue-50/30 p-4 cursor-pointer">
                        <input type="radio" name="delivery" defaultChecked className="mt-1 accent-[#2A3182]" readOnly />
                        <div>
                          <p className="text-[14px] font-bold text-[#2A3182]">Standard Delivery — {formatKes(DELIVERY_FEE_KES)}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">2–5 business days within Nairobi; 3–7 days upcountry</p>
                        </div>
                      </label>
                    </div>
                    <button onClick={() => setActiveStep(3)}
                      className="rounded-full bg-[#111827] px-8 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-black">
                      Continue to Payment
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3 — Payment */}
            <div className={`rounded-2xl border border-gray-100 bg-white sm:rounded-3xl ${activeStep === 3 ? 'shadow-[0_8px_30px_rgb(0,0,0,0.06)]' : 'shadow-sm'}`}>
              <div className="flex cursor-pointer items-center justify-between p-5 sm:p-6" onClick={() => setActiveStep(3)}>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${activeStep === 3 ? 'bg-[#111827] text-white' : 'border border-gray-200 bg-white text-gray-400'}`}>3</div>
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <PaymentIcon />
                    <h3 className="text-[15px] font-bold text-[#2A3182] sm:text-[16px]">Payment Method</h3>
                  </div>
                </div>
                {activeStep === 3 ? <CaretUpIcon /> : <CaretDownIcon />}
              </div>

              {activeStep === 3 && (
                <div className="px-5 pb-6 sm:px-6 sm:pb-8">
                  <div className="border-t border-gray-100 pt-6">
                    <div className="flex flex-col gap-3">
                      {PAYMENT_METHODS.map((pm) => (
                        <label key={pm.id}
                          className={`flex items-start gap-4 rounded-xl border-2 p-4 cursor-pointer transition-colors ${paymentMethod === pm.value ? 'border-[#2A3182] bg-blue-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="radio" name="payment" value={pm.value} checked={paymentMethod === pm.value}
                            onChange={() => setPaymentMethod(pm.value)}
                            className="mt-1 accent-[#2A3182]" />
                          <div>
                            <p className="text-[14px] font-bold text-[#2A3182]">{pm.label}</p>
                            <p className="text-[12px] text-gray-500 mt-0.5">{pm.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="w-full flex-shrink-0 lg:w-[380px]">
            <div className="sticky top-28 rounded-2xl bg-white p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] sm:rounded-[32px] sm:p-8">
              <h2 className="mb-6 text-[20px] font-bold text-[#2A3182] sm:mb-8 sm:text-[24px]">Order Summary</h2>

              <div className="mb-8 flex flex-col gap-5">
                {items.length === 0 ? (
                  <p className="text-[13px] text-gray-400 text-center py-4">Your cart is empty.</p>
                ) : items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-50 sm:h-20 sm:w-20">
                      <img src={item.image} alt={item.title} className="h-full w-full object-contain p-2 sm:p-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="mb-1 text-[14px] font-medium leading-tight text-[#2A3182] truncate sm:text-[15px]">
                        {item.title}
                      </h4>
                      <p className="text-[12px] text-gray-400">Qty: {item.quantity}</p>
                      <p className="text-[14px] font-bold text-[#2A3182] sm:text-[15px]">
                        {formatKes(Number(item.price) * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6 space-y-4 border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="font-medium text-gray-500">Subtotal</span>
                  <span className="font-medium text-[#2A3182]">{formatKes(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="font-medium text-gray-500">Shipping</span>
                  <span className="font-medium text-[#2A3182]">{formatKes(shippingKes)}</span>
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="font-medium text-gray-500">VAT (16%)</span>
                  <span className="font-medium text-[#2A3182]">{formatKes(vat)}</span>
                </div>
              </div>

              <div className="mb-8 flex items-end justify-between border-t border-gray-100 pt-6">
                <span className="text-[20px] font-bold text-[#2A3182]">Total</span>
                <div className="flex items-center gap-1">
                  <span className="mb-0.5 text-[12px] font-bold uppercase tracking-tighter text-gray-900">KSH.</span>
                  <span className="text-[26px] font-black leading-none text-[#2A3182]">{total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={loading || items.length === 0}
                className="mb-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#c1272d] py-4 text-[15px] font-bold text-white shadow-lg shadow-red-500/30 transition-colors hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Placing Order…' : 'Place Order'}
                {!loading && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>

              <p className="px-4 text-center text-[11px] leading-relaxed text-gray-500 sm:text-[12px]">
                By placing your order, you agree to our <a href="#terms" className="underline hover:text-gray-800">Terms of Service</a> and <a href="#privacy" className="underline hover:text-gray-800">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
