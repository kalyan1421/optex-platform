import Link from 'next/link';

export const metadata = { title: 'Returns Policy | Optex Opticians' };

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[#1A1A2E] px-4 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#E53935]">
            CUSTOMER CARE
          </p>
          <h1 className="mb-3 text-4xl font-black">Returns Policy</h1>
          <p className="text-white/70">Last updated: June 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-12">
        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">No general refunds</h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            Online orders are not eligible for general refunds or change-of-mind returns. Please
            confirm your frame, lens and prescription choices before payment. If an item arrives
            damaged, incorrect, or has a manufacturing defect, contact Optex support promptly so we
            can investigate and arrange the appropriate remedy.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">When to contact us</h2>
          <p className="mb-4 text-[15px] leading-relaxed text-gray-700">
            Contact us as soon as possible if any of the following applies:
          </p>
          <ul className="space-y-3 text-[15px] leading-relaxed text-gray-700">
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              The delivered item is damaged or materially different from the order
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              The wrong frame, size, or prescription configuration was supplied
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>A
              manufacturing defect is present
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              You need help with a warranty or fitting issue
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Prescription Eyewear</h2>
          <div className="space-y-3 rounded-[20px] border border-amber-200 bg-amber-50 p-6 text-[15px] leading-relaxed text-gray-700">
            <p className="font-bold text-amber-800">
              Please note the following exceptions for prescription eyewear:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"></span>
                Custom prescription lenses are cut and glazed specifically for you and are generally
                non-returnable unless there is a manufacturing defect.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"></span>
                If your prescription has changed after purchase, this does not qualify as a product
                defect. Please contact us — we may offer a re-glazing service at a discounted rate.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"></span>
                Frame-only returns (without prescription lenses) follow the standard 14-day policy.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">How to Return</h2>
          <div className="space-y-4 rounded-[20px] bg-[#f8f9fa] p-6 text-[15px] text-gray-700">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#2A3182] text-[13px] font-bold text-white">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900">In-Store Return</p>
                  <p className="text-gray-600">
                    Visit any Optex Opticians branch with the item and your proof of purchase. Our
                    team will process your return immediately.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#2A3182] text-[13px] font-bold text-white">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900">Contact Support</p>
                  <p className="text-gray-600">
                    Email us at{' '}
                    <span className="font-semibold text-[#2A3182]">
                      returns@optexopticians.co.ke
                    </span>{' '}
                    with your order number. We will arrange collection or guide you through the
                    process.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[20px] border border-blue-100 bg-blue-50 p-6">
          <h2 className="mb-2 text-[22px] font-black text-[#2A3182]">Resolution process</h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            Our support team will review the order, photos, and any relevant prescription or
            warranty information. If the issue is confirmed, we will explain the available repair,
            replacement, exchange, or other remedy before proceeding.
          </p>
        </section>

        <section className="border-t border-gray-100 pt-8">
          <p className="text-[14px] text-gray-500">
            Need help with a return?{' '}
            <Link href="/contact" className="font-bold text-[#2A3182] hover:underline">
              Contact our support team
            </Link>{' '}
            or visit us at any{' '}
            <Link href="/branch-locator" className="font-bold text-[#2A3182] hover:underline">
              Optex branch
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
