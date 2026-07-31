'use client';

import React from 'react';

/**
 * Shop sidebar filters.
 *
 * Split out of the shop page so the category pages can reuse the same control
 * set instead of growing a second, drifting copy.
 *
 * Every group is a fieldset with a legend so the filter names are announced to
 * screen readers, and the options are real checkboxes/radios rather than
 * clickable <li>s — the previous version used onClick on list items, which
 * keyboard users could not reach at all.
 */

function FilterGroup({ legend, children }) {
  return (
    <fieldset className="mb-8">
      <legend className="mb-4 text-[15px] font-bold uppercase tracking-[0.1em] text-[#1a1a1a]">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function CheckboxRow({ name, value, checked, onChange, label, count }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg py-2 text-[14px] font-medium text-gray-600 transition-colors hover:text-[#2A3182]">
      <span className="flex items-center gap-2.5">
        <input
          type="checkbox"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-[#2A3182] focus:ring-2 focus:ring-[#2A3182] focus:ring-offset-1"
        />
        <span>{label}</span>
      </span>
      {count !== undefined && <span className="text-[11px] text-gray-400">({count})</span>}
    </label>
  );
}

export default function ProductFilters({
  facets,
  selected,
  onToggle,
  onPriceChange,
  onAvailabilityChange,
  onReset,
  activeCount,
}) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[17px] font-black text-[#1a1a1a]">Filters</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-[12px] font-bold text-[#E53935] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E53935]"
          >
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {facets.categories.length > 0 && (
        <FilterGroup legend="Category">
          {facets.categories.map((c) => (
            <CheckboxRow
              key={c.id}
              name="category"
              value={c.id}
              checked={selected.category.includes(c.id)}
              onChange={() => onToggle('category', c.id)}
              label={c.name}
              count={c.count}
            />
          ))}
        </FilterGroup>
      )}

      {facets.brands.length > 0 && (
        <FilterGroup legend="Brand">
          {facets.brands.map((b) => (
            <CheckboxRow
              key={b}
              name="brand"
              value={b}
              checked={selected.brand.includes(b)}
              onChange={() => onToggle('brand', b)}
              label={b}
            />
          ))}
        </FilterGroup>
      )}

      {facets.genders.length > 0 && (
        <FilterGroup legend="Gender">
          {facets.genders.map((g) => (
            <CheckboxRow
              key={g}
              name="gender"
              value={g}
              checked={selected.gender.includes(g)}
              onChange={() => onToggle('gender', g)}
              label={g.charAt(0).toUpperCase() + g.slice(1)}
            />
          ))}
        </FilterGroup>
      )}

      {facets.shapes.length > 0 && (
        <FilterGroup legend="Frame shape">
          {facets.shapes.map((s) => (
            <CheckboxRow
              key={s}
              name="shape"
              value={s}
              checked={selected.shape.includes(s)}
              onChange={() => onToggle('shape', s)}
              label={s}
            />
          ))}
        </FilterGroup>
      )}

      {facets.materials.length > 0 && (
        <FilterGroup legend="Material">
          {facets.materials.map((m) => (
            <CheckboxRow
              key={m}
              name="material"
              value={m}
              checked={selected.material.includes(m)}
              onChange={() => onToggle('material', m)}
              label={m}
            />
          ))}
        </FilterGroup>
      )}

      <FilterGroup legend="Price (KES)">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="price-min">
            Minimum price
          </label>
          <input
            id="price-min"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Min"
            value={selected.minPrice}
            onChange={(e) => onPriceChange('minPrice', e.target.value)}
            className="w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-[#2A3182] focus:ring-1 focus:ring-[#2A3182]"
          />
          <span aria-hidden="true" className="text-gray-400">
            –
          </span>
          <label className="sr-only" htmlFor="price-max">
            Maximum price
          </label>
          <input
            id="price-max"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Max"
            value={selected.maxPrice}
            onChange={(e) => onPriceChange('maxPrice', e.target.value)}
            className="w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-[#2A3182] focus:ring-1 focus:ring-[#2A3182]"
          />
        </div>
      </FilterGroup>

      <FilterGroup legend="Availability">
        <CheckboxRow
          name="availability"
          value="in-stock"
          checked={selected.inStockOnly}
          onChange={(e) => onAvailabilityChange(e.target.checked)}
          label="In stock only"
        />
      </FilterGroup>
    </div>
  );
}
