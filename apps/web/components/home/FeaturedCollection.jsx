'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts, listCategories } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

const UI_CATEGORIES = [
  { id: 'glasses', name: 'Eye Glasses', image: '/images/eyeglasses-fc.jpg', keywords: ['glass', 'eyeglass', 'optic', 'reading'] },
  { id: 'shades', name: 'Shades', image: '/images/shades-fc.png', keywords: ['sun', 'shade', 'sunglass'] },
  { id: 'lens', name: 'Contact Lens', image: '/images/contactlens-fc.png', keywords: ['contact', 'lens', 'lense'] },
];

const FeaturedCollection = () => {
  const [activeCategory, setActiveCategory] = useState('glasses');
  const [allProducts, setAllProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);

  useEffect(() => {
    const db = createBrowserSupabase();
    Promise.all([listProducts(db, { limit: 100 }), listCategories(db)])
      .then(([prods, cats]) => { setAllProducts(prods); setDbCategories(cats); })
      .catch(console.error);
  }, []);

  function getProductsForTab(tabId) {
    const uiCat = UI_CATEGORIES.find(c => c.id === tabId);
    if (!uiCat) return [];
    const dbCat = dbCategories.find(c =>
      uiCat.keywords.some(kw => c.name.toLowerCase().includes(kw) || (c.slug || '').toLowerCase().includes(kw))
    );
    if (dbCat) {
      return allProducts.filter(p => p.category_id === dbCat.id).slice(0, 4);
    }
    return allProducts.slice(0, 4);
  }

  const activeProducts = getProductsForTab(activeCategory);

  return (
    <section className="bg-[#FFFFFF] flex flex-col items-center w-full lg:pt-[80px] lg:px-[100px] lg:pb-[80px]">
      <div className="flex flex-col lg:w-[1240px] lg:gap-[40px] items-center">
        {/* Header Section */}
        <div data-aos="fade-up" className="flex flex-row justify-between items-center w-full lg:w-[1240px] lg:h-[60px]">
          <h2 
            className="text-[#000000] capitalize" 
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '40px', lineHeight: '60px', letterSpacing: '-0.4px' }}
          >
            Featured Collection
          </h2>
          <Link href="/shop" className="flex items-center lg:w-[168.46px] lg:h-[24px] gap-[4px] hover:opacity-80 transition-opacity">
            <span 
              className="text-[#2E3192] capitalize underline decoration-solid whitespace-nowrap"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '16px', lineHeight: '24px' }}
            >
              View Full Catalog
            </span>
            <div className="flex items-center justify-center lg:w-[20px] lg:h-[20px] w-[20px] h-[20px] text-[#2E3192]">
              <svg className="w-full h-full" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.16699 10H15.8337" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 4.16675L15.8333 10.0001L10 15.8334" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
        </div>

        {/* Content Box (Tabs + Grid) */}
        <div className="flex flex-col lg:w-[1143px] lg:gap-[40px]">
          {/* Categories Section */}
          <div className="flex flex-row w-full lg:w-[1143px] lg:h-[144px] lg:gap-[16px] gap-3 justify-center">
            {UI_CATEGORIES.map((cat, index) => {
              const isActive = activeCategory === cat.id;
              const isGlasses = cat.id === 'glasses';

              return (
                <div
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  data-aos="fade-up"
                  data-aos-delay={index * 100}
                  className={`relative flex flex-col cursor-pointer flex-1 max-w-[370px] transition-all duration-300 overflow-hidden
                    lg:h-[144px] rounded-[32px] bg-white
                    ${isActive ? 'border-2 border-[#2E3192]' : 'border border-[#D4D4D4]'}
                  `}
                >
                  {/* Inner image area — fills full card */}
                  <div className="relative flex-1 overflow-hidden rounded-[28px]">
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                  {/* Label below image */}
                  <div className="flex justify-center items-center py-[6px] shrink-0">
                    <span
                      className="text-[#000000] capitalize"
                      style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', lineHeight: '100%' }}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:gap-[24px] lg:w-[1143px]">
              {activeProducts.map((product, index) => (
                <Link
                  key={product.id}
                  href={`/product/${product.slug}`}
                  data-aos="fade-up"
                  data-aos-delay={index * 100}
                  className="group flex flex-col bg-[#FFFFFF] lg:w-[267.75px] lg:h-[377px] lg:px-[13px] lg:pt-[13px] lg:pb-[1px] lg:gap-[16px] cursor-pointer transition-transform transition-colors duration-500 hover:-translate-y-1 hover:border-[#2E3192]/50"
                  style={{
                    borderRadius: '32px',
                    border: '1px solid #D4D4D4',
                    borderTop: '1px solid #D4D4D4',
                    boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)'
                  }}
                >
                  <div className="relative overflow-hidden bg-[#F9F9F9] lg:w-[241.75px] lg:h-[280px]" style={{ borderRadius: '24px' }}>
                    {/* Price Tag */}
                    <div 
                      className="absolute flex items-center justify-center bg-[#FFFFFFE5] lg:top-[16px] lg:left-[156.98px] lg:w-[81px] lg:h-[40px] z-10"
                      style={{ borderRadius: '33554400px' }}
                    >
                      <div className="flex items-baseline gap-[2px]">
                        <span 
                          className="text-[#2E3192]"
                          style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '8px' }}
                        >
                          KSH.
                        </span>
                        <span 
                          className="text-[#2E3192]"
                          style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '16px' }}
                        >
                          {Number(product.price_kes).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {/* Image */}
                    <img
                      src={getProductImageUrl(product)}
                      alt={product.name}
                      className={`h-full w-full mix-blend-multiply transition-transform duration-500 group-hover:scale-105 ${
                        activeCategory === 'lens' ? 'object-contain' : 'object-cover'
                      }`}
                      style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
                    />
                  </div>
                  <div className="flex flex-col lg:w-[241.75px] lg:h-[55px] lg:px-[12px] lg:gap-[4px]">
                    <p 
                      className="text-[#717182] uppercase" 
                      style={{ fontFamily: 'Arimo, sans-serif', fontWeight: 400, fontSize: '12px', lineHeight: '18px', letterSpacing: '1px' }}
                    >
                      {product.brand || 'Oakley'}
                    </p>
                    <h3 
                      className="text-[#000000] truncate transition-colors group-hover:text-[#2E3192]" 
                      style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '22px', lineHeight: '33px', letterSpacing: '-0.32px' }}
                    >
                      {product.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div 
              className="flex flex-col items-center justify-center bg-[#FFFFFF] lg:w-[1143px] lg:h-[377px]"
              style={{ borderRadius: '32px', border: '1px solid #D4D4D4' }}
            >
              <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="#717182" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mb-4">
                <rect x="4" y="11" width="6" height="5" rx="2" />
                <rect x="14" y="11" width="6" height="5" rx="2" />
                <path d="M10 13h4" />
                <path d="M6 11V8a2 2 0 0 1 2-2h1" />
                <path d="M18 11V8a2 2 0 0 0-2-2h-1" />
              </svg>
              <span 
                className="text-[#717182] uppercase mb-1"
                style={{ fontFamily: 'Arimo, sans-serif', fontWeight: 600, fontSize: '11px', letterSpacing: '1px' }}
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
      </div>
    </section>
  );
};

export default FeaturedCollection;
