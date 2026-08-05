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
    <section className="bg-[#FFFFFF] flex flex-col items-center w-full px-6 lg:px-[100px] lg:pt-[80px] lg:pb-[80px]">
      <div className="flex flex-col lg:w-[1240px] lg:gap-[51px]">

        {/* Header Row */}
        <div data-aos="fade-up" className="flex flex-col lg:flex-row lg:items-end justify-between lg:w-[1240px] lg:h-[92px]">
          <div className="flex flex-col lg:w-[426.5px] lg:h-[92px] lg:gap-[8px]">
            <h2 
              className="text-[#000000] capitalize"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '40px', lineHeight: '60px', letterSpacing: '-0.4px' }}
            >
              Featured Products
            </h2>
            <p 
              className="text-[#717182] whitespace-nowrap"
              style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '16px', lineHeight: '24px' }}
            >
              Discover our handpicked collection of premium eyewear.
            </p>
          </div>
          <div className="flex justify-start lg:justify-end mt-4 lg:mt-0 lg:pb-[4px]">
            <Link 
              href="/shop" 
              className="flex items-center lg:w-[96.95px] lg:h-[24px] hover:opacity-80 transition-opacity"
            >
              <span 
                className="text-[#2E3192] text-center capitalize underline"
                style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '16px', lineHeight: '24px', letterSpacing: '-0.16px' }}
              >
                See More
              </span>
              <div className="flex items-center justify-center lg:w-[24px] lg:h-[24px] text-[#2E3192]">
                <svg width="6" height="12" viewBox="0 0 6 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                  <polyline points="1 11 5 6 1 1"></polyline>
                </svg>
              </div>
            </Link>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex flex-wrap lg:grid lg:grid-cols-4 justify-between gap-6 lg:gap-[24px] lg:w-[1240px]">
          {products.map((product, index) => (
            <div
              key={product.id}
              data-aos="fade-up"
              data-aos-delay={index * 50}
              className="group flex flex-col items-center bg-[#FFFFFF] lg:w-[291px] lg:h-[378.2px] p-[1px] lg:gap-[10px] cursor-pointer transition-transform duration-500 hover:-translate-y-1"
              style={{
                borderRadius: '32px',
                border: '0.8px solid #D4D4D4',
                boxShadow: '0px 8px 24px 0px rgba(0,0,0,0.05)'
              }}
            >
              {/* Product Image */}
              <Link href={`/product/${product.slug}`} className="relative overflow-hidden bg-[#F5F5F5] w-full lg:w-[289px] lg:h-[225.2px]" style={{ borderRadius: '31px 31px 0 0' }}>
                <img
                  src={getProductImageUrl(product)}
                  alt={product.name}
                  className="w-full h-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                  style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
                />
              </Link>

              {/* Product Info */}
              <div className="flex flex-col lg:w-[289px] lg:h-[141px] lg:px-[12px] lg:pb-[12px] lg:gap-[10px]">
                <div className="flex flex-col lg:w-[265px] lg:h-[72px]">
                  <Link href={`/product/${product.slug}`}>
                    <h3 
                      className="text-[#000000] truncate transition-colors group-hover:text-[#2E3192] lg:w-[265px] lg:h-[30px]" 
                      style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '20px', lineHeight: '30px', letterSpacing: '-0.2px' }}
                    >
                      {product.name}
                    </h3>
                  </Link>
                  <p 
                    className="text-[#717182] line-clamp-2 lg:w-[265px] lg:h-[42px]" 
                    style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '14px', lineHeight: '21px', letterSpacing: '-0.14px' }}
                  >
                    {product.description || 'Unisex style with UV protection'}
                  </p>
                </div>
                
                <div className="flex items-center justify-between lg:w-[265px] lg:h-[37px]">
                  <span 
                    className="text-[#2E3192] whitespace-nowrap" 
                    style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px', lineHeight: '27px', letterSpacing: '-0.18px' }}
                  >
                    KSH. {Number(product.price_kes).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
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
                    className="flex justify-center items-center flex-shrink-0 bg-[#E53935] hover:bg-red-700 transition-colors lg:w-[127.5px] lg:h-[37px]"
                    style={{ borderRadius: '24px' }}
                  >
                    <span 
                      className="text-[#FFFFFF] text-center"
                      style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', lineHeight: '21px' }}
                    >
                      Shop Now
                    </span>
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
