'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatKes } from '@optex/ui';
import { api } from '@/lib/api';
import { getProductImageUrl } from '@/lib/product-image';

/** Wait this long after the last keystroke before querying. */
const DEBOUNCE_MS = 250;
/** Shortest query worth running — one character matches most of the catalogue. */
const MIN_CHARS = 2;
const MAX_SUGGESTIONS = 6;

const SearchGlyph = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

/**
 * Typeahead over the product catalogue.
 *
 * Suggestions come from the API's `/products/search`, the SAME endpoint the
 * `/search` results page uses (audit F-13). This previously read Supabase
 * directly with the anon key, which left the storefront with two different
 * search implementations that could disagree with each other for the same
 * query — the suggestion list said one thing, the page it navigated to said
 * another.
 */
export default function SearchAutocomplete({
  value,
  onChange,
  onNavigate,
  inputRef,
  placeholder = 'Search frames, sunglasses, brands…',
  autoFocus = false,
}) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef(null);
  // Monotonic id so a slow early response cannot overwrite a fast later one.
  const requestId = useRef(0);

  const query = value.trim();

  useEffect(() => {
    if (query.length < MIN_CHARS) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      // F-13 FIX: this used to query PostgREST directly with the anon key via
      // `listProducts(db, …)`, which meant the storefront had TWO search
      // implementations — a plain filter here, and the API's
      // `websearch_to_tsquery` with an ilike fallback on /search. The same
      // typing could produce suggestions that disagreed with the results page
      // it led to. Going through the API also puts these requests back under
      // its rate limiting and input validation, which the direct path skipped.
      api.catalog
        .searchProducts({ q: query, limit: MAX_SUGGESTIONS })
        .then((res) => {
          if (id !== requestId.current) return; // a newer keystroke won
          setSuggestions(res?.items ?? []);
          setHighlight(-1);
          setOpen(true);
        })
        .catch(() => {
          if (id !== requestId.current) return;
          // A failed suggest is not worth interrupting typing over — the form
          // still submits to /search, which reports its own errors.
          setSuggestions([]);
          setOpen(false);
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on an outside click, so the panel does not linger over the page.
  useEffect(() => {
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function goToSearch(q) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setOpen(false);
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function goToProduct(product) {
    setOpen(false);
    onNavigate?.();
    router.push(`/product/${product.slug}`);
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Escape') onNavigate?.();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      // Enter on a highlighted row opens that product; otherwise it runs the
      // full search, which is what a user who ignored the list expects.
      if (highlight >= 0) {
        e.preventDefault();
        goToProduct(suggestions[highlight]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  const showPanel = open && query.length >= MIN_CHARS;

  return (
    <div ref={containerRef} className="relative flex-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToSearch(value);
        }}
      >
        <div className="flex items-center overflow-hidden rounded-xl border border-gray-200 bg-[#f4f6f8] transition-colors focus-within:border-[#2A3182]">
          <div className="flex-shrink-0 pl-4 pr-2 text-gray-400">
            <SearchGlyph />
          </div>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls="search-suggestions"
            aria-autocomplete="list"
            autoComplete="off"
            // Caller-controlled, and only ever passed true when the user has just
            // opened the search overlay. Moving focus into the field they asked
            // for is correct for every user, screen-reader included; the rule
            // guards against focus stealing on page load, which is not this.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= MIN_CHARS && setOpen(true)}
            placeholder={placeholder}
            className="flex-1 bg-transparent px-2 py-3 text-[15px] font-medium text-[#1a1a1a] placeholder-gray-300 outline-none"
          />
          {loading && (
            <div className="flex-shrink-0 pr-4 text-[12px] font-medium text-gray-400">…</div>
          )}
        </div>
      </form>

      {showPanel && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl"
        >
          {suggestions.length === 0 ? (
            <p className="px-4 py-5 text-center text-[14px] text-gray-400">
              {loading ? 'Searching…' : `No frames match “${query}”`}
            </p>
          ) : (
            <ul>
              {suggestions.map((product, i) => (
                <li key={product.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => goToProduct(product)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      i === highlight ? 'bg-[#f4f6f8]' : 'bg-white hover:bg-[#f4f6f8]'
                    }`}
                  >
                    <img
                      src={getProductImageUrl(product)}
                      alt=""
                      className="h-11 w-11 flex-shrink-0 rounded-lg bg-[#F5F5F5] object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-[#1a1a1a]">
                        {product.name}
                      </span>
                      {product.brand && (
                        <span className="block truncate text-[12px] uppercase tracking-wide text-[#717182]">
                          {product.brand}
                        </span>
                      )}
                    </span>
                    <span className="flex-shrink-0 text-[14px] font-bold text-[#2A3182]">
                      {formatKes(Number(product.price_kes))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => goToSearch(value)}
            className="w-full border-t border-gray-100 px-4 py-3 text-left text-[13px] font-bold text-[#2A3182] transition-colors hover:bg-[#f4f6f8]"
          >
            See all results for “{query}”
          </button>
        </div>
      )}
    </div>
  );
}
