'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';
import WishlistToggle from '@/components/wishlist/WishlistToggle';

const BADGES = ['BEST SELLER', 'TRENDING', 'NEW ARRIVAL', 'HOT'];

export default function TrendingNow() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const db = createBrowserSupabase();
    listProducts(db, { limit: 4 }).then(setProducts).catch(console.error);
  }, []);

  return (
    <section className="flex w-full flex-col items-center bg-[#FFFFFF] px-6 lg:px-[100px]">
      <div className="flex flex-col lg:w-[1240px] lg:gap-[60px]">
        {/* Header Row */}
        <div
          data-aos="fade-up"
          className="flex flex-col justify-between lg:h-[142px] lg:w-[1240px] lg:flex-row lg:items-end"
        >
          <div className="flex flex-col lg:h-[142px] lg:w-[600px] lg:gap-[16px]">
            <h2
              className="text-[#000000]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '48px',
                lineHeight: '72px',
              }}
            >
              Trending Now
            </h2>
            <p
              className="text-[#717182]"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '18px',
                lineHeight: '27px',
              }}
            >
              Our most popular designs this season, curated for those who value both style and
              visual excellence.
            </p>
          </div>
          <div className="mt-4 flex justify-start lg:mt-0 lg:justify-end">
            <Link
              href="/shop"
              className="flex items-center justify-center transition-opacity hover:opacity-80 lg:h-[33px] lg:w-[157.58px]"
              style={{ borderBottom: '2px solid #2E3192' }}
            >
              <span
                className="text-[#2E3192]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  fontSize: '18px',
                  lineHeight: '27px',
                }}
              >
                View all products
              </span>
            </Link>
          </div>
        </div>

        {/* Product Grid */}
        {products.length > 0 ? (
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:flex-wrap lg:h-[381.75px] lg:w-[1240px] lg:flex-nowrap lg:gap-0">
            {products.map((product, index) => (
              <div
                key={product.id}
                data-aos="fade-up"
                data-aos-delay={index * 100}
                className="group flex flex-col lg:h-[381.75px] lg:w-[261.75px] lg:gap-[24px]"
              >
                {/* Image Block */}
                <div
                  className="relative aspect-square w-full overflow-hidden bg-[#F9F9F9] lg:h-[261.75px] lg:w-[261.75px]"
                  style={{ borderRadius: '32px' }}
                >
                  <div
                    className="absolute z-10 bg-[#E53935] px-[16px] py-[6px] lg:left-[16px] lg:top-[16px]"
                    style={{ borderRadius: '33554400px' }}
                  >
                    <span
                      className="uppercase text-[#FFFFFF]"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 700,
                        fontSize: '12px',
                        lineHeight: '18px',
                        letterSpacing: '0.6px',
                      }}
                    >
                      {BADGES[index % BADGES.length]}
                    </span>
                  </div>
                  <WishlistToggle
                    productId={product.id}
                    className="absolute right-[12px] top-[12px] z-10"
                  />
                  <Link href={`/product/${product.slug}`} className="block h-full w-full">
                    <img
                      src={getProductImageUrl(product)}
                      alt={product.name}
                      className="h-full w-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                      style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
                    />
                  </Link>
                </div>

                {/* Text Block */}
                <Link
                  href={`/product/${product.slug}`}
                  className="flex flex-col lg:h-[96px] lg:w-[261.75px]"
                >
                  <p
                    className="uppercase text-[#717182]"
                    style={{
                      fontFamily: 'Arimo, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px',
                      lineHeight: '21px',
                      letterSpacing: '1px',
                    }}
                  >
                    {product.brand || '—'}
                  </p>
                  <h3
                    className="truncate text-[#000000] lg:mt-[5px]"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '20px',
                      lineHeight: '30px',
                    }}
                  >
                    {product.name}
                  </h3>
                  <div className="flex items-baseline lg:mt-[8px]">
                    <span
                      className="text-[#2E3192]"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 700,
                        fontSize: '22px',
                        lineHeight: '33px',
                      }}
                    >
                      KSH.{' '}
                      {Number(product.price_kes).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:flex-wrap lg:h-[381.75px] lg:w-[1240px] lg:flex-nowrap lg:gap-0">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse flex-col gap-6 lg:h-[381.75px] lg:w-[261.75px]"
              >
                <div
                  className="aspect-square w-full bg-gray-100"
                  style={{ borderRadius: '32px' }}
                />
                <div className="flex flex-col gap-2">
                  <div className="h-4 w-1/3 rounded bg-gray-100" />
                  <div className="h-6 w-2/3 rounded bg-gray-100" />
                  <div className="mt-2 h-8 w-1/2 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Production Level Divider Line (from Design) */}
        <div className="mt-10 h-[1px] w-full bg-[#EAEAEA] lg:mt-[80px]" />
      </div>
    </section>
  );
}
