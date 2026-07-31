'use client';

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabase } from '@optex/db/browser';
import {
  getCartView,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
  getCustomerIdForUser,
} from '@optex/db';
import { getProductImageUrl } from '@/lib/product-image';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

/** Where the guest cart lives between visits. */
const GUEST_CART_KEY = 'optex.cart.guest.v1';

function readGuestCart() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.productId) : [];
  } catch {
    // Corrupt or unavailable storage (private mode, quota) — start empty rather
    // than taking the whole cart provider down with it.
    return [];
  }
}

function writeGuestCart(items) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — the cart still works for this page view */
  }
}

function clearGuestCart() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    /* nothing to do */
  }
}

function dbItemToCartItem(item) {
  return {
    id: item.id, // cart_items.id
    productId: item.product_id,
    title: item.product.name,
    price: String(item.product.price_kes),
    // Via the resolver, not the raw column: seed rows store /seed/<file>.png,
    // which is not a real public path and 404s if rendered directly.
    image: getProductImageUrl(item.product, ''),
    quantity: item.quantity,
    brand: item.product.brand ?? '',
    variant: item.lens_option ? JSON.stringify(item.lens_option) : '',
  };
}

/**
 * Normalise whatever a product card hands us into a guest cart line.
 * Callers pass `id` as the *product* id, so productId is derived from it and
 * the line keeps a stable synthetic id of its own.
 */
function toGuestItem(product) {
  const productId = product.productId ?? product.id;
  const variant = product.variant ?? '';
  return {
    id: `guest:${productId}:${variant}`,
    productId,
    title: product.title ?? '',
    price: String(product.price ?? '0'),
    image: product.image ?? '',
    quantity: Math.max(1, Number(product.quantity) || 1),
    brand: product.brand ?? '',
    variant,
  };
}

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [cartId, setCartId] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // createBrowserSupabase() returns a new client each call; keep one per mount
  // so the auth subscription and every query share a single session.
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createBrowserSupabase();
  const supabase = supabaseRef.current;

  const loadDbCart = useCallback(
    async (custId) => {
      const view = await getCartView(supabase, custId);
      if (view) {
        setCartId(view.cartId);
        setItems(view.items.map(dbItemToCartItem));
      } else {
        setCartId(null);
        setItems([]);
      }
    },
    [supabase],
  );

  /**
   * Fold whatever the visitor collected while logged out into their server
   * cart, then drop the local copy. addCartItem merges by (product, lens), so
   * re-adding a line the account already had increments it rather than
   * duplicating it.
   */
  const mergeGuestCart = useCallback(
    async (custId) => {
      const guestItems = readGuestCart();
      if (guestItems.length === 0) return;

      for (const item of guestItems) {
        try {
          await addCartItem(supabase, {
            customerId: custId,
            productId: item.productId,
            quantity: item.quantity,
          });
        } catch (err) {
          // One bad line (deleted product, say) must not strand the rest.
          console.error('Cart merge skipped an item:', item.productId, err);
        }
      }
      clearGuestCart();
    },
    [supabase],
  );

  /** Resolve the session to a customers.id and load that customer's cart. */
  const adoptSession = useCallback(
    async (session) => {
      const authUserId = session?.user?.id ?? null;

      if (!authUserId) {
        setCustomerId(null);
        setCartId(null);
        setItems(readGuestCart());
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // carts.customer_id references customers(id), NOT auth.users(id).
        const custId = await getCustomerIdForUser(supabase, authUserId);
        if (!custId) {
          throw new Error('No customer record is linked to this account.');
        }
        setCustomerId(custId);
        await mergeGuestCart(custId);
        await loadDbCart(custId);
        setError(null);
      } catch (err) {
        console.error('Cart session error:', err);
        setError('We could not load your cart. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    },
    [supabase, mergeGuestCart, loadDbCart],
  );

  useEffect(() => {
    let active = true;

    // Paint the guest cart immediately so a returning visitor sees their items
    // without waiting on the auth round-trip.
    setItems(readGuestCart());

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) adoptSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        setCustomerId(null);
        setCartId(null);
        setItems(readGuestCart());
        setError(null);
        return;
      }
      // TOKEN_REFRESHED fires often and carries the same user; re-resolving is
      // wasted work once we already hold a customer id.
      if (event === 'TOKEN_REFRESHED' && customerId) return;
      adoptSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const persistGuest = (updater) =>
    setItems((prev) => {
      const next = updater(prev);
      writeGuestCart(next);
      return next;
    });

  const addToCart = async (product) => {
    setError(null);

    if (!customerId) {
      const line = toGuestItem(product);
      persistGuest((prev) => {
        const existing = prev.find((i) => i.id === line.id);
        return existing
          ? prev.map((i) => (i.id === line.id ? { ...i, quantity: i.quantity + line.quantity } : i))
          : [...prev, line];
      });
      return;
    }

    try {
      await addCartItem(supabase, {
        customerId,
        productId: product.productId ?? product.id,
        quantity: Math.max(1, Number(product.quantity) || 1),
      });
      await loadDbCart(customerId);
    } catch (err) {
      console.error('addCartItem error:', err);
      setError('We could not add that item to your cart. Please try again.');
    }
  };

  const updateQuantity = async (id, delta) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newQty = Math.max(1, item.quantity + delta);
    setError(null);

    if (!customerId) {
      persistGuest((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: newQty } : i)));
      return;
    }

    try {
      await updateCartItemQuantity(supabase, id, newQty);
      await loadDbCart(customerId);
    } catch (err) {
      console.error('updateCartItemQuantity error:', err);
      setError('We could not update that quantity. Please try again.');
    }
  };

  const removeItem = async (id) => {
    setError(null);

    if (!customerId) {
      persistGuest((prev) => prev.filter((i) => i.id !== id));
      return;
    }

    try {
      await removeCartItem(supabase, id);
      await loadDbCart(customerId);
    } catch (err) {
      console.error('removeCartItem error:', err);
      setError('We could not remove that item. Please try again.');
    }
  };

  const cartCount = items.reduce((count, item) => count + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * item.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeItem,
        cartCount,
        subtotal,
        cartId,
        customerId,
        isGuest: !customerId,
        loading,
        error,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
