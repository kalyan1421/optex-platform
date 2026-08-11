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
    <section className="bg-[#FFFFFF] flex flex-col items-center w-full px-6 lg:px-[100px]">
      <div className="flex flex-col lg:w-[1240px] lg:gap-[60px]">

        {/* Header Row */}
        <div data-aos="fade-up" className="flex flex-col lg:flex-row lg:items-end justify-between lg:w-[1240px] lg:h-[142px]">
          <div className="flex flex-col lg:w-[600px] lg:h-[142px] lg:gap-[16px]">
            <h2 
              className="text-[#000000]"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '48px', lineHeight: '72px' }}
            >
              Trending Now
            </h2>
            <p 
              className="text-[#717182]"
              style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '18px', lineHeight: '27px' }}
            >
              Our most popular designs this season, curated for those who value both style and visual excellence.
            </p>
          </div>
          <div className="flex justify-start lg:justify-end mt-4 lg:mt-0">
            <Link 
              href="/shop" 
              className="flex items-center justify-center lg:w-[157.58px] lg:h-[33px] hover:opacity-80 transition-opacity"
              style={{ borderBottom: '2px solid #2E3192' }}
            >
              <span 
                className="text-[#2E3192]"
                style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '18px', lineHeight: '27px' }}
              >
                View all products
              </span>
            </Link>
          </div>
        </div>

        {/* Product Grid */}
        {products.length > 0 ? (
          <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap justify-between gap-6 lg:gap-0 lg:w-[1240px] lg:h-[381.75px]">
            {products.map((product, index) => (
              <Link key={product.id} href={`/product/${product.slug}`} data-aos="fade-up" data-aos-delay={index * 100} className="group flex flex-col lg:w-[261.75px] lg:h-[381.75px] lg:gap-[24px]">
                {/* Image Block */}
                <div className="relative overflow-hidden bg-[#F9F9F9] lg:w-[261.75px] lg:h-[261.75px] w-full aspect-square" style={{ borderRadius: '32px' }}>
                  <div 
                    className="absolute bg-[#E53935] lg:top-[16px] lg:left-[16px] px-[16px] py-[6px] z-10"
                    style={{ borderRadius: '33554400px' }}
                  >
                    <span 
                      className="text-[#FFFFFF] uppercase"
                      style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '12px', lineHeight: '18px', letterSpacing: '0.6px' }}
                    >
                      {BADGES[index % BADGES.length]}
                    </span>
                  </div>
                  <img
                    src={getProductImageUrl(product)}
                    alt={product.name}
                    className="w-full h-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                    style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
                  />
                </div>
                
                {/* Text Block */}
                <div className="flex flex-col lg:w-[261.75px] lg:h-[96px]">
                  <p 
                    className="text-[#717182] uppercase"
                    style={{ fontFamily: 'Arimo, sans-serif', fontWeight: 400, fontSize: '14px', lineHeight: '21px', letterSpacing: '1px' }}
                  >
                    {product.brand || '—'}
                  </p>
                  <h3 
                    className="text-[#000000] truncate lg:mt-[5px]"
                    style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '20px', lineHeight: '30px' }}
                  >
                    {product.name}
                  </h3>
                  <div className="flex items-baseline lg:mt-[8px]">
                    <span 
                      className="text-[#2E3192]"
                      style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '22px', lineHeight: '33px' }}
                    >
                      KSH. {Number(product.price_kes).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap justify-between gap-6 lg:gap-0 lg:w-[1240px] lg:h-[381.75px]">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse lg:w-[261.75px] lg:h-[381.75px] flex flex-col gap-6">
                <div className="w-full aspect-square bg-gray-100" style={{ borderRadius: '32px' }} />
                <div className="flex flex-col gap-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-6 bg-gray-100 rounded w-2/3" />
                  <div className="h-8 bg-gray-100 rounded w-1/2 mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Production Level Divider Line (from Design) */}
        <div className="w-full h-[1px] bg-[#EAEAEA] mt-10 lg:mt-[80px]" />
      </div>
    </section>
  );
}
