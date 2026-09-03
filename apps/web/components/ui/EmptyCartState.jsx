import Link from 'next/link';

/**
 * The "nothing to act on" panel for an empty cart — a single centered card
 * with one obvious way forward, rather than the full cart/checkout layout
 * rendered around zero items (a promo box with nothing to discount, an order
 * summary of KSH 0.00, a payment step for a KSH 0.00 order).
 *
 * Originally built for `/cart` only; `/checkout` had no equivalent, so a
 * customer who reached checkout with an empty cart (a stale tab, a cleared
 * cart in another tab, a bookmark) still saw the full three-step shipping
 * form — fillable, but leading nowhere, since `handlePlaceOrder` refuses an
 * empty cart anyway. Pulled out here so both pages show the same short-circuit
 * instead of the guard living in one and not the other.
 */
export default function EmptyCartState({
  title = 'Shopping Cart',
  heading = 'Your cart is empty',
  description = 'Nothing here yet. Browse the collection, or book an eye test and let an optometrist help you choose.',
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-[1440px] px-6 pb-[100px] pt-[20px] lg:px-[100px]">
        <h1
          className="m-0 mb-[27px] text-[#141776]"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: '36px',
            lineHeight: '46.8px',
            fontWeight: 700,
          }}
        >
          {title}
        </h1>

        <div className="mx-auto flex max-w-[736px] flex-col items-center rounded-[36px] border-[1.13px] border-[rgba(199,197,212,0.3)] bg-white px-6 py-[72px] text-center">
          <div className="mb-[24px] flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#F3F3F6]">
            <svg
              className="h-[40px] w-[40px] text-[#141776]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z"
              />
            </svg>
          </div>

          <h2
            className="m-0 mb-[9px] text-[#141776]"
            style={{ fontFamily: 'Poppins, sans-serif', fontSize: '27px', fontWeight: 700 }}
          >
            {heading}
          </h2>
          <p
            className="m-0 mb-[32px] max-w-[420px] text-[#464652]"
            style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', lineHeight: '27px' }}
          >
            {description}
          </p>

          <div className="flex flex-col items-center gap-[16px] sm:flex-row">
            <Link
              href="/shop"
              className="flex h-[54px] items-center justify-center rounded-[26843500px] bg-[#141776] px-[36px] text-white transition-colors hover:bg-[#2A3182]"
              style={{ fontFamily: 'Manrope, sans-serif', fontSize: '16px', fontWeight: 700 }}
            >
              Browse the collection
            </Link>
            <Link
              href="/appointments"
              className="flex h-[54px] items-center justify-center rounded-[26843500px] border-[1.13px] border-[#C7C5D4] px-[36px] text-[#141776] transition-colors hover:bg-[#F3F3F6]"
              style={{ fontFamily: 'Manrope, sans-serif', fontSize: '16px', fontWeight: 700 }}
            >
              Book an eye test
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
