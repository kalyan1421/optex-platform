'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

/**
 * Map an API cart line onto the shape the UI renders.
 *
 * Prices come from the server on every response — the client never computes a
 * line total or a cart total, so what the customer sees is always a figure the
 * server actually blessed.
 */
function apiItemToCartItem(item) {
  return {
    id: item.id,
    productId: item.productId,
    title: item.product.name,
    price: String(item.product.priceKes),
    image: item.product.image ?? '',
    quantity: item.quantity,
    brand: item.product.brand ?? '',
    variant: item.lensOption ? JSON.stringify(item.lensOption) : '',
  };
}

/**
 * Where the guest cart lives between page loads.
 *
 * A signed-out cart has no server row — orders require an account — so without
 * this it existed only in React state and any full page load discarded it.
 * That made it impossible to fill a cart and then sign in to buy, which is the
 * one journey a guest cart exists to support.
 */
const GUEST_CART_KEY = 'optex.guest-cart.v1';

function readGuestCart() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt or unavailable (private mode, quota) — an empty cart is a safe
    // fallback, and never worth breaking the page over.
    return [];
  }
}

function writeGuestCart(items) {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) window.localStorage.removeItem(GUEST_CART_KEY);
    else window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked. The in-memory cart still works for this page.
  }
}

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [cartId, setCartId] = useState(null);
  const [error, setError] = useState('');
  const { user } = useAuth();

  /** Apply a `Cart` response — every mutation returns the full, current cart. */
  function applyCart(cart) {
    setCartId(cart?.cartId ?? null);
    setItems((cart?.items ?? []).map(apiItemToCartItem));
  }

  // Guards the merge below. A ref, not state, because it must be read and
  // written synchronously inside the effect — a state flag would still be
  // stale on a second invocation in the same tick, which is exactly the
  // double-fire we are defending against (React 18 StrictMode runs effects
  // twice in development).
  const mergingRef = useRef(false);

  // Distinguishes "not signed in yet" from "just signed out" — the effect below
  // sees `user == null` in both cases, but only the second should empty a cart.
  const wasAuthedRef = useRef(false);

  // Mirrors `items` so the sign-in effect can read the guest cart without
  // listing `items` as a dependency — which would re-run the whole merge every
  // time the cart changed.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Restore the guest cart after mount rather than in the initial state, so
  // the server-rendered HTML and the first client render agree. Reading
  // localStorage during render would hydrate a different tree than the server
  // sent.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (user) return; // an authenticated cart comes from the server instead
    const stored = readGuestCart();
    if (stored.length > 0) setItems(stored);
  }, [user]);

  // Persist every guest-cart change. Skipped while signed in: that cart is the
  // server's, and mirroring it here would resurrect stale lines after sign-out.
  useEffect(() => {
    if (!hydratedRef.current || user) return;
    writeGuestCart(items);
  }, [items, user]);

  // Load the server cart on sign-in; clear it on sign-out. Auth state comes
  // from AuthContext rather than a second Supabase session listener.
  useEffect(() => {
    if (!user) {
      // Only clear on an actual sign-out. This branch also runs on first mount
      // for every signed-out visitor, and clearing there wiped the guest cart
      // that had just been restored from storage — the persist effect then
      // wrote the empty result back, so the cart never survived a reload.
      if (wasAuthedRef.current) {
        wasAuthedRef.current = false;
        setItems([]);
        writeGuestCart([]);
      }
      setCartId(null);
      mergingRef.current = false;
      return;
    }
    wasAuthedRef.current = true;

    let cancelled = false;

    /**
     * Hand the guest cart over at sign-in.
     *
     * Orders require an account, so the customer who fills a cart signed out
     * has to sign in to check out — the one moment this cart matters most.
     * Previously that sign-in replaced local state with the server cart and
     * the guest lines were silently gone, losing the order at the last step.
     *
     * Lines are pushed one at a time rather than in parallel: `addItem`
     * returns the whole recomputed cart, and concurrent writes to the same
     * cart race on the line-merge rule the API owns. Sequential is slower and
     * correct, and a guest cart is a handful of items.
     *
     * A failed line is logged and skipped rather than aborting: arriving with
     * three of four items beats arriving with none. The server cart is applied
     * either way, so what the customer sees is always what the server holds.
     */
    async function loadAndMerge() {
      // Prefer storage over React state: on a fresh page load the sign-in
      // effect can run before the hydration effect has copied the stored cart
      // into state, and the stored copy is the one that survived the reload.
      const stored = readGuestCart();
      const guestLines = stored.length > 0 ? stored : itemsRef.current;
      const shouldMerge = guestLines.length > 0 && !mergingRef.current;

      if (shouldMerge) {
        mergingRef.current = true;
        // Clear before the requests, not after. A merge that fails halfway
        // must not leave lines that a later sign-in would add a second time —
        // losing a line is recoverable, silently doubling an order is not.
        writeGuestCart([]);
        for (const line of guestLines) {
          if (cancelled) return;
          try {
            await api.cart.addItem({
              productId: line.productId ?? line.id,
              quantity: line.quantity ?? 1,
            });
          } catch (err) {
            console.error('Cart merge: could not carry over a line:', err);
          }
        }
      }

      try {
        const cart = await api.cart.get();
        if (!cancelled) applyCart(cart);
      } catch (err) {
        if (!cancelled) console.error('Cart load error:', err);
      }
    }

    void loadAndMerge();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const addToCart = async (product) => {
    if (user) {
      try {
        // The API owns availability, quantity bounds and the line-merge rule,
        // and returns the recomputed cart — no second round-trip to reload.
        const cart = await api.cart.addItem({
          productId: product.id,
          quantity: product.quantity ?? 1,
        });
        applyCart(cart);
        setError('');
      } catch (err) {
        console.error('addItem error:', err);
        setError(err?.message ?? 'Could not add that item to your cart.');
      }
    } else {
      // Guest — in-memory only, and not carried over at sign-in: the sign-in
      // effect above replaces local state with the server cart, so a guest who
      // fills a cart and then logs in to check out loses it. Orders require an
      // account, so this is worth a proper merge (push local lines through
      // api.cart.addItem before applying the server cart) — tracked separately.
      // M-2 FIX: include the variant (lens option) in the match key so the same
      // frame with different lens options is not collapsed into one cart item.
      setItems((prev) => {
        const variantKey = product.variant ?? '';
        const existing = prev.find((i) => i.id === product.id && (i.variant ?? '') === variantKey);
        if (existing) {
          return prev.map((i) =>
            i.id === product.id && (i.variant ?? '') === variantKey
              ? { ...i, quantity: i.quantity + (product.quantity ?? 1) }
              : i,
          );
        }
        return [...prev, { ...product, quantity: product.quantity ?? 1 }];
      });
    }
  };

  const updateQuantity = async (id, delta) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newQty = Math.max(1, item.quantity + delta);
    if (user) {
      try {
        const cart = await api.cart.updateItem(id, { quantity: newQty });
        applyCart(cart);
        setError('');
      } catch (err) {
        console.error('updateItem error:', err);
        setError(err?.message ?? 'Could not update that item.');
      }
    } else {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: newQty } : i)));
    }
  };

  const removeItem = async (id) => {
    if (user) {
      try {
        const cart = await api.cart.removeItem(id);
        applyCart(cart);
        setError('');
      } catch (err) {
        console.error('removeItem error:', err);
        setError(err?.message ?? 'Could not remove that item.');
      }
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const cartCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addToCart, updateQuantity, removeItem, cartCount, cartId, error }}
    >
      {children}
      {/*
        The API owns availability and quantity bounds, so a rejected cart
        mutation is the only signal the customer gets that (say) stock ran out.
        Rendering it here rather than in each consumer means every surface that
        calls addToCart/updateQuantity/removeItem is covered — previously the
        error was set on every failure path but read by nobody, so a rejected
        add looked identical to nothing happening.
      */}
      {error && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-lg bg-red-600 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Dismiss"
            className="shrink-0 text-lg leading-none opacity-80 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}
    </CartContext.Provider>
  );
};
