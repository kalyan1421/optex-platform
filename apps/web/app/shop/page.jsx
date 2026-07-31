'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts, listCategories } from '@optex/db';
import ProductFilters from '@/components/shop/ProductFilters';
import ProductCard, { ProductCardSkeleton } from '@/components/shop/ProductCard';

const PAGE_SIZE = 9;

const SORTS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

/** Multi-select filters are carried in the URL as repeated params. */
const MULTI_KEYS = ['category', 'brand', 'gender', 'shape', 'material'];

function readFilters(params) {
  const selected = {};
  for (const key of MULTI_KEYS) selected[key] = params.getAll(key);
  return {
    ...selected,
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    inStockOnly: params.get('inStock') === '1',
    sort: params.get('sort') ?? 'newest',
    page: Math.max(1, Number(params.get('page') ?? 1) || 1),
  };
}

function Shop() {
  const router = useRouter();
  const params = useSearchParams();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [facetsById, setFacetsById] = useState({});
  const [state, setState] = useState('loading'); // loading | ready | error

  // Filter state lives in the URL so a filtered grid is shareable, survives a
  // refresh, and works with the browser back button.
  const selected = readFilters(params);

  useEffect(() => {
    let active = true;
    const db = createBrowserSupabase();
    setState('loading');

    Promise.all([
      listProducts(db, { limit: 500 }),
      listCategories(db),
      db.from('product_facets').select('product_id, in_stock, total_stock, units_sold'),
    ])
      .then(([prods, cats, facetRes]) => {
        if (!active) return;
        if (facetRes.error) throw facetRes.error;
        setProducts(prods);
        setCategories(cats);
        setFacetsById(
          Object.fromEntries((facetRes.data ?? []).map((f) => [f.product_id, f])),
        );
        setState('ready');
      })
      .catch((err) => {
        console.error('Shop load error:', err);
        if (active) setState('error');
      });

    return () => {
      active = false;
    };
  }, []);

  /** Rewrite the query string; any filter change resets to page 1. */
  const applyParams = useCallback(
    (mutate) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      if (!next.has('__keepPage')) next.delete('page');
      next.delete('__keepPage');
      const qs = next.toString();
      router.replace(qs ? `/shop?${qs}` : '/shop', { scroll: false });
    },
    [params, router],
  );

  const onToggle = useCallback(
    (key, value) =>
      applyParams((next) => {
        const current = next.getAll(key);
        next.delete(key);
        const remaining = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        remaining.forEach((v) => next.append(key, v));
      }),
    [applyParams],
  );

  const onPriceChange = useCallback(
    (key, value) =>
      applyParams((next) => {
        if (value === '') next.delete(key);
        else next.set(key, value);
      }),
    [applyParams],
  );

  const onAvailabilityChange = useCallback(
    (checked) =>
      applyParams((next) => {
        if (checked) next.set('inStock', '1');
        else next.delete('inStock');
      }),
    [applyParams],
  );

  const onSortChange = useCallback(
    (value) => applyParams((next) => next.set('sort', value)),
    [applyParams],
  );

  const onReset = useCallback(() => router.replace('/shop', { scroll: false }), [router]);

  const goToPage = useCallback(
    (page) =>
      applyParams((next) => {
        next.set('page', String(page));
        next.set('__keepPage', '1');
      }),
    [applyParams],
  );

  /** Facet options, derived from the catalogue rather than hardcoded. */
  const facetOptions = useMemo(() => {
    const distinct = (key) =>
      Array.from(new Set(products.map((p) => p[key]).filter(Boolean))).sort();
    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        count: products.filter((p) => p.category_id === c.id).length,
      })),
      brands: distinct('brand'),
      genders: distinct('gender'),
      shapes: distinct('frame_shape'),
      materials: distinct('frame_material'),
    };
  }, [products, categories]);

  // All filters are AND-ed across groups and OR-ed within a group, which is
  // what shoppers expect: "Optex OR Ray-Ban" AND "in stock".
  const filtered = useMemo(() => {
    const min = selected.minPrice === '' ? null : Number(selected.minPrice);
    const max = selected.maxPrice === '' ? null : Number(selected.maxPrice);

    return products.filter((p) => {
      if (selected.category.length && !selected.category.includes(p.category_id)) return false;
      if (selected.brand.length && !selected.brand.includes(p.brand)) return false;
      if (selected.gender.length && !selected.gender.includes(p.gender)) return false;
      if (selected.shape.length && !selected.shape.includes(p.frame_shape)) return false;
      if (selected.material.length && !selected.material.includes(p.frame_material)) return false;

      const price = Number(p.price_kes);
      if (min !== null && !Number.isNaN(min) && price < min) return false;
      if (max !== null && !Number.isNaN(max) && price > max) return false;

      if (selected.inStockOnly && !facetsById[p.id]?.in_stock) return false;
      return true;
    });
  }, [products, selected, facetsById]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    switch (selected.sort) {
      case 'price-asc':
        return copy.sort((a, b) => Number(a.price_kes) - Number(b.price_kes));
      case 'price-desc':
        return copy.sort((a, b) => Number(b.price_kes) - Number(a.price_kes));
      case 'popularity':
        return copy.sort(
          (a, b) =>
            Number(facetsById[b.id]?.units_sold ?? 0) - Number(facetsById[a.id]?.units_sold ?? 0),
        );
      default:
        return copy.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    }
  }, [filtered, selected.sort, facetsById]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(selected.page, totalPages);
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCount =
    MULTI_KEYS.reduce((n, k) => n + selected[k].length, 0) +
    (selected.minPrice ? 1 : 0) +
    (selected.maxPrice ? 1 : 0) +
    (selected.inStockOnly ? 1 : 0);

  return (
    <div className="min-h-screen bg-white">
      <section className="relative flex h-[320px] items-center justify-center overflow-hidden sm:h-[360px] lg:h-[400px]">
        <div
          className="absolute inset-0 z-0 scale-105 bg-cover bg-center"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=2070&auto=format)',
          }}
        >
          <div className="absolute inset-0 bg-[#2A3182]/70 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/80 to-transparent" />
        </div>
        <div data-aos="fade-up" className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="mb-4 text-[36px] font-black tracking-tight text-white drop-shadow-2xl sm:text-[46px] md:text-[60px]">
            Our Collection
          </h1>
          <p className="mx-auto max-w-lg text-[14px] font-medium leading-relaxed text-white/90 drop-shadow-lg sm:text-[16px] md:text-[18px]">
            Browse through our extensive range of premium eyewear, from classic frames to modern
            sunglasses.
          </p>
        </div>
      </section>

      <main className="page-container py-12 sm:py-14">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <aside
            aria-label="Product filters"
            className="w-full flex-shrink-0 lg:sticky lg:h-fit lg:max-h-[calc(100vh-130px)] lg:w-[240px] lg:self-start lg:overflow-y-auto lg:pr-2"
            style={{ top: '130px' }}
          >
            <ProductFilters
              facets={facetOptions}
              selected={selected}
              onToggle={onToggle}
              onPriceChange={onPriceChange}
              onAvailabilityChange={onAvailabilityChange}
              onReset={onReset}
              activeCount={activeCount}
            />
          </aside>

          <section className="min-w-0 flex-1">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p
                aria-live="polite"
                className="text-[12px] font-bold uppercase tracking-widest text-gray-400 sm:text-[13px]"
              >
                {state === 'loading'
                  ? 'Loading products…'
                  : `Showing ${visible.length} of ${sorted.length} product${sorted.length === 1 ? '' : 's'}`}
              </p>
              <div className="w-full sm:w-auto">
                <label htmlFor="sort" className="sr-only">
                  Sort products
                </label>
                <select
                  id="sort"
                  value={selected.sort}
                  onChange={(e) => onSortChange(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-gray-100 px-3 py-2 text-[12px] font-bold text-gray-500 outline-none focus:border-[#2A3182] sm:w-auto"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {state === 'error' ? (
              <div
                role="alert"
                className="rounded-[25px] border border-red-100 bg-red-50 px-6 py-14 text-center"
              >
                <h2 className="text-[18px] font-bold text-red-700">We could not load the catalogue</h2>
                <p className="mt-2 text-[14px] text-red-600">
                  Something went wrong on our side. Please try again.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-6 rounded-full bg-[#2A3182] px-7 py-2.5 text-[13px] font-bold text-white hover:bg-[#1f2666]"
                >
                  Retry
                </button>
              </div>
            ) : state === 'loading' ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="rounded-[25px] border border-gray-100 bg-[#f8f9fb] px-6 py-16 text-center">
                <h2 className="text-[19px] font-bold text-gray-900">No frames match those filters</h2>
                <p className="mx-auto mt-2 max-w-sm text-[14px] text-gray-500">
                  Try widening your price range or clearing a filter or two.
                </p>
                <button
                  type="button"
                  onClick={onReset}
                  className="mt-6 rounded-full bg-[#2A3182] px-7 py-2.5 text-[13px] font-bold text-white hover:bg-[#1f2666]"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {visible.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      facet={facetsById[product.id]}
                      index={index}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav
                    aria-label="Pagination"
                    className="mt-12 flex items-center justify-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => goToPage(page - 1)}
                      disabled={page === 1}
                      className="rounded-full border border-gray-200 px-4 py-2 text-[13px] font-bold text-gray-600 transition-colors hover:border-[#2A3182] hover:text-[#2A3182] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => goToPage(i + 1)}
                        aria-current={page === i + 1 ? 'page' : undefined}
                        className={`h-9 w-9 rounded-full text-[13px] font-bold transition-colors ${
                          page === i + 1
                            ? 'bg-[#2A3182] text-white'
                            : 'border border-gray-200 text-gray-600 hover:border-[#2A3182] hover:text-[#2A3182]'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => goToPage(page + 1)}
                      disabled={page === totalPages}
                      className="rounded-full border border-gray-200 px-4 py-2 text-[13px] font-bold text-gray-600 transition-colors hover:border-[#2A3182] hover:text-[#2A3182] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  // useSearchParams() requires a Suspense boundary for the production build.
  return (
    <Suspense
      fallback={
        <div className="page-container py-24">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <Shop />
    </Suspense>
  );
}
