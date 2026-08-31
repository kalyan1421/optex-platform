import Link from 'next/link';

export const metadata = { title: 'Delivery Policy | Optex Opticians' };

export default function DeliveryPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[#1A1A2E] px-4 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#E53935]">
            SHIPPING & DELIVERY
          </p>
          <h1 className="mb-3 text-4xl font-black">Delivery Policy</h1>
          <p className="text-white/70">Last updated: June 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-12">
        <section>
          <h2 className="mb-6 text-[22px] font-black text-[#2A3182]">Delivery Options & Rates</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Nairobi */}
            <div className="space-y-3 rounded-[24px] border-2 border-[#2A3182]/20 bg-[#f8f9fa] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2A3182]">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-[17px] font-black text-gray-900">Nairobi</h3>
              </div>
              <p className="text-[28px] font-black text-[#2A3182]">KES 300</p>
              <p className="text-[14px] text-gray-600">
                <strong>1–2 business days</strong> after order confirmation
              </p>
              <p className="text-[13px] text-gray-500">
                Covers Nairobi CBD, Westlands, Kilimani, Karen, Eastleigh, and surrounding areas.
              </p>
            </div>

            {/* Outside Nairobi */}
            <div className="space-y-3 rounded-[24px] border-2 border-gray-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                  <svg
                    className="h-5 w-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <h3 className="text-[17px] font-black text-gray-900">Other Kenyan locations</h3>
              </div>
              <p className="text-[28px] font-black text-gray-700">KES 300</p>
              <p className="text-[14px] text-gray-600">
                <strong>2–4 business days</strong> after order confirmation
              </p>
              <p className="text-[13px] text-gray-500">
                Standard online delivery currently uses the same KES 300 charge outside Nairobi.
                Availability is confirmed from the address during checkout.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">
            Current online delivery rule
          </h2>
          <div className="flex items-start gap-4 rounded-[20px] border border-green-200 bg-green-50 p-6">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-5 w-5 text-green-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="mb-1 text-[16px] font-bold text-green-900">
                Standard delivery is KES 300
              </p>
              <p className="text-[14px] text-green-800">
                The checkout total is calculated by the server and shown before payment. Any future
                free-delivery promotion will be reflected there automatically.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Order Tracking</h2>
          <p className="mb-4 text-[15px] leading-relaxed text-gray-700">
            Once your order is dispatched, you will receive an <strong>SMS confirmation</strong> on
            the phone number linked to your account. The message will include:
          </p>
          <ul className="space-y-3 text-[15px] leading-relaxed text-gray-700">
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              Your order reference number
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              The name of our courier partner handling your delivery
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              Estimated delivery date and a tracking link where available
            </li>
          </ul>
          <p className="mt-4 text-[14px] text-gray-500">
            You can also check your delivery status any time from your{' '}
            <Link href="/profile" className="font-bold text-[#2A3182] hover:underline">
              profile page
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Delivery Partners</h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            We work with trusted Kenya-based courier partners to ensure your eyewear arrives safely
            and on time. For Nairobi same-day and next-day orders, we use dedicated in-house
            dispatch riders. For up-country deliveries, we partner with established last-mile
            logistics providers operating across all 47 counties.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Important Notes</h2>
          <ul className="space-y-3 text-[15px] leading-relaxed text-gray-700">
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              Delivery times are estimates and may be affected by public holidays or adverse
              weather.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              Prescription orders require an additional 1–2 days for lens cutting and glazing before
              dispatch.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              Please ensure someone is available to receive the package at the delivery address.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              If a delivery attempt fails twice, the package will be returned to the nearest Optex
              branch for collection.
            </li>
          </ul>
        </section>

        <section className="border-t border-gray-100 pt-8">
          <p className="text-[14px] text-gray-500">
            Questions about your delivery?{' '}
            <Link href="/contact" className="font-bold text-[#2A3182] hover:underline">
              Contact our support team
            </Link>{' '}
            or call us at <span className="font-semibold text-[#2A3182]">+254 700 897 007</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
