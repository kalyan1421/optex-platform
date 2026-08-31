'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { resolveImageUrl } from '@/lib/product-image';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

/**
 * Map an API cart line onto the shape the UI renders.
 *
 * Prices come from the server on every response — the client never computes a
 * line total or a cart total, so what the customer sees is always a figure the
 * server actually blessed.
 */
/** Human labels for the configuration keys the PDP currently sends. */
const LENS_OPTION_LABELS = { frameColor: 'Frame' };

/**
 * Renders a line's configuration the way the shopper picked it.
 *
 * The guest cart keeps the label the PDP supplies ("Frame: Black"); the
 * account cart only gets `lensOption` back from the API and used to show it as
 * `JSON.stringify` output — so the same line read "Frame: Black" signed out and
 * `{"frameColor":"black"}` signed in. Formatting here means both carts, and the
 * checkout summary that reads the same field, say the same thing.
 *
 * Unknown keys degrade rather than disappear: `lensCoating` becomes
 * "Lens Coating", so a configurator that adds fields stays readable before
 * anyone adds a label for them.
 */
function formatLensOption(lensOption) {
  if (!lensOption || typeof lensOption !== 'object') return '';
  return Object.entries(lensOption)
    .map(([key, value]) => {
      const label =
        LENS_OPTION_LABELS[key] ??
        key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
      const text = String(value ?? '');
      return `${label}: ${text.charAt(0).toUpperCase()}${text.slice(1)}`;
    })
    .join(', ');
}

function apiItemToCartItem(item) {
  return {
    id: item.id,
    productId: item.productId,
    title: item.product.name,
    price: String(item.product.priceKes),
    // The cart API returns the RAW stored path (product.images[0] server-side),
    // not a displayable URL — seed products are `/seed/<name>.png`, which is
    // meaningless outside the resolution table `resolveImageUrl` applies. Every
    // other listing already goes through it via `getProductImageUrl`; this is
    // the one place with a single path rather than a `product.images` array.
    image: resolveImageUrl(item.product.image),
    quantity: item.quantity,
    brand: item.product.brand ?? '',
    variant: formatLensOption(item.lensOption),
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
  // The server's fully-computed cart: subtotal, discount, VAT, total, and any
  // applied promo. `null` for a guest cart, which has no server counterpart.
  const [cartView, setCartView] = useState(null);
  const [error, setError] = useState('');
  // Starts true. Both carts arrive asynchronously — the guest cart from
  // localStorage after mount, the account cart from the API — so `items` is
  // briefly `[]` for a customer who has one. Without this, any consumer that
  // renders an empty state shows it to everyone on first paint.
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  /** Apply a `Cart` response — every mutation returns the full, current cart. */
  function applyCart(cart) {
    setCartId(cart?.cartId ?? null);
    setItems((cart?.items ?? []).map(apiItemToCartItem));
    // Every cart endpoint returns the money alongside the lines. Dropping it
    // here is what left each consumer re-deriving the total for itself.
    setCartView(cart ?? null);
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
    setLoading(false);
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
        setCartView(null);
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
      // Storage, not React state: `items` can already reflect the SERVER's
      // cart by the time this runs (a concurrent `applyCart` call can win the
      // race), and that is not an unmerged guest cart — re-adding it here
      // silently doubled every line's quantity on a plain page reload/nav.
      // `writeGuestCart` never writes while signed in, so storage is the one
      // reliable signal that these lines genuinely predate this sign-in.
      const stored = readGuestCart();
      const shouldMerge = stored.length > 0 && !mergingRef.current;

      if (shouldMerge) {
        mergingRef.current = true;
        // Clear before the requests, not after. A merge that fails halfway
        // must not leave lines that a later sign-in would add a second time —
        // losing a line is recoverable, silently doubling an order is not.
        writeGuestCart([]);
        for (const line of stored) {
          if (cancelled) return;
          try {
            await api.cart.addItem({
              productId: line.productId ?? line.id,
              quantity: line.quantity ?? 1,
              // Carry the line's configuration across. Without it, a guest who
              // configured two different lens options on the same frame has
              // both lines merged into one on sign-in — the API keys a line on
              // (product, lens_option), so dropping it here collapses them.
              lensOption: line.lensOption,
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
      } finally {
        if (!cancelled) setLoading(false);
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
          lensOption: product.lensOption,
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
        const existing = prev.find(
          (i) => (i.productId ?? i.id) === product.id && (i.variant ?? '') === variantKey,
        );
        if (existing) {
          return prev.map((i) =>
            (i.productId ?? i.id) === product.id && (i.variant ?? '') === variantKey
              ? { ...i, quantity: Math.min(100, i.quantity + (product.quantity ?? 1)) }
              : i,
          );
        }
        return [
          ...prev,
          {
            ...product,
            // The line id has to include the variant. Matching on
            // (product, variant) above keeps two lens configurations of the
            // same frame as separate lines — but storing both under the raw
            // product id gave them the SAME id, so `updateQuantity`/
            // `removeItem`, which look a line up by id, would always act on
            // whichever came first.
            id: `${product.id}:${encodeURIComponent(variantKey || 'default')}`,
            // Keep the real product id for the sign-in merge, which posts
            // `productId` to the API.
            productId: product.id,
            lensOption: product.lensOption,
            // Same ceiling the API enforces, so a guest cannot build a line
            // locally that the server will refuse to take at sign-in.
            quantity: Math.min(100, product.quantity ?? 1),
          },
        ];
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

  /**
   * Apply a promo code to the signed-in customer's cart.
   *
   * Goes through the API so the code lands on the SERVER cart, which is what
   * makes it survive to checkout: `place_order` takes the code and recomputes
   * the discount itself, and the cart view the API returns carries the
   * resulting `discountKes`/`vatKes`/`totalKes`.
   *
   * The cart page used to validate the code in the browser instead — reading
   * `promo_codes` straight from Supabase and subtracting the discount from a
   * locally computed total. The server never heard about it, so the order was
   * placed at full price while the cart showed a saving.
   *
   * Throws so the caller can surface the API's own message ("This promo code
   * has expired", "…usage limit"), which is more use than a single catch-all.
   */
  const applyPromo = async (code) => {
    if (!user) throw new Error('Sign in to use a promo code.');
    const cart = await api.cart.applyPromo({ code });
    applyCart(cart);
    setError('');
    return cart;
  };

  /** Remove the applied promo from the signed-in customer's cart. */
  const clearPromo = async () => {
    if (!user) return null;
    const cart = await api.cart.clearPromo();
    applyCart(cart);
    setError('');
    return cart;
  };

  const cartCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeItem,
        applyPromo,
        clearPromo,
        cartCount,
        cartId,
        cartView,
        error,
        loading,
      }}
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
