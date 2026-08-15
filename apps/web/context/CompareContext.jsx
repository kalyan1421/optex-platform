'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const CompareContext = createContext();

export const useCompare = () => useContext(CompareContext);

/** A browsing aid, not an order-affecting entity — never synced to the server. */
const COMPARE_KEY = 'optex.compare.v1';

/** Four is the most a side-by-side table stays legible at, especially on mobile. */
const MAX_COMPARE = 4;

function readStored() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStored(items) {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) window.localStorage.removeItem(COMPARE_KEY);
    else window.localStorage.setItem(COMPARE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked — the in-memory list still works for this page.
  }
}

/** The lean product shape stored/compared — enough to render the tray and table. */
function toCompareItem(product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand ?? '',
    image: product.image,
    priceKes: product.price_kes,
    frameMaterial: product.frame_material ?? '',
    frameShape: product.frame_shape ?? '',
    gender: product.gender ?? '',
  };
}

export const CompareProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState('');

  // Restore after mount, not in initial state, so the server-rendered HTML
  // and the first client render agree — reading localStorage during render
  // would hydrate a different tree than the server sent.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    setItems(readStored());
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    writeStored(items);
  }, [items]);

  const isCompared = (id) => items.some((i) => i.id === id);

  const toggle = (product) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === product.id)) {
        return prev.filter((i) => i.id !== product.id);
      }
      if (prev.length >= MAX_COMPARE) {
        setNotice(`You can compare up to ${MAX_COMPARE} frames at a time.`);
        return prev;
      }
      return [...prev, toCompareItem(product)];
    });
  };

  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clear = () => setItems([]);

  return (
    <CompareContext.Provider
      value={{
        items,
        toggle,
        remove,
        clear,
        isCompared,
        compareCount: items.length,
        maxCompare: MAX_COMPARE,
      }}
    >
      {children}
      {notice && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-lg bg-[#2A3182] px-4 py-3 text-sm text-white shadow-lg"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label="Dismiss"
            className="shrink-0 text-lg leading-none opacity-80 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}
    </CompareContext.Provider>
  );
};
