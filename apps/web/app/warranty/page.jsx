import Link from 'next/link'

export const metadata = { title: 'Warranty Policy | Optex Opticians' }

export default function WarrantyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[#1A1A2E] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#E53935] mb-3">CUSTOMER CARE</p>
          <h1 className="text-4xl font-black mb-3">Warranty Policy</h1>
          <p className="text-white/70">Last updated: June 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">Coverage Period</h2>
          <ul className="space-y-3 text-[15px] text-gray-700 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              <span><strong>Frames:</strong> 1-year warranty from the date of purchase against manufacturing defects.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              <span><strong>Prescription Lenses:</strong> 6-month warranty from the date of purchase against manufacturing defects, including delamination, peeling coatings, and prescription errors attributable to our lab.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              <span><strong>Sunglasses (non-prescription):</strong> 1-year warranty on frames; 6 months on lens coatings.</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">What Is Covered</h2>
          <ul className="space-y-3 text-[15px] text-gray-700 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A3182] flex-shrink-0 mt-2"></span>
              Manufacturing defects in materials or workmanship
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A3182] flex-shrink-0 mt-2"></span>
              Spontaneous hinge failure under normal use
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A3182] flex-shrink-0 mt-2"></span>
              Lens coating defects (bubbling, peeling) not caused by improper cleaning
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A3182] flex-shrink-0 mt-2"></span>
              Prescription accuracy errors attributable to our laboratory
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">What Is Not Covered</h2>
          <ul className="space-y-3 text-[15px] text-gray-700 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              Accidental damage — drops, impacts, cracks, or breakage
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              Loss or theft of the product
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              Damage caused by improper use, storage, or cleaning
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              Normal wear and tear (scratches from daily use)
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              Changes to your prescription after purchase
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] flex-shrink-0 mt-2"></span>
              Products modified or repaired by third parties
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[22px] font-black text-[#2A3182] mb-4">How to Claim</h2>
          <div className="bg-[#f8f9fa] rounded-[20px] p-6 space-y-4 text-[15px] text-gray-700">
            <p>To make a warranty claim, please follow these steps:</p>
            <ol className="space-y-3 list-none">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#2A3182] text-white text-[12px] font-bold flex items-center justify-center">1</span>
                <span>Visit any Optex Opticians branch with your original receipt or order confirmation.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#2A3182] text-white text-[12px] font-bold flex items-center justify-center">2</span>
                <span>Bring the defective product in its original case if available.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#2A3182] text-white text-[12px] font-bold flex items-center justify-center">3</span>
                <span>Our in-store team will assess the defect and process your claim within 3 business days.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#2A3182] text-white text-[12px] font-bold flex items-center justify-center">4</span>
                <span>Approved claims will result in a free repair or replacement at our discretion.</span>
              </li>
            </ol>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-8">
          <p className="text-[14px] text-gray-500">
            Have questions?{' '}
            <Link href="/contact" className="text-[#2A3182] font-bold hover:underline">Contact our support team</Link>
            {' '}or visit us at any of our{' '}
            <Link href="/branch-locator" className="text-[#2A3182] font-bold hover:underline">Nairobi branches</Link>.
          </p>
        </section>
      </div>
    </div>
  )
}
