'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const WishlistContext = createContext();

export const useWishlist = () => useContext(WishlistContext);

/**
 * Wishlist state (SPEC-10 R3), mirroring `CartContext`'s architecture but
 * deliberately simpler: unlike the cart, there is no guest mode. A wishlist
 * is meaningless without an account to attach it to (SPEC-10's own
 * Non-Goals explicitly scope out guest+merge), so a signed-out visitor's
 * `toggle()` reports `requiresLogin` instead of writing anywhere — the
 * caller (`WishlistToggle`) does the redirect.
 *
 * Only the saved-product-id *set* lives here, for the fast `isSaved()`
 * lookup every product card needs. The `/wishlist` page's own product data
 * (image, name, price) is fetched separately by that page alone — nothing
 * else needs it, so it doesn't belong in a context every page mounts.
 */
export const WishlistProvider = ({ children }) => {
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.wishlist
      .list()
      .then((items) => {
        if (cancelled) return;
        setSavedIds(new Set(items.map((i) => i.productId)));
      })
      .catch((err) => console.error('Wishlist load error:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isSaved = (productId) => savedIds.has(productId);

  /**
   * Toggles a product. Returns `{ requiresLogin, saved }` rather than
   * throwing on the signed-out case, so the button can redirect to login
   * with a return path instead of the click silently doing nothing (R5).
   *
   * Optimistic: the heart fills on click, not after a round-trip — SPEC-10's
   * own perceived-latency goal is <300ms. Rolled back on a failed request so
   * the icon never lies about what the server actually holds.
   */
  async function toggle(productId) {
    if (!user) return { requiresLogin: true, saved: false };

    const wasSaved = savedIds.has(productId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(productId);
      else next.add(productId);
      return next;
    });

    try {
      if (wasSaved) await api.wishlist.remove(productId);
      else await api.wishlist.add(productId);
      return { requiresLogin: false, saved: !wasSaved };
    } catch (err) {
      console.error('Wishlist toggle error:', err);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(productId);
        else next.delete(productId);
        return next;
      });
      return { requiresLogin: false, saved: wasSaved, failed: true };
    }
  }

  return (
    <WishlistContext.Provider value={{ isSaved, toggle, savedCount: savedIds.size, loading }}>
      {children}
    </WishlistContext.Provider>
  );
};
