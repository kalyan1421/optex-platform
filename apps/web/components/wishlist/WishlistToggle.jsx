'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWishlist } from '@/context/WishlistContext';

/**
 * Heart toggle for a product (SPEC-10 R4). `variant="icon"` is the floating
 * circle used on product cards; `variant="inline"` is the labelled button
 * used on the product detail page.
 *
 * A signed-out click redirects to login with a return path back to the
 * current page (R5) — the click itself is never silently dropped.
 */
export default function WishlistToggle({ productId, variant = 'icon', className = '' }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSaved, toggle } = useWishlist();
  const [busy, setBusy] = useState(false);

  const active = isSaved(productId);

  async function handleClick(e) {
    // Cards wrap this in a Link to the PDP — don't navigate on a heart click.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    setBusy(true);
    try {
      const result = await toggle(productId);
      if (result?.requiresLogin) {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const label = active ? 'Remove from wishlist' : 'Save to wishlist';

  const heart = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={active ? '#E53935' : 'none'}
      aria-hidden="true"
    >
      <path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke={active ? '#E53935' : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-pressed={active}
        aria-label={label}
        title={label}
        className={`flex items-center justify-center gap-2 rounded-full border-2 px-6 py-3 text-[13px] font-bold transition-all disabled:opacity-60 ${
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
      onClick={handleClick}
      disabled={busy}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-gray-600 shadow-md transition-all hover:scale-105 hover:text-[#E53935] disabled:opacity-60 ${className}`}
    >
      {heart}
    </button>
  );
}
