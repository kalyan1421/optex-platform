'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';
import StarRating from '@/components/ui/StarRating';
import WishlistToggle from '@/components/wishlist/WishlistToggle';
import {
  useProductFacets,
  ProductFilterSidebar,
  SortSelect,
  sortProducts,
} from '@/components/shop/ProductFilters';

const SearchIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

function ProductCard({ product }) {
  const { addToCart } = useCart();
  return (
    <div className="group flex flex-col rounded-[25px] border border-[#ddd] bg-white p-2.5 transition-all duration-500 hover:shadow-xl">
      <div className="relative aspect-square overflow-hidden rounded-[20px] bg-[#f8f9fa]">
        <div className="absolute right-3 top-3 z-10">
          <div className="rounded-full border border-[#ddd] bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur-sm">
            <span className="text-[9px] font-black uppercase tracking-tighter text-[#2A3182]">
              {product.frame_shape ?? product.brand}
            </span>
          </div>
        </div>
        <WishlistToggle productId={product.id} className="absolute left-3 top-3 z-10 h-8 w-8" />
        <Link href={`/product/${product.slug}`} className="relative block h-full w-full">
          <Image
            src={getProductImageUrl(product)}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 22vw, 45vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
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
        {/* F-11: rating on the results card — the strongest conversion signal
            in eyewear, previously absent from every listing. */}
        <StarRating rating={product.rating_avg} count={product.rating_count} className="mb-2" />
        <p className="mb-4 line-clamp-2 flex-1 text-[12px] leading-relaxed text-gray-400">
          {product.description}
        </p>
        <div className="flex items-center justify-between gap-3 border-t border-[#ddd] pt-2">
          <p className="text-[18px] font-black tracking-tight text-[#2A3182]">
            {formatKes(Number(product.price_kes))}
          </p>
          <button
            onClick={() =>
              addToCart({
                id: product.id,
                title: product.name,
                price: String(product.price_kes),
                image: getProductImageUrl(product),
                quantity: 1,
              })
            }
            className="whitespace-nowrap rounded-full bg-[#EF4444] px-4 py-2 text-[11px] font-bold text-white shadow-md transition-all hover:bg-red-600 active:scale-95"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The interactive half of /search: facets, sort and add-to-cart, over the
 * results the server already fetched for `query`. Split out so
 * `app/search/page.jsx` can be a Server Component — mirrors `ShopBrowser`'s
 * split for `/shop`.
 *
 * `useProductFacets` is called with no category list — /search has no
 * category rail of its own, so that facet simply does not render.
 */
export default function SearchResults({ products, query }) {
  const [sortBy, setSortBy] = useState('featured');
  const { filtered, activeFilters, clearFilters, sidebarProps } = useProductFacets(products);
  const visible = sortProducts(filtered, sortBy);

  if (products.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-200 shadow-sm">
          <SearchIcon />
        </div>
        <h2 className="mb-3 text-[22px] font-black text-[#1a1a1a]">
          No results for &quot;{query}&quot;
        </h2>
        <p className="mx-auto mb-8 max-w-sm text-[14px] font-medium text-gray-400">
          We couldn&apos;t find any products matching your search. Try different keywords or browse
          our full collection.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-full bg-[#2A3182] px-6 py-3 text-[13px] font-bold text-white shadow-md shadow-[#2A3182]/20 transition-colors hover:bg-[#1e2461]"
        >
          Browse All Products
          <ArrowRightIcon />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:gap-[40px]">
      <ProductFilterSidebar {...sidebarProps} />

      <div className="min-w-0 flex-1">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-[12px] font-bold uppercase tracking-widest text-gray-400">
            <span className="text-[16px] font-black text-[#2A3182]">{visible.length}</span> result
            {visible.length !== 1 ? 's' : ''} for{' '}
            <span className="text-[#1a1a1a]">&quot;{query}&quot;</span>
            {activeFilters > 0 && (
              <span className="normal-case tracking-normal text-gray-400">
                {' '}
                (filtered from {products.length})
              </span>
            )}
          </p>
          <div className="flex items-center gap-4">
            <SortSelect value={sortBy} onChange={setSortBy} />
            <Link
              href="/shop"
              className="whitespace-nowrap text-[12px] font-bold uppercase tracking-widest text-[#2A3182] hover:underline"
            >
              View All Products
            </Link>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center">
            <p className="mb-4 text-[15px] font-semibold text-[#1a1a1a]">
              No results match these filters
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="text-[13px] font-bold uppercase tracking-widest text-[#2A3182] hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
