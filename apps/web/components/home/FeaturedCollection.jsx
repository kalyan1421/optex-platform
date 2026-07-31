'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts, listCategories } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

const UI_CATEGORIES = [
  {
    id: 'glasses',
    name: 'Eye Glasses',
    image: '/images/eye-glasses.png',
    keywords: ['glass', 'eyeglass', 'optic', 'reading'],
  },
  {
    id: 'shades',
    name: 'Shades',
    image: '/images/shades.png',
    keywords: ['sun', 'shade', 'sunglass'],
  },
  {
    id: 'lens',
    name: 'Contact Lens',
    image: '/images/contact-lens.png',
    keywords: ['contact', 'lens', 'lense'],
  },
];

const FeaturedCollection = () => {
  const [activeCategory, setActiveCategory] = useState('glasses');
  const [allProducts, setAllProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);

  useEffect(() => {
    const db = createBrowserSupabase();
    Promise.all([listProducts(db, { limit: 100 }), listCategories(db)])
      .then(([prods, cats]) => {
        setAllProducts(prods);
        setDbCategories(cats);
      })
      .catch(console.error);
  }, []);

  function getProductsForTab(tabId) {
    const uiCat = UI_CATEGORIES.find((c) => c.id === tabId);
    if (!uiCat) return [];
    // Find matching DB category by name keyword
    const dbCat = dbCategories.find((c) =>
      uiCat.keywords.some(
        (kw) => c.name.toLowerCase().includes(kw) || (c.slug || '').toLowerCase().includes(kw),
      ),
    );
    if (dbCat) {
      return allProducts.filter((p) => p.category_id === dbCat.id).slice(0, 4);
    }
    // Fallback: return first 4 products
    return allProducts.slice(0, 4);
  }

  const activeProducts = getProductsForTab(activeCategory);

  return (
    // id is the target of the hero's "Explore Collection" button (#collection),
    // which previously scrolled nowhere because no element carried the id.
    <section
      id="collection"
      className="scroll-mt-28 overflow-hidden bg-white py-16 sm:py-20"
    >
      <div className="section-container">
        {/* Header Section */}
        <div
          data-aos="fade-up"
          className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <h2 className="section-heading">Featured Collection</h2>
          <Link
            href="/shop"
            className="flex items-center gap-2 text-[14px] font-bold text-[#2A3182] transition-opacity hover:opacity-80 sm:text-[15px]"
          >
            View Full Catalog
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </Link>
        </div>

        {/* Categories Section */}
        <div className="mb-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {UI_CATEGORIES.map((cat, index) => (
            <div
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className={`group relative flex h-[190px] cursor-pointer flex-col items-center overflow-hidden rounded-[30px] border-[1.5px] transition-all duration-300 sm:h-[200px] ${
                activeCategory === cat.id
                  ? 'border-[#2A3182] bg-[#f8faff] shadow-xl'
                  : 'border-gray-200 bg-white shadow-sm hover:border-gray-300'
              }`}
            >
              <div className="flex h-[130px] w-full items-center justify-center overflow-hidden p-4 sm:h-[140px]">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="flex flex-1 items-center justify-center p-4">
                <span className="text-center text-[17px] font-bold tracking-tight text-gray-900 sm:text-[18px]">
                  {cat.name}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Product Grid */}
        {activeProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {activeProducts.map((product, index) => (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                data-aos="fade-up"
                data-aos-delay={index * 100}
                className="group flex cursor-pointer flex-col rounded-[32px] border border-gray-100 bg-white p-3 transition-all duration-500 hover:shadow-2xl"
              >
                <div className="relative mb-0 aspect-[4/4.5] overflow-hidden rounded-[28px] bg-[#f4f5f7]">
                  <div className="absolute right-4 top-4 z-10">
                    <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 shadow-sm">
                      <span className="text-[10px] font-bold uppercase tracking-tighter text-[#2A3182] opacity-60">
                        Ksh.
                      </span>
                      <span className="text-[15px] font-black text-[#2A3182]">
                        {Number(product.price_kes).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="h-full w-full">
                    <img
                      src={getProductImageUrl(product)}
                      alt={product.name}
                      className={`h-full w-full transition-transform duration-700 group-hover:scale-110 ${
                        activeCategory === 'lens' ? 'object-contain p-6' : 'object-cover'
                      }`}
                    />
                  </div>
                </div>
                <div className="p-5 pt-5 sm:p-6">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400">
                    {product.brand || '—'}
                  </p>
                  <h3 className="text-[18px] font-bold leading-tight text-[#1a1a1a] transition-colors group-hover:text-[#2A3182] sm:text-[20px]">
                    {product.name}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-[32px] border border-gray-100 bg-white p-3"
              >
                <div className="mb-3 aspect-[4/4.5] rounded-[28px] bg-gray-100" />
                <div className="p-4">
                  <div className="mb-2 h-3 w-1/3 rounded bg-gray-100" />
                  <div className="h-5 w-2/3 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedCollection;
