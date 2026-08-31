import Link from 'next/link';

/**
 * 404 page (audit F-10).
 *
 * Reached by a bad URL and — more often — by `notFound()` from the product and
 * category pages when a slug does not resolve. Before this, both landed on
 * Next's default 404, which is unbranded and offers nothing but a dead end.
 *
 * A missing product is a shopping intent that has not failed yet, so the useful
 * response is a route back into the catalogue rather than an apology.
 */
export const metadata = {
  title: 'Page not found — Optex Opticians',
  // A soft-404 that gets indexed competes with the real pages.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center px-6 py-20 text-center">
      <p className="mb-2 font-mono text-[13px] uppercase tracking-[0.14em] text-gray-400">
        Error 404
      </p>
      <h1 className="mb-3 text-[28px] font-bold leading-tight text-[#1A1A2E]">
        We couldn&apos;t find that page
      </h1>
      <p className="mb-8 text-[15px] leading-relaxed text-gray-600">
        The link may be out of date, or the frame you were looking at is no longer stocked.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/shop"
          className="rounded-md bg-[#2E3192] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#232a6e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E3192]"
        >
          Browse all frames
        </Link>
        <Link
          href="/"
          className="rounded-md border border-gray-300 px-6 py-3 text-[15px] font-semibold text-[#1A1A2E] transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E3192]"
        >
          Back to home
        </Link>
      </div>

      <p className="mt-8 text-[13px] text-gray-500">
        Looking for something specific?{' '}
        <Link className="underline" href="/search">
          Search the catalogue
        </Link>{' '}
        or{' '}
        <Link className="underline" href="/branch-locator">
          visit a branch
        </Link>
        .
      </p>
    </div>
  );
}
