import Link from 'next/link'

export const metadata = { title: 'Returns Policy | Optex Opticians' }

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[#1A1A2E] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#E53935] mb-3">CUSTOMER CARE</p>
          <h1 className="text-4xl font-black mb-3">Returns Policy</h1>
          <p className="text-white/70">Last updated: June 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">14-Day Return Window</h2>
          <p className="text-[15px] text-gray-700 leading-relaxed">
            We want you to be completely satisfied with your purchase. If you are not happy with your order for any reason,
            you may return eligible items within <strong>14 calendar days</strong> of the delivery date for a full refund
            or exchange.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">Return Conditions</h2>
          <p className="text-[15px] text-gray-700 leading-relaxed mb-4">To be eligible for a return, items must meet all of the following conditions:</p>
          <ul className="space-y-3 text-[15px] text-gray-700 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A3182] flex-shrink-0 mt-2"></span>
              Returned within 14 days of the delivery date
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A3182] flex-shrink-0 mt-2"></span>
              Unused, unworn, and in its original condition
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A3182] flex-shrink-0 mt-2"></span>
              In the original packaging with all tags, case, and cleaning cloth included
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A3182] flex-shrink-0 mt-2"></span>
              Accompanied by the original receipt or order confirmation
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">Prescription Eyewear</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-6 text-[15px] text-gray-700 leading-relaxed space-y-3">
            <p className="font-bold text-amber-800">Please note the following exceptions for prescription eyewear:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-2"></span>
                Custom prescription lenses are cut and glazed specifically for you and are generally non-returnable unless there is a manufacturing defect.
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-2"></span>
                If your prescription has changed after purchase, this does not qualify as a product defect. Please contact us — we may offer a re-glazing service at a discounted rate.
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-2"></span>
                Frame-only returns (without prescription lenses) follow the standard 14-day policy.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">How to Return</h2>
          <div className="bg-[#f8f9fa] rounded-[20px] p-6 space-y-4 text-[15px] text-gray-700">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#2A3182] text-white text-[13px] font-bold flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900">In-Store Return</p>
                  <p className="text-gray-600">Visit any Optex Opticians branch with the item and your proof of purchase. Our team will process your return immediately.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#2A3182] text-white text-[13px] font-bold flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900">Contact Support</p>
                  <p className="text-gray-600">Email us at <span className="text-[#2A3182] font-semibold">returns@optexopticians.co.ke</span> with your order number. We will arrange collection or guide you through the process.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">Refund Timeline</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-[20px] border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-[12px]">MP</div>
                <p className="font-bold text-gray-900">M-Pesa</p>
              </div>
              <p className="text-[15px] text-gray-700"><strong>3–5 business days</strong> after the return is approved and processed.</p>
            </div>
            <div className="rounded-[20px] border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[12px]">CC</div>
                <p className="font-bold text-gray-900">Visa / Mastercard</p>
              </div>
              <p className="text-[15px] text-gray-700"><strong>5–7 business days</strong> after the return is approved, subject to your bank's processing times.</p>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-8">
          <p className="text-[14px] text-gray-500">
            Need help with a return?{' '}
            <Link href="/contact" className="text-[#2A3182] font-bold hover:underline">Contact our support team</Link>
            {' '}or visit us at any{' '}
            <Link href="/branch-locator" className="text-[#2A3182] font-bold hover:underline">Optex branch</Link>.
          </p>
        </section>
      </div>
    </div>
  )
}
