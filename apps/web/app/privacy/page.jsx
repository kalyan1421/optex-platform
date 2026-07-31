import Link from 'next/link';

export const metadata = { title: 'Privacy Policy | Optex Opticians' };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[#1A1A2E] px-4 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#E53935]">
            LEGAL
          </p>
          <h1 className="mb-3 text-4xl font-black">Privacy Policy</h1>
          <p className="text-white/70">Last updated: June 2026 · Effective date: 1 July 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-12">
        <section>
          <p className="text-[15px] leading-relaxed text-gray-700">
            Optex Opticians ("we", "us", or "our") is committed to protecting and respecting your
            privacy. This policy explains how we collect, use, and safeguard your personal data in
            accordance with the
            <strong> Kenya Data Protection Act 2019 (DPA 2019)</strong> and applicable regulations.
            By using our website or services, you consent to the practices described here.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Data We Collect</h2>
          <p className="mb-4 text-[15px] text-gray-700">
            We collect personal data you provide directly and data generated through your use of our
            services:
          </p>
          <ul className="space-y-3 text-[15px] leading-relaxed text-gray-700">
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              <span>
                <strong>Identity data:</strong> Full name, date of birth
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              <span>
                <strong>Contact data:</strong> Email address, phone number, delivery address
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              <span>
                <strong>Transaction data:</strong> Purchase history, order details, payment method
                (we do not store full card numbers)
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              <span>
                <strong>Health data:</strong> Eye prescription details and clinical notes uploaded
                for lens orders (treated as sensitive data under DPA 2019)
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              <span>
                <strong>Technical data:</strong> IP address, browser type, device information, and
                cookies
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">How We Use Your Data</h2>
          <ul className="space-y-3 text-[15px] leading-relaxed text-gray-700">
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              Processing and fulfilling your orders, including prescription lens fabrication
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              Managing your account and providing customer support
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              Sending order confirmations, delivery updates, and appointment reminders via SMS and
              email
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              Improving our website, products, and services through aggregated analytics
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              Complying with legal and regulatory obligations
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              Sending marketing communications — only where you have given explicit consent; you may
              opt out at any time
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">
            Prescription Data & Secure Storage
          </h2>
          <div className="space-y-3 rounded-[20px] bg-[#f8f9fa] p-6 text-[15px] leading-relaxed text-gray-700">
            <p>
              Prescription files and clinical documents you upload are stored in a{' '}
              <strong>private, encrypted storage bucket</strong> provided by Supabase (hosted in the
              EU region with GDPR-aligned data processing agreements). Access is namespaced by your
              unique customer ID — no other user can access your prescription files.
            </p>
            <p>
              Prescription data is accessed only by Optex staff for the purpose of lens fabrication
              and is never sold or shared with third parties for commercial purposes.
            </p>
            <p>
              All data in transit is protected by TLS 1.2+. Data at rest is encrypted using AES-256.
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">
            Kenya Data Protection Act 2019
          </h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            We operate in compliance with the <strong>Kenya Data Protection Act 2019</strong> and
            the Data Protection (General) Regulations 2021. We are registered as a Data Controller
            with the Office of the Data Protection Commissioner (ODPC) of Kenya. Eye prescription
            data and other health-related information is classified as sensitive personal data and
            is processed only with your explicit consent.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Your Rights</h2>
          <p className="mb-4 text-[15px] text-gray-700">
            Under the DPA 2019, you have the right to:
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              {
                icon: '👁',
                title: 'Access',
                desc: 'Request a copy of the personal data we hold about you.',
              },
              {
                icon: '✏️',
                title: 'Correction',
                desc: 'Request correction of inaccurate or incomplete data.',
              },
              {
                icon: '🗑️',
                title: 'Deletion',
                desc: 'Request deletion of your data ("right to be forgotten"), subject to legal retention obligations.',
              },
              {
                icon: '🚫',
                title: 'Objection',
                desc: 'Object to processing for direct marketing at any time.',
              },
              {
                icon: '📦',
                title: 'Portability',
                desc: 'Receive your data in a structured, machine-readable format.',
              },
              {
                icon: '⏸️',
                title: 'Restriction',
                desc: 'Request restriction of processing in certain circumstances.',
              },
            ].map((right) => (
              <div
                key={right.title}
                className="flex items-start gap-3 rounded-[16px] border border-gray-200 p-4"
              >
                <span className="text-[22px]">{right.icon}</span>
                <div>
                  <p className="text-[14px] font-bold text-gray-900">{right.title}</p>
                  <p className="mt-0.5 text-[13px] text-gray-600">{right.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">
            Contact Our Data Protection Officer
          </h2>
          <div className="space-y-2 rounded-[20px] border border-[#2A3182]/20 bg-[#2A3182]/5 p-6 text-[15px] text-gray-700">
            <p>
              To exercise any of your rights, or if you have questions about this policy, contact
              our Data Protection Officer:
            </p>
            <p className="font-bold text-[#2A3182]">DPO — Optex Opticians</p>
            <p>
              Email: <span className="font-semibold text-[#2A3182]">dpo@optexopticians.co.ke</span>
            </p>
            <p>Address: Optex Opticians, Nairobi CBD, Kenya</p>
            <p className="mt-2 text-[13px] text-gray-500">
              We will respond to all data rights requests within 21 days as required by the DPA
              2019.
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Cookies</h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            We use essential cookies to maintain your session and shopping cart. We may use
            analytics cookies (with your consent) to understand how visitors use our site. You can
            control cookie preferences through your browser settings. Disabling essential cookies
            may affect site functionality.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Changes to This Policy</h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            We may update this Privacy Policy from time to time. We will notify you of significant
            changes by email or via a notice on our website. The "last updated" date at the top of
            this page reflects the most recent revision.
          </p>
        </section>

        <section className="border-t border-gray-100 pt-8">
          <p className="text-[14px] text-gray-500">
            See also:{' '}
            <Link href="/returns" className="font-bold text-[#2A3182] hover:underline">
              Returns Policy
            </Link>{' '}
            ·{' '}
            <Link href="/delivery" className="font-bold text-[#2A3182] hover:underline">
              Delivery Policy
            </Link>{' '}
            ·{' '}
            <Link href="/warranty" className="font-bold text-[#2A3182] hover:underline">
              Warranty Policy
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
