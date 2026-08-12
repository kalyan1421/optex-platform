'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts, listCategories } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

/**
 * Price bands, in KES. The catalogue spans roughly 5,000–35,000, so these are
 * bands rather than a dual-thumb slider: the sidebar has one established
 * control — a list of selectable rows — and a slider is a new component with no
 * design behind it. See docs/DESIGN-STATUS.md §5.
 */
const PRICE_BANDS = [
  { name: 'All', test: () => true },
  { name: 'Under KSh 10,000', test: (p) => p < 10000 },
  { name: 'KSh 10,000 – 20,000', test: (p) => p >= 10000 && p < 20000 },
  { name: 'KSh 20,000 – 30,000', test: (p) => p >= 20000 && p < 30000 },
  { name: 'Over KSh 30,000', test: (p) => p >= 30000 },
];

/** 12 = 4 rows of the 3-up grid the Shop design specifies (918px / 290px cards). */
const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name-asc', label: 'Name: A–Z' },
];

/**
 * Distinct non-empty values of `key`, sorted, prefixed with "All".
 *
 * Grouped case-insensitively because the catalogue is not clean — the seed
 * alone carries both "Metal" and "metal", which would otherwise render as two
 * separate rows that each filter out the other's products. The first spelling
 * encountered wins for display; `matchesFacet` compares the same way.
 */
function facetValues(products, key) {
  const seen = new Map();
  for (const p of products) {
    const raw = p[key];
    if (!raw) continue;
    const k = String(raw).trim().toLowerCase();
    if (k && !seen.has(k)) seen.set(k, String(raw).trim());
  }
  return ['All', ...Array.from(seen.values()).sort((a, b) => a.localeCompare(b))];
}

/** Case- and whitespace-insensitive facet comparison. See `facetValues`. */
function matchesFacet(value, selected) {
  if (selected === 'All') return true;
  return (
    String(value ?? '')
      .trim()
      .toLowerCase() === selected.trim().toLowerCase()
  );
}

/**
 * One sidebar facet — the established Shop control: a heading with a hairline
 * rule, then selectable rows. Extracted so the five facets stay identical
 * rather than drifting as copies.
 */
