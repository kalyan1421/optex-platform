'use client';

import React, { useEffect, useState } from 'react';

/**
 * Shared product faceting for /shop and /search.
 *
 * Both pages filter the same `products` rows against the same columns, so the
 * facet logic, the counting rule and the sidebar markup live here rather than
 * being copied. The Figma Shop screen specifies only Categories and Brands;
 * Price, Frame shape, Gender and Material are not in the design — those columns
 * have existed in `products` since 0001 and were unused.
 * See docs/DESIGN-STATUS.md §5.
 */

/** Price bands, in KES. Bands rather than a dual-thumb slider — the sidebar has
 *  one established control, a list of selectable rows, and a slider is a new
 *  component with no design behind it. */
export const PRICE_BANDS = [
  { name: 'All', test: () => true },
  { name: 'Under KSh 10,000', test: (p) => p < 10000 },
  { name: 'KSh 10,000 – 20,000', test: (p) => p >= 10000 && p < 20000 },
  { name: 'KSh 20,000 – 30,000', test: (p) => p >= 20000 && p < 30000 },
  { name: 'Over KSh 30,000', test: (p) => p >= 30000 },
];

export const SORT_OPTIONS = [
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
export function facetValues(products, key) {
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
export function matchesFacet(value, selected) {
  if (selected === 'All') return true;
  return (
    String(value ?? '')
      .trim()
      .toLowerCase() === selected.trim().toLowerCase()
  );
}

/** Apply a sort option to a copy of `rows`. */
export function sortProducts(rows, sortBy) {
  return [...rows].sort((a, b) => {
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
}

/**
 * One sidebar facet — the established Shop control: a heading with a hairline
 * rule, then selectable rows.
 */
export function FacetBlock({ title, options, active, onSelect, counts }) {
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

/**
 * Facet state, filtering and counts for a product list.
 *
 * `categories` is optional — /search has no category sidebar of its own, so it
 * passes nothing and the Categories facet simply does not render.
 */
export function useProductFacets(products, categories = []) {
  const [category, setCategory] = useState('All');
  const [brand, setBrand] = useState('All');
  const [shape, setShape] = useState('All');
  const [gender, setGender] = useState('All');
  const [material, setMaterial] = useState('All');
  const [price, setPrice] = useState('All');

  const selection = { category, brand, shape, gender, material, price };

  const brands = facetValues(products, 'brand');
  const shapes = facetValues(products, 'frame_shape');
  const genders = facetValues(products, 'gender');
  const materials = facetValues(products, 'frame_material');

  const categoryIdFor = (name) => categories.find((c) => c.name === name)?.id ?? null;

  /**
   * Does `p` satisfy the current selection?
   *
   * `except` skips one facet, which is what makes the sidebar counts correct:
   * the number beside "Round" has to be how many products you would get if you
   * picked Round *given the other filters*, so Round's own value must not
   * constrain its own count.
   */
  function matches(p, except) {
    if (except !== 'category' && selection.category !== 'All') {
      const id = categoryIdFor(selection.category);
      if (id && p.category_id !== id) return false;
    }
    if (except !== 'brand' && selection.brand !== 'All' && p.brand !== selection.brand)
      return false;
    if (except !== 'shape' && !matchesFacet(p.frame_shape, selection.shape)) return false;
    if (except !== 'gender' && !matchesFacet(p.gender, selection.gender)) return false;
    if (except !== 'material' && !matchesFacet(p.frame_material, selection.material)) return false;
    if (except !== 'price') {
      const band = PRICE_BANDS.find((b) => b.name === selection.price) ?? PRICE_BANDS[0];
      if (!band.test(Number(p.price_kes))) return false;
    }
    return true;
  }

  /** Option → result count for one facet, ignoring that facet's own selection. */
  function countsFor(key, options, valueOf) {
    const pool = products.filter((p) => matches(p, key));
    const out = { All: pool.length };
    for (const opt of options) {
      if (opt === 'All') continue;
      out[opt] = pool.filter((p) => matchesFacet(valueOf(p), opt)).length;
    }
    return out;
  }

  const categoryCounts = (() => {
    const pool = products.filter((p) => matches(p, 'category'));
    const out = { All: pool.length };
    for (const c of categories) {
      if (c.name === 'All') continue;
      out[c.name] = pool.filter((p) => p.category_id === c.id).length;
    }
    return out;
  })();

  const priceCounts = (() => {
    const pool = products.filter((p) => matches(p, 'price'));
    return Object.fromEntries(
      PRICE_BANDS.map((b) => [b.name, pool.filter((p) => b.test(Number(p.price_kes))).length]),
    );
  })();

  const filtered = products.filter((p) => matches(p));
  const activeFilters = Object.values(selection).filter((v) => v !== 'All').length;

  function clearFilters() {
    setCategory('All');
    setBrand('All');
    setShape('All');
    setGender('All');
    setMaterial('All');
    setPrice('All');
  }

  const sidebarProps = {
    categories,
    categoryCounts,
    brands,
    brandCounts: countsFor('brand', brands, (p) => p.brand),
    priceCounts,
    shapes,
    shapeCounts: countsFor('shape', shapes, (p) => p.frame_shape),
    genders,
    genderCounts: countsFor('gender', genders, (p) => p.gender),
    materials,
    materialCounts: countsFor('material', materials, (p) => p.frame_material),
    selection,
    setCategory,
    setBrand,
    setShape,
    setGender,
    setMaterial,
    setPrice,
    activeFilters,
    clearFilters,
    hasProducts: products.length > 0,
  };

  return { filtered, activeFilters, clearFilters, selection, sidebarProps };
}

/** The six-facet sidebar. Hidden when the catalogue itself is empty — every
 *  facet would read (0) and none would do anything. */
export function ProductFilterSidebar({
  categories,
  categoryCounts,
  brands,
  brandCounts,
  priceCounts,
  shapes,
  shapeCounts,
  genders,
  genderCounts,
  materials,
  materialCounts,
  selection,
  setCategory,
  setBrand,
  setShape,
  setGender,
  setMaterial,
  setPrice,
  activeFilters,
  clearFilters,
  hasProducts,
}) {
  return (
    <aside
      className={`w-full flex-shrink-0 lg:w-[250px] lg:flex-col lg:gap-[32px] ${hasProducts ? 'lg:flex' : 'hidden'}`}
    >
      {categories.length > 0 && (
        <FacetBlock
          title="Categories"
          options={categories.map((c) => c.name)}
          active={selection.category}
          onSelect={setCategory}
          counts={categoryCounts}
        />
      )}
      <FacetBlock
        title="Brands"
        options={brands}
        active={selection.brand}
        onSelect={setBrand}
        counts={brandCounts}
      />
      <FacetBlock
        title="Price"
        options={PRICE_BANDS.map((b) => b.name)}
        active={selection.price}
        onSelect={setPrice}
        counts={priceCounts}
      />
      <FacetBlock
        title="Frame shape"
        options={shapes}
        active={selection.shape}
        onSelect={setShape}
        counts={shapeCounts}
      />
      <FacetBlock
        title="Gender"
        options={genders}
        active={selection.gender}
        onSelect={setGender}
        counts={genderCounts}
      />
      <FacetBlock
        title="Material"
        options={materials}
        active={selection.material}
        onSelect={setMaterial}
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
  );
}

/** Sort dropdown. On /shop this fills the empty slot the design leaves at the
 *  top-right of the product area. */
export function SortSelect({ value, onChange }) {
  return (
    <label className="flex items-center gap-[8px]">
      <span className="sr-only">Sort products by</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-inter h-[36px] cursor-pointer rounded-[10px] border-[0.8px] border-[#D4D4D4] bg-white px-[12px] text-[15px] text-[#0A0A0A] focus:border-[#2E3192] focus:outline-none"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Numbered pagination with Prev/Next. Renders nothing for a single page. */
export function Pagination({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="mt-[32px] flex items-center justify-center gap-[8px] lg:w-[918px]"
    >
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="font-inter flex h-[40px] items-center justify-center rounded-[10px] border-[0.8px] border-[#D4D4D4] px-[16px] text-[15px] text-[#0A0A0A] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>

      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-current={n === page ? 'page' : undefined}
          className={`font-inter flex h-[40px] w-[40px] items-center justify-center rounded-[10px] text-[15px] transition-colors ${
            n === page
              ? 'bg-[#2E3192] text-white'
              : 'border-[0.8px] border-[#D4D4D4] text-[#0A0A0A] hover:bg-gray-50'
          }`}
        >
          {n}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === pageCount}
        className="font-inter flex h-[40px] items-center justify-center rounded-[10px] border-[0.8px] border-[#D4D4D4] px-[16px] text-[15px] text-[#0A0A0A] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}

/** Reset a page number to 1 whenever the selection changes. */
export function useResetPageOnFilterChange(selection, setPage) {
  const key = Object.values(selection).join('|');
  useEffect(() => {
    setPage(1);
  }, [key, setPage]);
}
