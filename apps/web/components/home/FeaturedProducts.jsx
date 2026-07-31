'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';
import WishlistButton from '@/components/WishlistButton';

/** Card-shaped placeholder so the grid does not collapse then jump. */
function Skeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full flex-col overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm"
    >
      <div className="aspect-[4/3] animate-pulse bg-gray-100" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function FeaturedProducts() {
  const { addToCart } = useCart();
  const [products, setProducts] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    let active = true;
    const db = createBrowserSupabase();

    listProducts(db, { limit: 8 })
      .then((rows) => {
        if (!active) return;
        setProducts(rows ?? []);
        setState('ready');
      })
      .catch((err) => {
        // Previously this was a bare .catch(console.error), so a failed fetch
        // rendered an empty grid with no indication anything had gone wrong.
        console.error('Featured products error:', err);
        if (active) setState('error');
      });

    return () => {
      active = false;
    };
  }, []);

  // An empty or failed carousel is not worth a broken-looking band on the
  // homepage — drop the section and let the page flow on.
  if (state === 'error' || (state === 'ready' && products.length === 0)) return null;

  return (
    <section className="overflow-hidden bg-white py-16">
      <div className="site-container">
        {/* Header Row */}
        <div
          data-aos="fade-up"
          className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <h2 className="section-heading mb-2">Featured Products</h2>
            <p className="section-copy">Discover our handpicked collection of premium eyewear.</p>
          </div>
          <div className="pb-1">
            <Link
              href="/shop"
              className="text-brand-blue flex items-center gap-2 text-[16px] font-bold hover:underline"
            >
              See More
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-10">
          {state === 'loading' &&
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={`sk-${i}`} />)}
          {products.map((product, index) => (
            <div
              key={product.id}
              data-aos="fade-up"
              data-aos-delay={index * 50}
              className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm transition-all duration-500 hover:shadow-2xl"
            >
              {/* Product Image */}
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
                <div className="absolute left-3 top-3 z-10">
                  <WishlistButton productId={product.id} />
                </div>
                <img
                  src={getProductImageUrl(product)}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>

              {/* Product Info */}
              <div className="flex flex-grow flex-col p-5">
                <h3 className="text-brand-dark group-hover:text-brand-blue mb-1 text-[17px] font-bold leading-tight transition-colors sm:text-[18px]">
                  {product.name}
                </h3>
                <p className="mb-5 line-clamp-2 text-[13px] leading-relaxed text-gray-400">
                  {product.description}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <p className="text-brand-blue whitespace-nowrap text-[18px] font-black">
                    {formatKes(Number(product.price_kes))}
                  </p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      addToCart({
                        id: product.id,
                        title: product.name,
                        price: String(product.price_kes),
                        image: getProductImageUrl(product),
                        quantity: 1,
                      });
                    }}
                    className="bg-brand-red whitespace-nowrap rounded-xl px-4 py-2 text-[13px] font-bold text-white shadow-md transition-all hover:bg-red-700 active:scale-95"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
