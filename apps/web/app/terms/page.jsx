import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | Optex Opticians',
  description:
    'The terms that apply when you buy eyewear or book an eye examination with Optex Opticians Kenya.',
};

/**
 * Terms of Service.
 *
 * The commercial terms below are the ones the platform actually enforces —
 * 16% VAT, KES 300 delivery / free branch pickup, the M-Pesa/Pesapal/COD
 * methods, and the order statuses in the tracking flow — so this page and the
 * checkout cannot drift apart.
 *
 * The checkout and signup pages link here as part of the agreement the customer
 * accepts, so it must not 404 (it previously pointed at a dead `#terms`
 * anchor). Have a Kenyan-qualified lawyer review the wording before launch.
 */

const SECTIONS = [
  {
    heading: '1. Who we are',
    body: [
      'These terms apply to optexopticians.co.ke, operated by Optex Opticians, Nairobi, Kenya. By placing an order or booking an appointment you agree to them.',
    ],
  },
  {
    heading: '2. Orders and acceptance',
    body: [
      'An order is an offer to buy. It is accepted once we confirm it, and you will receive confirmation by SMS and email.',
      'We may decline an order where an item is out of stock, a price is shown in error, or a prescription cannot be safely dispensed. Where payment has been taken for a declined order it is refunded in full.',
    ],
  },
  {
    heading: '3. Pricing, VAT and delivery charges',
    body: [
      'All prices are shown in Kenyan Shillings (KES) and exclude VAT until checkout.',
      'VAT is charged at the Kenya standard rate of 16%, calculated on the order value after any promotional discount.',
      'Delivery is KES 300 per order. Collection from any Optex branch is free.',
      'The total shown on the checkout review step is the amount you will be charged.',
    ],
  },
  {
    heading: '4. Payment',
    body: [
      'We accept M-Pesa (STK push), card and mobile-money payments via Pesapal (Visa, Mastercard, Airtel Money, bank transfer), and cash on delivery.',
      'Card details are handled by Pesapal and are never stored on our systems. Where you choose to save a card, we store only a gateway token and the last four digits for display.',
      'Orders paid by card or M-Pesa are only dispatched once payment is confirmed by the provider.',
    ],
  },
  {
    heading: '5. Prescriptions',
    body: [
      'Prescription lenses are dispensed against a valid prescription that you upload or that is issued at one of our branches.',
      'You are responsible for the accuracy of any prescription you supply. We may contact you or decline to dispense where the values supplied appear inconsistent.',
      'Prescription files are stored privately and are accessible only to you and authorised Optex staff.',
    ],
  },
  {
    heading: '6. Delivery and tracking',
    body: [
      'Orders move through the stages shown on your tracking page: received, processing, dispatched, delivered.',
      'Delivery estimates are indicative and not guaranteed. See our delivery policy for current timeframes.',
    ],
  },
  {
    heading: '7. Returns, exchanges and warranty',
    body: [
      'Unworn items in original condition may be returned within 30 days. Custom-glazed prescription lenses are excluded except where faulty.',
      'Frames carry a 2-year manufacturing warranty. This does not cover accidental damage or normal wear.',
      'Nothing in these terms limits your rights under the Consumer Protection Act, 2012.',
    ],
  },
  {
    heading: '8. Promotional codes',
    body: [
      'Promotional codes are valid only within their stated dates, may carry a minimum order value or usage limit, and may be restricted to particular categories.',
      'Unless stated otherwise, one code applies per order and codes have no cash value.',
    ],
  },
  {
    heading: '9. Appointments',
    body: [
      'Eye examinations, frame fittings and consultations are booked per branch and confirmed by SMS.',
      'Please give at least 24 hours notice to cancel or reschedule so the slot can be offered to someone else.',
    ],
  },
  {
    heading: '10. Your account',
    body: [
      'You are responsible for keeping your account credentials confidential and for activity carried out under your account.',
      'You may close your account at any time from your profile. Order records are retained where we are required to keep them for tax and regulatory purposes.',
    ],
  },
  {
    heading: '11. Changes to these terms',
    body: [
      'We may update these terms. The version in force is the one published here when you place your order.',
    ],
  },
  {
    heading: '12. Contact',
    body: [
      'Questions about these terms: optexopticians@gmail.com or +254 700 000 000.',
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-[60vh] bg-[#f8f9fb] py-12">
      <div className="site-container max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-gray-500">
          <Link href="/" className="hover:text-[#2A3182]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-gray-900">Terms of Service</span>
        </nav>

        <article className="rounded-[32px] bg-white p-7 shadow-sm sm:p-10">
          <h1 className="text-[28px] font-black tracking-tight text-[#2A3182] sm:text-[34px]">
            Terms of Service
          </h1>

          <div className="mt-8 space-y-8">
            {SECTIONS.map((section) => (
              <section key={section.heading}>
                <h2 className="mb-3 text-[17px] font-bold text-gray-900">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mb-3 text-[14px] leading-relaxed text-gray-600 last:mb-0"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-gray-100 pt-7 text-[13px] font-bold">
            <Link href="/privacy" className="text-[#2A3182] hover:underline">
              Privacy Policy
            </Link>
            <span className="text-gray-300">·</span>
            <Link href="/returns" className="text-[#2A3182] hover:underline">
              Returns Policy
            </Link>
            <span className="text-gray-300">·</span>
            <Link href="/delivery" className="text-[#2A3182] hover:underline">
              Delivery Policy
            </Link>
            <span className="text-gray-300">·</span>
            <Link href="/warranty" className="text-[#2A3182] hover:underline">
              Warranty Policy
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
