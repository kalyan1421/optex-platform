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
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const GridIcon = () => (
  <svg className="w-5 h-5 text-[#2A3182]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ── Skeleton Card ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-[25px] border border-[#ddd] bg-white p-2.5 animate-pulse">
      <div className="aspect-square rounded-[20px] bg-gray-200 mb-3" />
      <div className="p-2 space-y-2">
        <div className="h-4 bg-gray-200 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 rounded-full w-full" />
        <div className="h-3 bg-gray-100 rounded-full w-2/3" />
        <div className="flex items-center justify-between mt-4 pt-2 border-t border-gray-100">
          <div className="h-5 bg-gray-200 rounded-full w-1/3" />
          <div className="h-8 bg-gray-100 rounded-full w-1/4" />
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
      <div className="relative aspect-square rounded-[20px] overflow-hidden bg-[#f8f9fa]">
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm border border-[#ddd]">
            <span className="text-[9px] font-black text-[#2A3182] uppercase tracking-tighter">
              {product.frame_shape ?? product.brand}
            </span>
          </div>
        </div>
        <Link href={`/product/${product.slug}`}>
          <img
            src={getProductImageUrl(product)}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        </Link>
      </div>
      <div className="flex flex-1 flex-col p-4 pt-4">
        <div className="mb-1 flex items-start justify-between gap-3">
          <Link href={`/product/${product.slug}`}>
            <h3 className="text-[16px] font-bold text-gray-900 group-hover:text-[#2A3182] transition-colors leading-tight">
              {product.name}
            </h3>
          </Link>
          <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-1">
            {product.brand}
          </span>
        </div>
        <p className="text-[12px] text-gray-400 line-clamp-2 mb-4 leading-relaxed flex-1">
          {product.description}
        </p>
        <div className="flex items-center justify-between gap-3 border-t border-[#ddd] pt-2">
          <p className="text-[18px] font-black text-[#2A3182] tracking-tight">
            {formatKes(Number(product.price_kes))}
          </p>
          <button
            onClick={() => addToCart({
              id: product.id,
              title: product.name,
              price: String(product.price_kes),
              image: getProductImageUrl(product),
              quantity: 1,
            })}
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
          <div className="flex items-center gap-3 mb-4">
            <GridIcon />
            <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase">Product Search</span>
          </div>
          <h1 className="text-[32px] sm:text-[42px] font-black text-white leading-tight mb-8">
            {hasQuery ? (
              <>Find: <span className="text-[#E53935]">&quot;{q}&quot;</span></>
            ) : (
              'Search Products'
            )}
          </h1>

          {/* Search form */}
          <form onSubmit={handleSubmit} className="relative max-w-2xl">
            <div className="flex items-center bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-white/20 focus-within:border-[#E53935] transition-colors">
              <div className="pl-5 pr-2 text-gray-400 flex-shrink-0">
                <SearchIcon />
              </div>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search frames, sunglasses, brands…"
                autoFocus={!hasQuery}
                className="flex-1 py-4 px-3 text-[16px] font-medium text-[#1a1a1a] placeholder-gray-300 outline-none bg-transparent"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="px-3 text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
                  aria-label="Clear search"
                >
                  <XIcon />
                </button>
              )}
              <button
                type="submit"
                className="bg-[#E53935] text-white px-6 py-4 text-[14px] font-bold hover:bg-red-600 transition-colors flex-shrink-0 flex items-center gap-2"
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
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-white border border-gray-100 flex items-center justify-center mx-auto mb-6 shadow-sm text-gray-300">
              <SearchIcon />
            </div>
            <h2 className="text-[22px] font-black text-[#1a1a1a] mb-3">What are you looking for?</h2>
            <p className="text-[14px] text-gray-400 font-medium mb-8 max-w-sm mx-auto">
              Type in the search box above to find frames, sunglasses, or brands from our collection.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-[#2A3182] text-white px-6 py-3 rounded-full text-[13px] font-bold hover:bg-[#1e2461] transition-colors shadow-md shadow-[#2A3182]/20"
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
              <div className="h-4 bg-gray-200 rounded-full w-40 animate-pulse" />
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
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[12px] font-bold uppercase tracking-widest text-gray-400">
                <span className="text-[#2A3182] text-[16px] font-black">{products.length}</span>
                {' '}result{products.length !== 1 ? 's' : ''} for{' '}
                <span className="text-[#1a1a1a]">&quot;{q}&quot;</span>
              </p>
              <Link
                href="/shop"
                className="text-[12px] font-bold text-[#2A3182] hover:underline uppercase tracking-widest"
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
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-white border border-gray-100 flex items-center justify-center mx-auto mb-6 shadow-sm text-gray-200">
              <SearchIcon />
            </div>
            <h2 className="text-[22px] font-black text-[#1a1a1a] mb-3">No results for &quot;{q}&quot;</h2>
            <p className="text-[14px] text-gray-400 font-medium mb-8 max-w-sm mx-auto">
              We couldn&apos;t find any products matching your search. Try different keywords or browse our full collection.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-[#2A3182] text-white px-6 py-3 rounded-full text-[13px] font-bold hover:bg-[#1e2461] transition-colors shadow-md shadow-[#2A3182]/20"
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
    <Suspense fallback={
      <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-[#2A3182] border-t-transparent animate-spin" />
      </div>
    }>
      <SearchInner />
    </Suspense>
  );
}