function FacetBlock({ title, options, active, onSelect, counts }) {
  if (options.length <= 2) return null; // "All" + one value filters nothing
  return (
    <div className="flex flex-col gap-[8px] lg:w-[250px]">
      <div className="mb-[8px] border-b-[0.8px] border-[#0000001A] lg:h-[35.8px] lg:w-[250px] lg:pb-[8px]">
        <h3 className="font-poppins h-[27px] text-[18px] font-semibold leading-[27px] text-[#000000]">
          {title}
        </h3>
      </div>
      <ul className="flex flex-col gap-[8px] lg:w-[250px]">
        {options.map((opt) => {
          const isActive = active === opt;
          // A zero-count option is a dead end — selecting it can only produce
          // the empty state. Disable it, unless it is the current selection,
          // which must stay clickable so it can be switched away from.
          const isEmpty = counts?.[opt] === 0 && !isActive;
          return (
            <li key={opt}>
              <button
                type="button"
                aria-pressed={isActive}
                disabled={isEmpty}
                onClick={() => onSelect(opt)}
                className={`flex w-full items-center px-[16px] text-left capitalize transition-colors lg:h-[40px] lg:w-[250px] lg:rounded-[10px] ${
                  isActive
                    ? 'bg-[#2E3192] text-white'
                    : isEmpty
                      ? 'cursor-not-allowed text-[#C7C5D4]'
                      : 'cursor-pointer text-[#717182] hover:bg-gray-50'
                }`}
              >
                <span className="font-inter text-[16px]">
                  {opt}
                  {counts?.[opt] !== undefined ? ` (${counts[opt]})` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const Shop = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeBrand, setActiveBrand] = useState('All');
  const [activeShape, setActiveShape] = useState('All');
  const [activeGender, setActiveGender] = useState('All');
  const [activeMaterial, setActiveMaterial] = useState('All');
  const [activePrice, setActivePrice] = useState('All');
  const [sortBy, setSortBy] = useState('featured');
  const [page, setPage] = useState(1);
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

  // Any filter change invalidates the current page — page 4 of an unfiltered
  // catalogue is usually past the end of a filtered one.
  useEffect(() => {
    setPage(1);
  }, [activeCategory, activeBrand, activeShape, activeGender, activeMaterial, activePrice]);

  const shapes = facetValues(products, 'frame_shape');
  const genders = facetValues(products, 'gender');
  const materials = facetValues(products, 'frame_material');

  const selection = {
    category: activeCategory,
    brand: activeBrand,
    shape: activeShape,
    gender: activeGender,
    material: activeMaterial,
    price: activePrice,
  };

  const categoryIdFor = (name) => categories.find((c) => c.name === name)?.id ?? null;

  /**
   * Does `p` satisfy the current selection?
   *
   * `except` skips one facet, which is what makes the sidebar counts correct:
   * the number beside "Round" has to be how many products you would get if you
   * picked Round *given the other filters*, so Round's own value must not
   * constrain its own count.
   */
  function matches(p, sel, except) {
    if (except !== 'category' && sel.category !== 'All') {
      const id = categoryIdFor(sel.category);
      if (id && p.category_id !== id) return false;
    }
    if (except !== 'brand' && sel.brand !== 'All' && p.brand !== sel.brand) return false;
    if (except !== 'shape' && !matchesFacet(p.frame_shape, sel.shape)) return false;
    if (except !== 'gender' && !matchesFacet(p.gender, sel.gender)) return false;
    if (except !== 'material' && !matchesFacet(p.frame_material, sel.material)) return false;
    if (except !== 'price') {
      const band = PRICE_BANDS.find((b) => b.name === sel.price) ?? PRICE_BANDS[0];
      if (!band.test(Number(p.price_kes))) return false;
    }
    return true;
  }

  /** Option → result count for one facet, ignoring that facet's own selection. */
  function countsFor(key, options, valueOf) {
    const pool = products.filter((p) => matches(p, selection, key));
    const out = { All: pool.length };
    for (const opt of options) {
      if (opt === 'All') continue;
      out[opt] = pool.filter((p) => matchesFacet(valueOf(p), opt)).length;
    }
    return out;
  }

  const categoryCounts = (() => {
    const pool = products.filter((p) => matches(p, selection, 'category'));
    const out = { All: pool.length };
    for (const c of categories) {
      if (c.name === 'All') continue;
      out[c.name] = pool.filter((p) => p.category_id === c.id).length;
    }
    return out;
  })();

  const priceCounts = (() => {
    const pool = products.filter((p) => matches(p, selection, 'price'));
    return Object.fromEntries(
      PRICE_BANDS.map((b) => [b.name, pool.filter((p) => b.test(Number(p.price_kes))).length]),
    );
  })();

  const brandCounts = countsFor('brand', brands, (p) => p.brand);
  const shapeCounts = countsFor('shape', shapes, (p) => p.frame_shape);
  const genderCounts = countsFor('gender', genders, (p) => p.gender);
  const materialCounts = countsFor('material', materials, (p) => p.frame_material);

  const filtered = products.filter((p) => matches(p, selection));

  // Sort a copy — `filtered` is derived per render, but sorting in place would
  // still mutate the array the grid maps over mid-render.
  const visible = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'price-asc':
        return Number(a.price_kes) - Number(b.price_kes);
      case 'price-desc':
        return Number(b.price_kes) - Number(a.price_kes);
      case 'name-asc':
        return String(a.name).localeCompare(String(b.name));
      default:
        return 0; // 'featured' = the order the API returned
    }
  });

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // Clamp rather than trust `page`: the reset effect runs after render, so for
  // one frame `page` can still point past the end of a newly filtered list.
  const safePage = Math.min(page, pageCount);
  const pageItems = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeFilters = Object.values(selection).filter((v) => v !== 'All').length;

  function clearFilters() {
    setActiveCategory('All');
    setActiveBrand('All');
    setActiveShape('All');
    setActiveGender('All');
    setActiveMaterial('All');
    setActivePrice('All');
  }

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
          {/* Sidebar (Width: 250px). Hidden when the catalogue itself is empty —
              every facet would read (0) and none would do anything. */}
          <aside
            className={`w-full flex-shrink-0 lg:w-[250px] lg:flex-col lg:gap-[32px] ${products.length === 0 ? 'hidden' : 'lg:flex'}`}
          >
            {/*
              All six facets share FacetBlock. Categories and Brands are the two
              the Figma Shop screen specifies; Price, Frame shape, Gender and
              Material are not in the design — those columns have existed in
              `products` since 0001 and were unused. Each block hides itself
              when the catalogue has fewer than two distinct values, so a thin
              catalogue does not render dead controls.
              See docs/DESIGN-STATUS.md §5.
            */}
            <FacetBlock
              title="Categories"
              options={categories.map((c) => c.name)}
              active={activeCategory}
              onSelect={setActiveCategory}
              counts={categoryCounts}
            />
            <FacetBlock
              title="Brands"
              options={brands}
              active={activeBrand}
              onSelect={setActiveBrand}
              counts={brandCounts}
            />
            <FacetBlock
              title="Price"
              options={PRICE_BANDS.map((b) => b.name)}
              active={activePrice}
              onSelect={setActivePrice}
              counts={priceCounts}
            />
            <FacetBlock
              title="Frame shape"
              options={shapes}
              active={activeShape}
              onSelect={setActiveShape}
              counts={shapeCounts}
            />
            <FacetBlock
              title="Gender"
              options={genders}
              active={activeGender}
              onSelect={setActiveGender}
              counts={genderCounts}
            />
            <FacetBlock
              title="Material"
              options={materials}
              active={activeMaterial}
              onSelect={setActiveMaterial}
              counts={materialCounts}
            />

            {activeFilters > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="font-inter mt-[8px] flex h-[40px] w-full items-center justify-center rounded-[10px] border-[0.8px] border-[#D4D4D4] text-[15px] text-[#2E3192] transition-colors hover:bg-gray-50 lg:w-[250px]"
              >
                Clear all filters ({activeFilters})
              </button>
            )}
          </aside>

          {/* Product Grid Area (Width: 918px) */}
          <section className="mt-10 flex flex-col lg:mt-0 lg:w-[918px] lg:gap-[24px]">
            {/* Top Header */}
            <div className="flex items-center justify-between lg:h-[36px] lg:w-[918px]">
              <span
                className="flex items-center whitespace-nowrap text-[#717182] lg:h-[24px]"
                style={{ fontFamily: 'Arimo, sans-serif', fontSize: '16px', lineHeight: '24px' }}
              >
                {visible.length === 0
                  ? 'No products'
                  : pageCount > 1
                    ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, visible.length)} of ${visible.length} products`
                    : `Showing ${visible.length} ${visible.length === 1 ? 'product' : 'products'}`}
              </span>

              {/* The design leaves an empty slot at this corner; sort fills it. */}
              <label className="flex items-center gap-[8px]">
                <span className="sr-only">Sort products by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="font-inter h-[36px] cursor-pointer rounded-[10px] border-[0.8px] border-[#D4D4D4] bg-white px-[12px] text-[15px] text-[#0A0A0A] focus:border-[#2E3192] focus:outline-none"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {visible.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-[32px] border-[0.8px] border-[#D4D4D4] px-6 py-[80px] text-center lg:w-[918px]">
                <h2 className="font-poppins mb-[8px] text-[22px] font-semibold text-[#0A0A0A]">
                  No frames match these filters
                </h2>
                <p className="font-inter mb-[24px] max-w-[420px] text-[16px] text-[#717182]">
                  {products.length === 0
                    ? 'Our collection is being updated. Please check back shortly.'
                    : 'Try widening your search — removing the price band usually helps most.'}
                </p>
                {activeFilters > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="font-inter flex h-[44px] items-center justify-center rounded-[26843500px] bg-[#2E3192] px-[28px] text-[15px] font-semibold text-white transition-colors hover:bg-[#1e2361]"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:w-[918px] lg:grid-cols-3 lg:gap-[24px]">
              {pageItems.map((product) => (
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
                    {/* Frame-shape pill — omitted rather than guessed when the
                        product has no shape set, so the card never labels an
                        eyeglass frame "Sunglasses". */}
                    {product.frame_shape && (
                      <div className="absolute right-[16px] top-[16px] z-10 flex items-center justify-center rounded-[20px] bg-white px-[12px] py-[6px] shadow-sm">
                        <span className="font-inter text-[12px] font-medium capitalize text-[#2E3192]">
                          {product.frame_shape}
                        </span>
                      </div>
                    )}

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

            {pageCount > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-[32px] flex items-center justify-center gap-[8px] lg:w-[918px]"
              >
                <button
                  type="button"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 1}
                  className="font-inter flex h-[40px] items-center justify-center rounded-[10px] border-[0.8px] border-[#D4D4D4] px-[16px] text-[15px] text-[#0A0A0A] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === safePage ? 'page' : undefined}
                    className={`font-inter flex h-[40px] w-[40px] items-center justify-center rounded-[10px] text-[15px] transition-colors ${
                      n === safePage
                        ? 'bg-[#2E3192] text-white'
                        : 'border-[0.8px] border-[#D4D4D4] text-[#0A0A0A] hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage === pageCount}
                  className="font-inter flex h-[40px] items-center justify-center rounded-[10px] border-[0.8px] border-[#D4D4D4] px-[16px] text-[15px] text-[#0A0A0A] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default function Page() {
  return <Shop />;
}
