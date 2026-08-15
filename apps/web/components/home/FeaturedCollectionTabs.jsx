'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getProductImageUrl } from '@/lib/product-image';
import WishlistToggle from '@/components/wishlist/WishlistToggle';

const UI_CATEGORIES = [
  {
    id: 'glasses',
    name: 'Eye Glasses',
    image: '/images/eyeglasses-fc.jpg',
    keywords: ['glass', 'eyeglass', 'optic', 'reading'],
  },
  {
    id: 'shades',
    name: 'Shades',
    image: '/images/shades-fc.png',
    keywords: ['sun', 'shade', 'sunglass'],
  },
  {
    id: 'lens',
    name: 'Contact Lens',
    image: '/images/contactlens-fc.png',
    keywords: ['contact', 'lens', 'lense'],
  },
];

/**
 * The tab-switching half of Featured Collection: which UI category is
 * active, and the products grid for it. Split out so the section header can
 * stay server-rendered — `products` and `categories` arrive as props,
 * already fetched on the server.
 */
export default function FeaturedCollectionTabs({ products, categories }) {
  const [activeCategory, setActiveCategory] = useState('glasses');

  function getProductsForTab(tabId) {
    const uiCat = UI_CATEGORIES.find((c) => c.id === tabId);
    if (!uiCat) return [];
    const dbCat = categories.find((c) =>
      uiCat.keywords.some(
        (kw) => c.name.toLowerCase().includes(kw) || (c.slug || '').toLowerCase().includes(kw),
      ),
    );
    if (dbCat) {
      return products.filter((p) => p.category_id === dbCat.id).slice(0, 4);
    }
    return products.slice(0, 4);
  }

  const activeProducts = getProductsForTab(activeCategory);

  return (
    <div className="flex flex-col lg:w-[1143px] lg:gap-[40px]">
      {/* Categories Section */}
      <div className="flex w-full flex-row justify-center gap-3 lg:h-[144px] lg:w-[1143px] lg:gap-[16px]">
        {UI_CATEGORIES.map((cat, index) => {
          const isActive = activeCategory === cat.id;

          return (
            <div
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className={`relative flex max-w-[370px] flex-1 cursor-pointer flex-col overflow-hidden rounded-[32px] bg-white transition-all duration-300 lg:h-[144px] ${isActive ? 'border-2 border-[#2E3192]' : 'border border-[#D4D4D4]'} `}
            >
              {/* Inner image area — fills full card */}
              <div className="relative flex-1 overflow-hidden rounded-[28px]">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
              {/* Label below image */}
              <div className="flex shrink-0 items-center justify-center py-[6px]">
                <span
                  className="capitalize text-[#000000]"
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '14px',
                    lineHeight: '100%',
                  }}
                >
                  {cat.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Product Grid */}
      {activeProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:w-[1143px] lg:grid-cols-4 lg:gap-[24px]">
          {activeProducts.map((product, index) => (
            <div
              key={product.id}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className="group flex flex-col bg-[#FFFFFF] transition-colors transition-transform duration-500 hover:-translate-y-1 hover:border-[#2E3192]/50 lg:h-[377px] lg:w-[267.75px] lg:gap-[16px] lg:px-[13px] lg:pb-[1px] lg:pt-[13px]"
              style={{
                borderRadius: '32px',
                border: '1px solid #D4D4D4',
                borderTop: '1px solid #D4D4D4',
                boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)',
              }}
            >
              <div
                className="relative overflow-hidden bg-[#F9F9F9] lg:h-[280px] lg:w-[241.75px]"
                style={{ borderRadius: '24px' }}
              >
                {/* Price Tag */}
                <div
                  className="absolute z-10 flex items-center justify-center bg-[#FFFFFFE5] lg:left-[156.98px] lg:top-[16px] lg:h-[40px] lg:w-[81px]"
                  style={{ borderRadius: '33554400px' }}
                >
                  <div className="flex items-baseline gap-[2px]">
                    <span
                      className="text-[#2E3192]"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 700,
                        fontSize: '8px',
                      }}
                    >
                      KSH.
                    </span>
                    <span
                      className="text-[#2E3192]"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 700,
                        fontSize: '16px',
                      }}
                    >
                      {Number(product.price_kes).toLocaleString()}
                    </span>
                  </div>
                </div>
                <WishlistToggle
                  productId={product.id}
                  className="absolute left-[12px] top-[12px] z-10"
                />
                {/* Image */}
                <Link
                  href={`/product/${product.slug}`}
                  className="block h-full w-full cursor-pointer"
                >
                  <img
                    src={getProductImageUrl(product)}
                    alt={product.name}
                    className={`h-full w-full mix-blend-multiply transition-transform duration-500 group-hover:scale-105 ${
                      activeCategory === 'lens' ? 'object-contain' : 'object-cover'
                    }`}
                    style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
                  />
                </Link>
              </div>
              <Link
                href={`/product/${product.slug}`}
                className="flex flex-col lg:h-[55px] lg:w-[241.75px] lg:gap-[4px] lg:px-[12px]"
              >
                <p
                  className="uppercase text-[#717182]"
                  style={{
                    fontFamily: 'Arimo, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '18px',
                    letterSpacing: '1px',
                  }}
                >
                  {product.brand || '—'}
                </p>
                <h3
                  className="truncate text-[#000000] transition-colors group-hover:text-[#2E3192]"
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '22px',
                    lineHeight: '33px',
                    letterSpacing: '-0.32px',
                  }}
                >
                  {product.name}
                </h3>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center bg-[#FFFFFF] lg:h-[377px] lg:w-[1143px]"
          style={{ borderRadius: '32px', border: '1px solid #D4D4D4' }}
        >
          <svg
            width="68"
            height="68"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#717182"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-4"
          >
            <rect x="4" y="11" width="6" height="5" rx="2" />
            <rect x="14" y="11" width="6" height="5" rx="2" />
            <path d="M10 13h4" />
            <path d="M6 11V8a2 2 0 0 1 2-2h1" />
            <path d="M18 11V8a2 2 0 0 0-2-2h-1" />
          </svg>
          <span
            className="mb-1 uppercase text-[#717182]"
            style={{
              fontFamily: 'Arimo, sans-serif',
              fontWeight: 600,
              fontSize: '11px',
              letterSpacing: '1px',
            }}
          >
            0 OF 12
          </span>
          <h3
            className="text-[#000000]"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '24px' }}
          >
            Check back soon for new styles
          </h3>
        </div>
      )}
    </div>
  );
}
