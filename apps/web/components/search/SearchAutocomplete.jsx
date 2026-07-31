'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@optex/db/browser';
import { listProducts } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

/**
 * Debounced product search with an autocomplete listbox.
 *
 * Backed by Supabase full-text search (`listProducts({ search })` builds a
 * prefix tsquery against the generated `search_tsv` column), so suggestions
 * match the same index the results page uses.
 *
 * Implemented as an ARIA 1.2 combobox: the input keeps focus and owns
 * aria-activedescendant while Arrow keys move a virtual cursor through the
 * listbox. That is what makes it usable without a mouse — the previous search
 * boxes were submit-only, with nothing to navigate.
 */

const DEBOUNCE_MS = 250;
const MAX_SUGGESTIONS = 6;
const MIN_QUERY = 2;

export default function SearchAutocomplete({
  autoFocus = false,
  placeholder = 'Search frames, brands, styles…',
  initialValue = '',
  onNavigate,
  className = '',
}) {
  const router = useRouter();
  const listboxId = useId();

  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [cursor, setCursor] = useState(-1);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  // Guards against a slow early request overwriting a newer one's results.
  const requestSeq = useRef(0);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const term = value.trim();
    if (term.length < MIN_QUERY) {
      setSuggestions([]);
      setStatus('idle');
      return undefined;
    }

    setStatus('loading');
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const db = createBrowserSupabase();
        const results = await listProducts(db, { search: term, limit: MAX_SUGGESTIONS });
        if (seq !== requestSeq.current) return; // a newer keystroke won
        setSuggestions(results);
        setStatus('ready');
        setCursor(-1);
      } catch (err) {
        console.error('Search suggestions error:', err);
        if (seq === requestSeq.current) setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value]);

  // Close when focus or a click leaves the widget.
  useEffect(() => {
    function onPointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const goToResults = useCallback(
    (term) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      setOpen(false);
      onNavigate?.();
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    },
    [router, onNavigate],
  );

  const goToProduct = useCallback(
    (product) => {
      setOpen(false);
      onNavigate?.();
      router.push(`/product/${product.slug}`);
    },
    [router, onNavigate],
  );

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false);
      setCursor(-1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && cursor >= 0 && suggestions[cursor]) goToProduct(suggestions[cursor]);
      else goToResults(value);
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (suggestions.length === 0) return;

    // Prevent the caret jumping to either end of the input while navigating.
    event.preventDefault();
    setOpen(true);
    setCursor((prev) => {
      if (event.key === 'ArrowDown') return prev + 1 >= suggestions.length ? 0 : prev + 1;
      return prev - 1 < 0 ? suggestions.length - 1 : prev - 1;
    });
  }

  const showPanel = open && value.trim().length >= MIN_QUERY;
  const noResults = status === 'ready' && suggestions.length === 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          goToResults(value);
        }}
      >
        <label htmlFor={`${listboxId}-input`} className="sr-only">
          Search products
        </label>
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          type="search"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={cursor >= 0 ? `${listboxId}-opt-${cursor}` : undefined}
          className="w-full rounded-full border border-gray-200 bg-white py-3 pl-5 pr-12 text-[14px] outline-none transition-colors focus:border-[#2A3182] focus:ring-2 focus:ring-[#2A3182]/20"
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#2A3182] text-white transition-colors hover:bg-[#1f2666] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182] focus-visible:ring-offset-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
        </button>
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          {status === 'loading' && suggestions.length === 0 && (
            <p className="px-5 py-4 text-[13px] font-medium text-gray-400">Searching…</p>
          )}

          {status === 'error' && (
            <p role="alert" className="px-5 py-4 text-[13px] font-medium text-red-600">
              Search is unavailable right now. Press Enter to try the full results page.
            </p>
          )}

          {noResults && (
            <div className="px-5 py-6 text-center">
              <p className="text-[14px] font-bold text-gray-900">
                No matches for “{value.trim()}”
              </p>
              <p className="mt-1 text-[12.5px] text-gray-500">
                Try a brand, a frame shape, or browse the full collection.
              </p>
            </div>
          )}

          {suggestions.length > 0 && (
            <ul id={listboxId} role="listbox" aria-label="Product suggestions" className="max-h-[360px] overflow-y-auto py-1">
              {suggestions.map((product, index) => (
                <li
                  key={product.id}
                  id={`${listboxId}-opt-${index}`}
                  role="option"
                  aria-selected={cursor === index}
                  onMouseEnter={() => setCursor(index)}
                  // onMouseDown, not onClick: mousedown fires before the input's
                  // blur closes the panel and cancels the selection.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    goToProduct(product);
                  }}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
                    cursor === index ? 'bg-[#f2f3fb]' : ''
                  }`}
                >
                  <img
                    src={getProductImageUrl(product)}
                    alt=""
                    loading="lazy"
                    className="h-11 w-11 shrink-0 rounded-lg border border-gray-100 object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold text-gray-900">
                      {product.name}
                    </span>
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      {product.brand}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-black text-[#2A3182]">
                    {formatKes(Number(product.price_kes))}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {suggestions.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                goToResults(value);
              }}
              className="w-full border-t border-gray-100 px-5 py-3 text-left text-[12.5px] font-bold text-[#2A3182] transition-colors hover:bg-[#f8f9fb]"
            >
              See all results for “{value.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
