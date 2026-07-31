'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

/**
 * Badge text derived from real sales rather than the product's position.
 *
 * This used to cycle a fixed ['BEST SELLER','TRENDING','NEW ARRIVAL','HOT']
 * array by index, so whichever product happened to land fourth was labelled
 * "HOT" regardless of whether anyone had ever bought it.
 */
function badgeFor(product, index) {
  const sold = Number(product.units_sold ?? 0);
  if (sold === 0) return 'NEW ARRIVAL';
  if (index === 0) return 'BEST SELLER';
  return 'TRENDING';
}

export default function TrendingNow() {
  const [products, setProducts] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    let active = true;
    const db = createBrowserSupabase();

    // Genuinely trending: ordered by units actually sold (product_facets view,
    // migration 0011), rather than the first four rows the catalogue returns.
    (async () => {
      try {
        const [{ data: facets, error }, all] = await Promise.all([
          db
            .from('product_facets')
            .select('product_id, units_sold')
            .order('units_sold', { ascending: false })
            .limit(4),
          listProducts(db, { limit: 100 }),
        ]);
        if (error) throw error;
        if (!active) return;

        const byId = new Map((all ?? []).map((p) => [p.id, p]));
        const ranked = (facets ?? [])
          .map((f) => {
            const product = byId.get(f.product_id);
            return product ? { ...product, units_sold: Number(f.units_sold ?? 0) } : null;
          })
          .filter(Boolean);
        // Nothing sold yet (a fresh catalogue) — fall back to newest.
        setProducts(
          ranked.length > 0
            ? ranked
            : (all ?? []).slice(0, 4).map((p) => ({ ...p, units_sold: 0 })),
        );
        setState('ready');
      } catch (err) {
        console.error('Trending products error:', err);
        if (active) setState('error');
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (state === 'error' || (state === 'ready' && products.length === 0)) return null;

  return (
    <section className="overflow-hidden bg-white py-16">
      <div className="site-container">
        {/* Header Row */}
        <div
          data-aos="fade-up"
          className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
        >
          <div className="max-w-2xl">
            <h2 className="section-heading mb-4 leading-tight">Trending Now</h2>
            <p className="section-copy font-medium">
              Our most popular designs this season, curated for those who value{' '}
              <br className="hidden lg:block" />
              both style and visual excellence.
            </p>
          </div>
          <div className="pb-2">
            <Link
              href="/shop"
              className="text-brand-blue border-brand-blue group flex items-center gap-2 border-b-[2px] pb-1 text-[16px] font-bold transition-all hover:opacity-80"
            >
              View all products
            </Link>
          </div>
        </div>

        {/* Product Grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {products.map((product, index) => (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                data-aos="fade-up"
                data-aos-delay={index * 100}
                className="group block cursor-pointer"
              >
                <div className="relative mb-5 aspect-square overflow-hidden rounded-[28px] shadow-sm transition-all duration-500 hover:shadow-xl sm:mb-6 sm:rounded-[34px]">
                  <div className="absolute left-6 top-6 z-10">
                    <span className="bg-brand-red rounded-xl px-4 py-2 text-[10px] font-black tracking-wider text-white shadow-lg sm:text-[11px]">
                      {badgeFor(product, index)}
                    </span>
                  </div>
                  <div className="h-full w-full">
                    <img
                      src={getProductImageUrl(product)}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>
                </div>
                <div className="px-2">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
                    {product.brand || '—'}
                  </p>
                  <h3 className="text-brand-dark group-hover:text-brand-blue mb-1 text-[18px] font-black leading-tight transition-colors sm:text-[20px]">
                    {product.name}
                  </h3>
                  <p className="text-brand-blue text-[18px] font-black">
                    {formatKes(Number(product.price_kes))}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="mb-5 aspect-square rounded-[28px] bg-gray-100" />
                <div className="mb-2 h-3 w-1/3 rounded bg-gray-100" />
                <div className="mb-2 h-5 w-2/3 rounded bg-gray-100" />
                <div className="h-5 w-1/2 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
