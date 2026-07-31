'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createBrowserSupabase } from '@optex/db/browser';
import {
  listWishlist,
  listWishlistProductIds,
  toggleWishlist,
  removeFromWishlist,
  getCustomerIdForUser,
} from '@optex/db';

const WishlistContext = createContext();

export const useWishlist = () => useContext(WishlistContext);

/**
 * Wishlist state (migration 0009).
 *
 * Unlike the cart there is no guest mode: a wishlist is meaningless without an
 * account to attach it to, and `wishlists.customer_id` is NOT NULL. Logged-out
 * visitors get `requiresLogin` back from `toggle()` so the caller can send them
 * to /login instead of silently doing nothing.
 */
export const WishlistProvider = ({ children }) => {
  const [productIds, setProductIds] = useState(new Set());
  const [entries, setEntries] = useState([]);
  const [customerId, setCustomerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createBrowserSupabase();
  const supabase = supabaseRef.current;

  const refreshIds = useCallback(
    async (custId) => {
      const ids = await listWishlistProductIds(supabase, custId);
      setProductIds(new Set(ids));
    },
    [supabase],
  );

  /** Full rows with product data — only the /wishlist page needs these. */
  const refreshEntries = useCallback(async () => {
    if (!customerId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      setEntries(await listWishlist(supabase, customerId));
      setError(null);
    } catch (err) {
      console.error('Wishlist load error:', err);
      setError('We could not load your wishlist. Please refresh to try again.');
    } finally {
      setLoading(false);
    }
  }, [supabase, customerId]);

  useEffect(() => {
    let active = true;

    const adopt = async (session) => {
      const authUserId = session?.user?.id ?? null;
      if (!authUserId) {
        if (!active) return;
        setCustomerId(null);
        setProductIds(new Set());
        setEntries([]);
        setLoading(false);
        return;
      }
      try {
        // wishlists.customer_id references customers(id), not auth.users(id).
        const custId = await getCustomerIdForUser(supabase, authUserId);
        if (!active) return;
        setCustomerId(custId);
        if (custId) await refreshIds(custId);
      } catch (err) {
        console.error('Wishlist session error:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => adopt(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => adopt(session));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, refreshIds]);

  const isWishlisted = useCallback((productId) => productIds.has(productId), [productIds]);

  /**
   * Toggle a product. Returns { requiresLogin } when there is no session, so
   * the button can redirect rather than failing quietly.
   */
  const toggle = useCallback(
    async (productId) => {
      if (!customerId) return { requiresLogin: true, wishlisted: false };

      // Optimistic: the heart should fill on click, not after a round-trip.
      const wasIn = productIds.has(productId);
      setProductIds((prev) => {
        const next = new Set(prev);
        if (wasIn) next.delete(productId);
        else next.add(productId);
        return next;
      });

      try {
        const nowIn = await toggleWishlist(supabase, customerId, productId);
        setProductIds((prev) => {
          const next = new Set(prev);
          if (nowIn) next.add(productId);
          else next.delete(productId);
          return next;
        });
        if (!nowIn) setEntries((prev) => prev.filter((e) => e.product_id !== productId));
        return { requiresLogin: false, wishlisted: nowIn };
      } catch (err) {
        console.error('Wishlist toggle error:', err);
        // Roll the optimistic update back so the icon matches the server.
        setProductIds((prev) => {
          const next = new Set(prev);
          if (wasIn) next.add(productId);
          else next.delete(productId);
          return next;
        });
        setError('We could not update your wishlist. Please try again.');
        return { requiresLogin: false, wishlisted: wasIn, failed: true };
      }
    },
    [supabase, customerId, productIds],
  );

  const remove = useCallback(
    async (productId) => {
      if (!customerId) return;
      const snapshot = entries;
      setEntries((prev) => prev.filter((e) => e.product_id !== productId));
      setProductIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      try {
        await removeFromWishlist(supabase, customerId, productId);
      } catch (err) {
        console.error('Wishlist remove error:', err);
        setEntries(snapshot);
        setError('We could not remove that item. Please try again.');
      }
    },
    [supabase, customerId, entries],
  );

  return (
    <WishlistContext.Provider
      value={{
        entries,
        count: productIds.size,
        isWishlisted,
        toggle,
        remove,
        refreshEntries,
        loading,
        error,
        signedIn: Boolean(customerId),
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};
