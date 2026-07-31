'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';
import { useCart } from '@/context/CartContext';

// ── Icons ──────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const GridIcon = () => (
  <svg
    className="h-5 w-5 text-[#2A3182]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
    />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const XIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ── Skeleton Card ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-[25px] border border-[#ddd] bg-white p-2.5">
      <div className="mb-3 aspect-square rounded-[20px] bg-gray-200" />
      <div className="space-y-2 p-2">
        <div className="h-4 w-3/4 rounded-full bg-gray-200" />
        <div className="h-3 w-full rounded-full bg-gray-100" />
        <div className="h-3 w-2/3 rounded-full bg-gray-100" />
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-2">
          <div className="h-5 w-1/3 rounded-full bg-gray-200" />
          <div className="h-8 w-1/4 rounded-full bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

// ── Product Card (mirrors shop page style) ─────────────────────────────────

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
        <Link href={`/product/${product.slug}`}>
          <img
            src={getProductImageUrl(product)}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
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

// ── Inner search component (uses useSearchParams) ──────────────────────────

function SearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';

  const [inputValue, setInputValue] = useState(q);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const db = createBrowserSupabase();
      const results = await listProducts(db, { search: query.trim(), limit: 40 });
      setProducts(results ?? []);
    } catch (err) {
      console.error('Search error:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setInputValue(q);
    runSearch(q);
  }, [q, runSearch]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function clearSearch() {
    setInputValue('');
    router.push('/search');
  }

  const hasQuery = q.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-16 sm:pb-24">
      {/* Hero search banner */}
      <section className="bg-[#2A3182] py-12 sm:py-16">
        <div className="site-container">
          <div className="mb-4 flex items-center gap-3">
            <GridIcon />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
              Product Search
            </span>
          </div>
          <h1 className="mb-8 text-[32px] font-black leading-tight text-white sm:text-[42px]">
            {hasQuery ? (
              <>
                Find: <span className="text-[#E53935]">&quot;{q}&quot;</span>
              </>
            ) : (
              'Search Products'
            )}
          </h1>

          {/* Search form */}
          <form onSubmit={handleSubmit} className="relative max-w-2xl">
            <div className="flex items-center overflow-hidden rounded-2xl border-2 border-white/20 bg-white shadow-xl transition-colors focus-within:border-[#E53935]">
              <div className="flex-shrink-0 pl-5 pr-2 text-gray-400">
                <SearchIcon />
              </div>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search frames, sunglasses, brands…"
                autoFocus={!hasQuery}
                className="flex-1 bg-transparent px-3 py-4 text-[16px] font-medium text-[#1a1a1a] placeholder-gray-300 outline-none"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="flex-shrink-0 px-3 text-gray-300 transition-colors hover:text-gray-500"
                  aria-label="Clear search"
                >
                  <XIcon />
                </button>
              )}
              <button
                type="submit"
                className="flex flex-shrink-0 items-center gap-2 bg-[#E53935] px-6 py-4 text-[14px] font-bold text-white transition-colors hover:bg-red-600"
              >
                Search
                <ArrowRightIcon />
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Results area */}
      <div className="site-container pt-10">
        {/* No query state */}
        {!hasQuery && !loading && (
          <div className="py-20 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-300 shadow-sm">
              <SearchIcon />
            </div>
            <h2 className="mb-3 text-[22px] font-black text-[#1a1a1a]">
              What are you looking for?
            </h2>
            <p className="mx-auto mb-8 max-w-sm text-[14px] font-medium text-gray-400">
              Type in the search box above to find frames, sunglasses, or brands from our
              collection.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-[#2A3182] px-6 py-3 text-[13px] font-bold text-white shadow-md shadow-[#2A3182]/20 transition-colors hover:bg-[#1e2461]"
            >
              Browse All Products
              <ArrowRightIcon />
            </Link>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <>
            <div className="mb-6">
              <div className="h-4 w-40 animate-pulse rounded-full bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </>
        )}

        {/* Results */}
        {!loading && hasQuery && products.length > 0 && (
          <>
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-[12px] font-bold uppercase tracking-widest text-gray-400">
                <span className="text-[16px] font-black text-[#2A3182]">{products.length}</span>{' '}
                result{products.length !== 1 ? 's' : ''} for{' '}
                <span className="text-[#1a1a1a]">&quot;{q}&quot;</span>
              </p>
              <Link
                href="/shop"
                className="text-[12px] font-bold uppercase tracking-widest text-[#2A3182] hover:underline"
              >
                View All Products
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && hasQuery && products.length === 0 && (
          <div className="py-20 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-200 shadow-sm">
              <SearchIcon />
            </div>
            <h2 className="mb-3 text-[22px] font-black text-[#1a1a1a]">
              No results for &quot;{q}&quot;
            </h2>
            <p className="mx-auto mb-8 max-w-sm text-[14px] font-medium text-gray-400">
              We couldn&apos;t find any products matching your search. Try different keywords or
              browse our full collection.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-[#2A3182] px-6 py-3 text-[13px] font-bold text-white shadow-md shadow-[#2A3182]/20 transition-colors hover:bg-[#1e2461]"
            >
              Browse All Products
              <ArrowRightIcon />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap in Suspense because useSearchParams requires it in Next.js 14 app router
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2A3182] border-t-transparent" />
        </div>
      }
    >
      <SearchInner />
    </Suspense>
  );
}
