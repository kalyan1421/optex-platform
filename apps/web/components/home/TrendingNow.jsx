'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

const BADGES = ['BEST SELLER', 'TRENDING', 'NEW ARRIVAL', 'HOT'];

export default function TrendingNow() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const db = createBrowserSupabase();
    listProducts(db, { limit: 4 })
      .then(setProducts)
      .catch(console.error);
  }, []);

  return (
    <section className="bg-white py-16 overflow-hidden">
      <div className="site-container">

        {/* Header Row */}
        <div data-aos="fade-up" className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 className="section-heading mb-4 leading-tight">
              Trending Now
            </h2>
            <p className="section-copy font-medium">
              Our most popular designs this season, curated for those who value <br className="hidden lg:block" />
              both style and visual excellence.
            </p>
          </div>
          <div className="pb-2">
            <Link href="/shop" className="text-brand-blue font-bold text-[16px] border-b-[2px] border-brand-blue pb-1 hover:opacity-80 transition-all group flex items-center gap-2">
              View all products
            </Link>
          </div>
        </div>

        {/* Product Grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {products.map((product, index) => (
              <Link key={product.id} href={`/product/${product.slug}`} data-aos="fade-up" data-aos-delay={index * 100} className="group cursor-pointer block">
                <div className="relative mb-5 aspect-square overflow-hidden rounded-[28px] shadow-sm transition-all duration-500 hover:shadow-xl sm:mb-6 sm:rounded-[34px]">
                  <div className="absolute top-6 left-6 z-10">
                    <span className="rounded-xl bg-brand-red px-4 py-2 text-[10px] font-black tracking-wider text-white shadow-lg sm:text-[11px]">
                      {BADGES[index % BADGES.length]}
                    </span>
                  </div>
                  <div className="w-full h-full">
                    <img
                      src={getProductImageUrl(product)}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>
                </div>
                <div className="px-2">
                  <p className="text-[10px] font-bold text-gray-400 tracking-[0.15em] uppercase mb-1.5">
                    {product.brand || '—'}
                  </p>
                  <h3 className="mb-1 text-[18px] font-black leading-tight text-brand-dark transition-colors group-hover:text-brand-blue sm:text-[20px]">
                    {product.name}
                  </h3>
                  <p className="text-[18px] font-black text-brand-blue">
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
                <div className="aspect-square rounded-[28px] bg-gray-100 mb-5" />
                <div className="h-3 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-5 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-5 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
