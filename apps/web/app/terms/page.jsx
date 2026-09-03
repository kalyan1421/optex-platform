import Link from 'next/link';

export const metadata = { title: 'Terms of Service | Optex Opticians' };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[#1A1A2E] px-4 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#E53935]">
            LEGAL
          </p>
          <h1 className="mb-3 text-4xl font-black">Terms of Service</h1>
          <p className="text-white/70">Last updated: June 2026 · Effective date: 1 July 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-12">
        <section>
          <p className="text-[15px] leading-relaxed text-gray-700">
            These Terms of Service ("Terms") govern your access to and use of the Optex Opticians
            website, mobile experiences, and related services (together, the "Services"), operated
            by Optex Opticians ("we", "us", or "our") in Kenya. By creating an account, placing an
            order, or otherwise using the Services, you agree to be bound by these Terms. If you do
            not agree, please do not use the Services.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Eligibility & Your Account</h2>
          <ul className="space-y-3 text-[15px] leading-relaxed text-gray-700">
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              You must be at least 18 years old, or using the Services under the supervision of a
              parent or guardian, to create an account or place an order.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              You are responsible for keeping your account credentials confidential and for all
              activity that occurs under your account.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2A3182]"></span>
              You agree to provide accurate, current information — for your account, delivery
              address, and any prescription details you upload.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Orders & Pricing</h2>
          <ul className="space-y-3 text-[15px] leading-relaxed text-gray-700">
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              All prices are listed in Kenyan Shillings (KES) and are subject to change without
              notice. The price charged is the price shown at the time your order is placed.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              Placing an order is an offer to purchase; a contract is formed only once we confirm
              and process your order. We may decline or cancel an order — for example if an item is
              out of stock, if there is a pricing error, or if we suspect fraud — and will refund
              any payment already taken in that case.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
              Product photography is representative; actual frame colour may vary slightly by screen
              and lighting.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Payment</h2>
          <p className="mb-4 text-[15px] leading-relaxed text-gray-700">
            We accept payment via <strong>M-Pesa</strong> and{' '}
            <strong>card/mobile payment through Pesapal</strong>. We do not currently offer cash on
            delivery. Payment is processed by our licensed payment partners; we do not store your
            full card number or M-Pesa PIN on our servers.
          </p>
          <p className="text-[15px] leading-relaxed text-gray-700">
            An order is fulfilled only once payment is confirmed. If a payment fails or is not
            confirmed within a reasonable time, your order may be cancelled and any stock reserved
            for it released.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Prescription Accuracy</h2>
          <div className="space-y-3 rounded-[20px] bg-[#f8f9fa] p-6 text-[15px] leading-relaxed text-gray-700">
            <p>
              When you order prescription lenses, you are responsible for the accuracy of the
              prescription details you provide or upload, including sphere, cylinder, axis and
              pupillary distance (PD). We recommend using a prescription that is less than 12 months
              old.
            </p>
            <p>
              We fabricate lenses to the prescription supplied. If you are unsure about any value,
              please book an eye test at one of our branches rather than guess — see{' '}
              <Link href="/appointments" className="font-semibold text-[#2A3182] hover:underline">
                Book an Appointment
              </Link>
              .
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">
            Delivery, Returns & Warranty
          </h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            Delivery timelines, our return policy, and our product warranty are set out in full on
            their own pages, which form part of these Terms:{' '}
            <Link href="/delivery" className="font-semibold text-[#2A3182] hover:underline">
              Delivery Policy
            </Link>
            ,{' '}
            <Link href="/returns" className="font-semibold text-[#2A3182] hover:underline">
              Returns Policy
            </Link>
            , and{' '}
            <Link href="/warranty" className="font-semibold text-[#2A3182] hover:underline">
              Warranty Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Reviews & User Content</h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            If you submit a product review or other content, you confirm it is your own genuine
            experience, is not misleading, defamatory, or unlawful, and you grant us a non-exclusive
            licence to display it on the Services. We may moderate, decline to publish, or remove
            content that does not meet these standards.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Intellectual Property</h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            The Optex Opticians name, logo, website design, and content are our property or that of
            our licensors, and are protected by Kenyan and international intellectual property law.
            You may not reproduce, distribute, or create derivative works from our content without
            our prior written consent.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Limitation of Liability</h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            To the fullest extent permitted by Kenyan law, Optex Opticians is not liable for
            indirect or consequential loss arising from your use of the Services. Nothing in these
            Terms limits any liability that cannot lawfully be limited, including liability for
            death or personal injury caused by our negligence, or for fraud.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Governing Law</h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            These Terms are governed by the laws of Kenya. Any dispute arising from these Terms or
            your use of the Services is subject to the exclusive jurisdiction of the courts of
            Kenya.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Changes to These Terms</h2>
          <p className="text-[15px] leading-relaxed text-gray-700">
            We may update these Terms from time to time. We will notify you of significant changes
            by email or via a notice on our website. The "last updated" date at the top of this page
            reflects the most recent revision. Continued use of the Services after a change takes
            effect constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[22px] font-black text-[#2A3182]">Contact Us</h2>
          <div className="space-y-2 rounded-[20px] border border-[#2A3182]/20 bg-[#2A3182]/5 p-6 text-[15px] text-gray-700">
            <p>Questions about these Terms? Reach us at:</p>
            <p className="font-bold text-[#2A3182]">Optex Opticians</p>
            <p>
              Email: <span className="font-semibold text-[#2A3182]">optexopticals@gmail.com</span>
            </p>
            <p>Phone: +254 700 897 007</p>
            <p>Address: Nairobi CBD, Kenya</p>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-8">
          <p className="text-[14px] text-gray-500">
            See also:{' '}
            <Link href="/privacy" className="font-bold text-[#2A3182] hover:underline">
              Privacy Policy
            </Link>{' '}
            ·{' '}
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
