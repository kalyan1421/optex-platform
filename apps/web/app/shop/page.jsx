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
  const [sortBy, setSortBy] = useState('default');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([{ name: 'All', count: 0 }]);
  const [brands, setBrands] = useState(['All']);
  const { addToCart } = useCart();

  useEffect(() => {
    const db = createBrowserSupabase();
    Promise.all([
      listProducts(db, { limit: 100 }),
      listCategories(db),
    ]).then(([prods, cats]) => {
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
      const uniqueBrands = ['All', ...Array.from(new Set(prods.map((p) => p.brand).filter(Boolean)))];
      setBrands(uniqueBrands);
    }).catch(console.error);
  }, []);

  const filtered = products.filter((p) => {
    const brandMatch = activeBrand === 'All' || p.brand === activeBrand;
    if (!brandMatch) return false;
    if (activeCategory === 'All') return true;
    const cat = categories.find((c) => c.name === activeCategory);
    return cat ? p.category_id === cat.id : true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'price-asc') return Number(a.price_kes) - Number(b.price_kes);
    if (sortBy === 'price-desc') return Number(b.price_kes) - Number(a.price_kes);
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return 0; // default: preserve DB order (created_at desc)
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Banner Section */}
      <section className="relative flex h-[320px] items-center justify-center overflow-hidden sm:h-[360px] lg:h-[400px]">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center scale-105"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=2070&auto=format)' }}
        >
          <div className="absolute inset-0 bg-[#2A3182]/70 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/80 to-transparent"></div>
        </div>

        <div data-aos="fade-up" className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="mb-4 text-[36px] font-black tracking-tight text-white drop-shadow-2xl sm:text-[46px] md:text-[60px]">
            Our Collection
          </h1>
          <p className="mx-auto max-w-lg text-[14px] font-medium leading-relaxed text-white/90 drop-shadow-lg sm:text-[16px] md:text-[18px]">
            Browse through our extensive range of premium eyewear, from classic frames to modern sunglasses.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="page-container py-12 sm:py-14">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">

          {/* Sidebar Filters */}
          <aside
            className="w-full flex-shrink-0 lg:sticky lg:h-fit lg:max-h-[calc(100vh-130px)] lg:w-[240px] lg:self-start lg:overflow-y-auto lg:pr-2"
            style={{ top: '130px' }}
          >
            <div data-aos="fade-right">
              {/* Categories */}
              <div className="mb-10">
                <h3 className="text-[15px] font-bold text-[#1a1a1a] mb-5 uppercase tracking-[0.1em]">Categories</h3>
                <ul className="space-y-1">
                  {categories.map((cat) => (
                    <li
                      key={cat.name}
                      onClick={() => setActiveCategory(cat.name)}
                      className={`flex justify-between items-center py-2.5 rounded-lg cursor-pointer transition-all duration-200 text-[14px]
                        ${activeCategory === cat.name
                          ? 'bg-[#2A3182] text-white shadow-md px-4 font-bold'
                          : 'text-gray-500 hover:text-[#2A3182] font-medium'}`}
                    >
                      <span>{cat.name}</span>
                      <span className={`text-[11px] ${activeCategory === cat.name ? 'text-white/70' : 'text-gray-400'}`}>
                        ({cat.count})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Brands */}
              <div>
                <h3 className="text-[15px] font-bold text-[#1a1a1a] mb-5 uppercase tracking-[0.1em]">Brands</h3>
                <ul className="space-y-1">
                  {brands.map((brand) => (
                    <li
                      key={brand}
                      onClick={() => setActiveBrand(brand)}
                      className={`py-2.5 rounded-lg cursor-pointer transition-all duration-200 text-[14px]
                        ${activeBrand === brand
                          ? 'bg-[#2A3182] text-white shadow-md px-4 font-bold'
                          : 'text-gray-500 hover:text-[#2A3182] font-medium'}`}
                    >
                      {brand}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          {/* Product Grid Area */}
          <section className="min-w-0 flex-1">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] font-bold uppercase tracking-widest text-gray-400 sm:text-[13px]">
                Showing {sorted.length} products
              </p>
              <div className="w-full sm:w-auto">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-gray-100 px-3 py-2 text-[12px] font-bold text-gray-500 outline-none focus:border-[#2A3182] sm:w-auto"
                >
                  <option value="default">Default Sorting</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {sorted.map((product, index) => (
                <div key={product.id} data-aos="fade-up" data-aos-delay={index * 50} className="group flex flex-col rounded-[25px] border border-[#ddd] bg-white p-2.5 transition-all duration-500 hover:shadow-xl">
                  {/* Image Container */}
                  <div className="relative aspect-square rounded-[20px] overflow-hidden bg-[#f8f9fa]">
                    <div className="absolute top-3 right-3 z-10">
                      <div className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm border border-[#ddd]">
                        <span className="text-[9px] font-black text-[#2A3182] uppercase tracking-tighter">
                          {product.frame_shape ?? product.brand}
                        </span>
                      </div>
                    </div>
                    <Link href={`/product/${product.slug}`}>
                      <img
                        src={getProductImageUrl(product)}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    </Link>
                  </div>

                  {/* Product Details */}
                  <div className="flex flex-1 flex-col p-4 pt-4">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <Link href={`/product/${product.slug}`}>
                        <h3 className="text-[16px] font-bold text-gray-900 group-hover:text-[#2A3182] transition-colors leading-tight">
                          {product.name}
                        </h3>
                      </Link>
                      <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-1">
                        {product.brand}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-400 line-clamp-2 mb-4 leading-relaxed flex-1">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between gap-3 border-t border-[#ddd] pt-2">
                      <p className="text-[18px] font-black text-[#2A3182] tracking-tight">
                        {formatKes(Number(product.price_kes))}
                      </p>
                      <button
                        onClick={() => addToCart({
                          id: product.id,
                          title: product.name,
                          price: String(product.price_kes),
                          image: getProductImageUrl(product),
                          quantity: 1,
                        })}
                        className="whitespace-nowrap rounded-full bg-[#EF4444] px-4 py-2 text-[11px] font-bold text-white shadow-md transition-all hover:bg-red-600 active:scale-95"
                      >
                        Add to Cart
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

export default function Page() { return <Shop />; }
