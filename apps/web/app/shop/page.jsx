'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts, listCategories } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

const Shop = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeBrand, setActiveBrand] = useState('All');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([{ name: 'All', count: 0 }]);
  const [brands, setBrands] = useState(['All']);
  const { addToCart } = useCart();

  useEffect(() => {
    const db = createBrowserSupabase();
    Promise.all([listProducts(db, { limit: 100 }), listCategories(db)])
      .then(([prods, cats]) => {
        setProducts(prods);
        const catList = [
          { name: 'All', count: prods.length },
          ...cats.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            count: prods.filter((p) => p.category_id === c.id).length,
          })),
        ];
        setCategories(catList);
        const uniqueBrands = [
          'All',
          ...Array.from(new Set(prods.map((p) => p.brand).filter(Boolean))),
        ];
        setBrands(uniqueBrands);
      })
      .catch(console.error);
  }, []);

  const filtered = products.filter((p) => {
    const brandMatch = activeBrand === 'All' || p.brand === activeBrand;
    if (!brandMatch) return false;
    if (activeCategory === 'All') return true;
    const cat = categories.find((c) => c.name === activeCategory);
    return cat ? p.category_id === cat.id : true;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Banner Section */}
      <section className="relative flex w-full flex-col items-center overflow-hidden lg:h-[314px] lg:px-[139.6px] lg:pt-[80px]">
        {/* Background Image */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/shop-banner-cropped.jpg)' }}
        />
        {/* Overlay (#F9F9F9 at 50% opacity) */}
        <div className="absolute inset-0 z-0 bg-[#F9F9F980]" />

        {/* Content Box */}
        <div className="relative z-10 flex flex-col items-center lg:h-[154px] lg:w-[1160.8px]">
          <h1
            className="flex items-center justify-center whitespace-nowrap text-center text-[#000000] lg:mt-[2.4px] lg:h-[84px] lg:w-[410px]"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '56px',
              lineHeight: '84px',
            }}
          >
            Our Collection
          </h1>
          <p
            className="flex items-center justify-center text-center text-[#000000] lg:mt-[14px] lg:h-[54px] lg:w-[700px]"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '27px',
            }}
          >
            Browse through our extensive range of premium eyewear, from classic frames to modern
            sunglasses.
          </p>
        </div>
      </section>

      {/* Main Content Layout */}
      <main className="mx-auto mb-12 w-full max-w-[1240px] px-6 lg:mb-[100px] lg:mt-[40px] lg:px-[16px]">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-[40px]">
          {/* Sidebar (Width: 250px) */}
          <aside className="w-full flex-shrink-0 lg:flex lg:w-[250px] lg:flex-col lg:gap-[32px]">
            {/* Categories Block */}
            <div className="flex flex-col gap-[8px] lg:w-[250px]">
              <div className="mb-[8px] border-b-[0.8px] border-[#0000001A] lg:h-[35.8px] lg:w-[250px] lg:pb-[8px]">
                <h3 className="font-poppins h-[27px] text-[18px] font-semibold leading-[27px] text-[#000000]">
                  Categories
                </h3>
              </div>
              <ul className="flex flex-col gap-[8px] lg:w-[250px]">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat.name;
                  return (
                    <li
                      key={cat.name}
                      onClick={() => setActiveCategory(cat.name)}
                      className={`flex cursor-pointer items-center px-[16px] transition-colors lg:h-[40px] lg:w-[250px] lg:rounded-[10px] ${isActive ? 'bg-[#2E3192] text-white' : 'text-[#717182] hover:bg-gray-50'}`}
                    >
                      <span className="font-inter text-[16px]">
                        {cat.name} ({cat.count})
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Brands Block */}
            <div className="flex flex-col gap-[16px] lg:w-[250px]">
              <div className="mb-[8px] border-b-[0.8px] border-[#0000001A] lg:h-[35.8px] lg:w-[250px] lg:pb-[8px]">
                <h3 className="font-poppins h-[27px] text-[18px] font-semibold leading-[27px] text-[#000000]">
                  Brands
                </h3>
              </div>
              <ul className="flex flex-col gap-[8px] lg:w-[250px]">
                {brands.map((brand) => {
                  const isActive = activeBrand === brand;
                  return (
                    <li
                      key={brand}
                      onClick={() => setActiveBrand(brand)}
                      className={`flex cursor-pointer items-center px-[16px] transition-colors lg:h-[40px] lg:w-[250px] lg:rounded-[10px] ${isActive ? 'bg-[#2E3192] text-white' : 'text-[#717182] hover:bg-gray-50'}`}
                    >
                      <span className="font-inter text-[16px]">{brand}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Product Grid Area (Width: 918px) */}
          <section className="mt-10 flex flex-col lg:mt-0 lg:w-[918px] lg:gap-[24px]">
            {/* Top Header */}
            <div className="flex items-center justify-between lg:h-[36px] lg:w-[918px]">
              <span
                className="flex items-center text-[#717182] lg:h-[24px] lg:w-[150px]"
                style={{ fontFamily: 'Arimo, sans-serif', fontSize: '16px', lineHeight: '24px' }}
              >
                Showing {filtered.length} products
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:w-[918px] lg:grid-cols-3 lg:gap-[24px]">
              {filtered.map((product) => (
                <div
                  key={product.id}
                  className="group relative flex w-full flex-col overflow-hidden border-[#D4D4D4] bg-[#FFFFFF] transition-shadow duration-300 hover:shadow-lg lg:h-[480px] lg:w-[290px]"
                  style={{
                    borderRadius: '32px',
                    borderWidth: '0.8px',
                  }}
                >
                  {/* Image Box */}
                  <div className="relative flex w-full shrink-0 items-center justify-center bg-[#F5F5F5] lg:h-[288.4px]">
                    {/* Category Label Pill */}
                    <div className="absolute right-[16px] top-[16px] z-10 flex items-center justify-center rounded-[20px] bg-white px-[12px] py-[6px] shadow-sm">
                      <span className="font-inter text-[12px] font-medium text-[#2E3192]">
                        {product.frame_shape || 'Sunglasses'}
                      </span>
                    </div>

                    <Link
                      href={`/product/${product.slug}`}
                      className="relative block h-full w-full overflow-hidden"
                    >
                      <img
                        src={getProductImageUrl(product)}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </Link>
                  </div>

                  {/* Content Area */}
                  <div className="flex flex-col lg:mx-[24.8px] lg:mt-[24px] lg:w-[240.4px]">
                    {/* Row 1: Title & Brand */}
                    <div className="flex items-start justify-between lg:h-[27px] lg:w-[240.4px]">
                      <h3 className="font-poppins truncate font-semibold text-[#000000] transition-colors group-hover:text-[#2E3192] lg:w-[135px] lg:text-[18px] lg:leading-[27px] lg:tracking-[-0.2px]">
                        {product.name}
                      </h3>
                      <span
                        className="text-right uppercase text-[#2E3192] lg:h-[21px] lg:w-[57px]"
                        style={{
                          fontFamily: 'Arimo, sans-serif',
                          fontSize: '14px',
                          lineHeight: '21px',
                        }}
                      >
                        {product.brand || 'RAYBAN'}
                      </span>
                    </div>

                    {/* Row 2: Description */}
                    <div className="lg:mt-[8px] lg:h-[42px] lg:w-[240.4px]">
                      <p
                        className="font-inter line-clamp-2 text-[#717182]"
                        style={{ fontSize: '14px', lineHeight: '21px' }}
                      >
                        {product.description ||
                          'Premium quality sunglasses designed for maximum comfort and style.'}
                      </p>
                    </div>

                    {/* Row 3: Price & Action */}
                    <div className="flex items-center justify-between lg:mt-[24px] lg:h-[41px] lg:w-[240.4px]">
                      {/* Price Block */}
                      <div className="flex items-baseline gap-[4px] text-[#2E3192] lg:mt-[0.8px] lg:h-[33px] lg:w-[101px]">
                        <span
                          className="text-[12px] font-bold uppercase"
                          style={{ fontFamily: 'Poppins, sans-serif', lineHeight: '33px' }}
                        >
                          KSH.
                        </span>
                        <span
                          className="text-[22px] font-bold"
                          style={{ fontFamily: 'Poppins, sans-serif', lineHeight: '33px' }}
                        >
                          {Number(product.price_kes).toLocaleString()}
                        </span>
                      </div>

                      {/* Button */}
                      <button
                        onClick={() =>
                          addToCart({
                            id: product.id,
                            title: product.name,
                            price: String(product.price_kes),
                            image: getProductImageUrl(product),
                            quantity: 1,
                          })
                        }
                        className="flex items-center justify-center bg-[#E53935] text-white transition-all hover:bg-[#D32F2F] active:scale-95 lg:h-[41px] lg:w-[121.375px] lg:rounded-[24px]"
                      >
                        <span
                          className="flex items-center justify-center whitespace-nowrap text-center text-[14px] font-semibold lg:h-[21px] lg:w-[82px]"
                          style={{ fontFamily: 'Poppins, sans-serif', lineHeight: '21px' }}
                        >
                          Add to Cart
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default function Page() {
  return <Shop />;
}
