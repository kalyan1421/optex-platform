'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWishlist } from '@/context/WishlistContext';

/**
 * Heart toggle for a product.
 *
 * Logged-out visitors are sent to /login with a `next` param so they come back
 * to where they were instead of the homepage.
 *
 * `variant="icon"` is the floating circle used on product cards;
 * `variant="inline"` is the labelled button used on the product detail page.
 */
export default function WishlistButton({ productId, variant = 'icon', className = '' }) {
  const router = useRouter();
  const { isWishlisted, toggle } = useWishlist();
  const [busy, setBusy] = useState(false);

  const active = isWishlisted(productId);

  async function onClick(event) {
    // Cards wrap these in a Link — don't navigate to the PDP on a heart click.
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;

    setBusy(true);
    try {
      const result = await toggle(productId);
      if (result?.requiresLogin) {
        const next = typeof window !== 'undefined' ? window.location.pathname : '/';
        router.push(`/login?next=${encodeURIComponent(next)}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const label = active ? 'Remove from wishlist' : 'Save to wishlist';

  const heart = (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={active ? '#E53935' : 'none'}
      stroke={active ? '#E53935' : 'currentColor'}
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={active}
        aria-label={label}
        title={label}
        className={`flex items-center justify-center gap-2 rounded-full border-2 px-6 py-3 text-[13px] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182] focus-visible:ring-offset-2 disabled:opacity-60 ${
          active
            ? 'border-[#E53935] text-[#E53935]'
            : 'border-gray-200 text-gray-700 hover:border-gray-400'
        } ${className}`}
      >
        {heart}
        <span>{active ? 'Saved' : 'Wishlist'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-gray-600 shadow-md transition-all hover:scale-105 hover:text-[#E53935] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182] disabled:opacity-60 ${className}`}
    >
      {heart}
    </button>
  );
}
