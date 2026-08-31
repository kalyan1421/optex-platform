'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Route-level error boundary (audit F-10).
 *
 * The storefront had no `error.jsx` anywhere across 25 routes. That mattered
 * more after the catalogue moved to Server Components fetching through the API:
 * a single API hiccup during render dropped the customer onto Next's unstyled
 * default error screen — no branding, no explanation, no route back.
 *
 * Next re-renders the segment with `reset()` available, so the first thing to
 * offer is simply trying again: most failures here are a timed-out fetch rather
 * than a broken page.
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    // The overlay shows this in development; in production it is the only
    // signal that a customer hit this at all, until real error reporting is
    // wired up.
    console.error('[storefront] render error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="mb-3 text-[28px] font-bold leading-tight text-[#1A1A2E]">
        Something went wrong at our end
      </h1>
      <p className="mb-8 text-[15px] leading-relaxed text-gray-600">
        This page didn&apos;t load properly. It&apos;s usually temporary — trying again will often
        fix it.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-[#2E3192] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#232a6e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E3192]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-gray-300 px-6 py-3 text-[15px] font-semibold text-[#1A1A2E] transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E3192]"
        >
          Back to home
        </Link>
      </div>

      <p className="mt-8 text-[13px] text-gray-500">
        Still stuck? Call us on{' '}
        <a className="underline" href="tel:+254700897007">
          +254 700 897 007
        </a>{' '}
        or{' '}
        <Link className="underline" href="/contact">
          send us a message
        </Link>
        .
      </p>

      {/* The digest is what support needs to find this in the logs; it is a
          random id, not a leak of internals. */}
      {error?.digest ? (
        <p className="mt-4 font-mono text-[12px] text-gray-400">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
