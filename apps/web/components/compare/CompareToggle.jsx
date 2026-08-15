'use client';

import React from 'react';
import { useCompare } from '@/context/CompareContext';

/**
 * Small "add to comparison" toggle for a product card. `product` needs at
 * least `id`, `slug`, `name`, `price_kes`; `image` is the already-resolved
 * display URL (callers already compute this for the card itself via
 * `getProductImageUrl`, so it isn't re-resolved here).
 */
export default function CompareToggle({ product, image, className = '' }) {
  const { toggle, isCompared } = useCompare();
  const compared = isCompared(product.id);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle({ ...product, image });
      }}
      aria-pressed={compared}
      aria-label={
        compared ? `Remove ${product.name} from comparison` : `Add ${product.name} to comparison`
      }
      title={compared ? 'Remove from comparison' : 'Add to comparison'}
      className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
        compared
          ? 'border-[#2A3182] bg-[#2A3182] text-white'
          : 'border-[#D4D4D4] bg-white text-[#717182] hover:border-[#2A3182] hover:text-[#2A3182]'
      } ${className}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="3" y="3" width="14" height="14" rx="4" stroke="currentColor" strokeWidth="1.4" />
        {compared && (
          <path
            d="M6.5 10.2l2.3 2.3 4.7-4.9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
}
