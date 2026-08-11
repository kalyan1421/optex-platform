'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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

  // Load the server cart on sign-in; clear it on sign-out. Auth state comes
  // from AuthContext rather than a second Supabase session listener.
  useEffect(() => {
    if (!user) {
      setItems([]);
      setCartId(null);
      return;
    }

    let cancelled = false;
    api.cart
      .get()
      .then((cart) => {
        if (!cancelled) applyCart(cart);
      })
      .catch((err) => {
        if (!cancelled) console.error('Cart load error:', err);
      });

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
