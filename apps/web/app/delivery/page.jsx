import Link from 'next/link'

export const metadata = { title: 'Delivery Policy | Optex Opticians' }

export default function DeliveryPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[#1A1A2E] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#E53935] mb-3">SHIPPING & DELIVERY</p>
          <h1 className="text-4xl font-black mb-3">Delivery Policy</h1>
          <p className="text-white/70">Last updated: June 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-6">Delivery Options & Rates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Nairobi */}
            <div className="rounded-[24px] border-2 border-[#2A3182]/20 bg-[#f8f9fa] p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2A3182] flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </div>
                <h3 className="text-[17px] font-black text-gray-900">Nairobi</h3>
              </div>
              <p className="text-[28px] font-black text-[#2A3182]">KES 300</p>
              <p className="text-[14px] text-gray-600"><strong>1–2 business days</strong> after order confirmation</p>
              <p className="text-[13px] text-gray-500">Covers Nairobi CBD, Westlands, Kilimani, Karen, Eastleigh, and surrounding areas.</p>
            </div>

            {/* Outside Nairobi */}
            <div className="rounded-[24px] border-2 border-gray-200 bg-white p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                </div>
                <h3 className="text-[17px] font-black text-gray-900">Outside Nairobi</h3>
              </div>
              <p className="text-[28px] font-black text-gray-700">KES 500</p>
              <p className="text-[14px] text-gray-600"><strong>2–4 business days</strong> after order confirmation</p>
              <p className="text-[13px] text-gray-500">Covers all other counties in Kenya via our courier partner network.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">Free Delivery</h2>
          <div className="bg-green-50 border border-green-200 rounded-[20px] p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
            </div>
            <div>
              <p className="font-bold text-green-900 text-[16px] mb-1">Free delivery on orders over KES 5,000</p>
              <p className="text-[14px] text-green-800">Any single order totalling KES 5,000 or more qualifies for complimentary delivery to any location within Kenya.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">Order Tracking</h2>
          <p className="text-[15px] text-gray-700 leading-relaxed mb-4">
            Once your order is dispatched, you will receive an <strong>SMS confirmation</strong> on the phone number linked to your account. The message will include:
          </p>
          <ul className="space-y-3 text-[15px] text-gray-700 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A3182] flex-shrink-0 mt-2"></span>
              Your order reference number
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A3182] flex-shrink-0 mt-2"></span>
              The name of our courier partner handling your delivery
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A3182] flex-shrink-0 mt-2"></span>
              Estimated delivery date and a tracking link where available
            </li>
          </ul>
          <p className="text-[14px] text-gray-500 mt-4">
            You can also check your delivery status any time from your{' '}
            <Link href="/orders" className="text-[#2A3182] font-bold hover:underline">order history page</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">Delivery Partners</h2>
          <p className="text-[15px] text-gray-700 leading-relaxed">
            We work with trusted Kenya-based courier partners to ensure your eyewear arrives safely and on time.
            For Nairobi same-day and next-day orders, we use dedicated in-house dispatch riders.
            For up-country deliveries, we partner with established last-mile logistics providers operating across all 47 counties.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">Important Notes</h2>
          <ul className="space-y-3 text-[15px] text-gray-700 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              Delivery times are estimates and may be affected by public holidays or adverse weather.
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              Prescription orders require an additional 1–2 days for lens cutting and glazing before dispatch.
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              Please ensure someone is available to receive the package at the delivery address.
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              If a delivery attempt fails twice, the package will be returned to the nearest Optex branch for collection.
            </li>
          </ul>
        </section>

        <section className="border-t border-gray-100 pt-8">
          <p className="text-[14px] text-gray-500">
            Questions about your delivery?{' '}
            <Link href="/contact" className="text-[#2A3182] font-bold hover:underline">Contact our support team</Link>
            {' '}or call us at <span className="text-[#2A3182] font-semibold">+254 700 000 000</span>.
          </p>
        </section>
      </div>
    </div>
  )
}
