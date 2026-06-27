'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

export default function FeaturedProducts() {
  const { addToCart } = useCart();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const db = createBrowserSupabase();
    listProducts(db, { limit: 8 }).then(setProducts).catch(console.error);
  }, []);

  return (
    <section className="bg-white py-16 overflow-hidden">
      <div className="site-container">

        {/* Header Row */}
        <div data-aos="fade-up" className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="section-heading mb-2">
              Featured Products
            </h2>
            <p className="section-copy">
              Discover our handpicked collection of premium eyewear.
            </p>
          </div>
          <div className="pb-1">
            <Link href="/shop" className="text-brand-blue font-bold text-[16px] flex items-center gap-2 hover:underline">
              See More
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-10">
          {products.map((product, index) => (
            <div
              key={product.id}
              data-aos="fade-up"
              data-aos-delay={index * 50}
              className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm transition-all duration-500 hover:shadow-2xl"
            >
              {/* Product Image */}
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
                <img
                  src={getProductImageUrl(product)}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>

              {/* Product Info */}
              <div className="flex flex-grow flex-col p-5">
                <h3 className="mb-1 text-[17px] font-bold leading-tight text-brand-dark transition-colors group-hover:text-brand-blue sm:text-[18px]">
                  {product.name}
                </h3>
                <p className="text-gray-400 text-[13px] mb-5 leading-relaxed line-clamp-2">
                  {product.description}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <p className="text-[18px] font-black text-brand-blue whitespace-nowrap">
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
                    className="whitespace-nowrap rounded-xl bg-brand-red px-4 py-2 text-[13px] font-bold text-white shadow-md transition-all hover:bg-red-700 active:scale-95"
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
