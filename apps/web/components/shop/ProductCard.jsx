'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';
import WishlistButton from '@/components/WishlistButton';

/**
 * Shared product card for the shop grid, category pages and search results.
 *
 * These three surfaces previously each carried their own near-identical copy of
 * this markup, so a fix (the wishlist heart, an out-of-stock badge) had to be
 * made three times or silently missed two.
 *
 * `facet` carries the stock/popularity row from the product_facets view when
 * the caller has it; without it the card just omits the availability badge
 * rather than guessing.
 */
export default function ProductCard({ product, facet, index = 0 }) {
  const { addToCart } = useCart();
  const outOfStock = facet ? !facet.in_stock : false;

  return (
    <div
      data-aos="fade-up"
      data-aos-delay={Math.min(index, 8) * 50}
      className="group flex flex-col rounded-[25px] border border-[#ddd] bg-white p-2.5 transition-all duration-500 hover:shadow-xl"
    >
      <div className="relative aspect-square overflow-hidden rounded-[20px] bg-[#f8f9fa]">
        <div className="absolute left-3 top-3 z-10">
          <WishlistButton productId={product.id} />
        </div>

        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
          <div className="rounded-full border border-[#ddd] bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur-sm">
            <span className="text-[9px] font-black uppercase tracking-tighter text-[#2A3182]">
              {product.frame_shape ?? product.brand}
            </span>
          </div>
          {outOfStock && (
            <div className="rounded-full bg-[#1a1a1a]/85 px-2.5 py-1 shadow-sm">
              <span className="text-[9px] font-black uppercase tracking-tighter text-white">
                Out of stock
              </span>
            </div>
          )}
        </div>

        <Link href={`/product/${product.slug}`} tabIndex={-1} aria-hidden="true">
          <img
            src={getProductImageUrl(product)}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 ${
              outOfStock ? 'opacity-60' : ''
            }`}
          />
        </Link>
      </div>

      <div className="flex flex-1 flex-col p-4 pt-4">
        <div className="mb-1 flex items-start justify-between gap-3">
          <Link href={`/product/${product.slug}`}>
            <h3 className="text-[16px] font-bold leading-tight text-gray-900 transition-colors group-hover:text-[#2A3182]">
              {product.name}
            </h3>
          </Link>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-gray-300">
            {product.brand}
          </span>
        </div>

        <p className="mb-4 line-clamp-2 flex-1 text-[12px] leading-relaxed text-gray-400">
          {product.description}
        </p>

        <div className="flex items-center justify-between gap-3 border-t border-[#ddd] pt-2">
          <p className="text-[18px] font-black tracking-tight text-[#2A3182]">
            {formatKes(Number(product.price_kes))}
          </p>
          <button
            type="button"
            disabled={outOfStock}
            onClick={() =>
              addToCart({
                id: product.id,
                title: product.name,
                price: String(product.price_kes),
                image: getProductImageUrl(product),
                brand: product.brand ?? '',
                quantity: 1,
              })
            }
            className="whitespace-nowrap rounded-full bg-[#EF4444] px-4 py-2 text-[11px] font-bold text-white shadow-md transition-all hover:bg-red-600 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
          >
            {outOfStock ? 'Unavailable' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Matching skeleton so the grid does not jump when results land. */
export function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col rounded-[25px] border border-[#ddd] bg-white p-2.5"
    >
      <div className="aspect-square animate-pulse rounded-[20px] bg-gray-100" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}
