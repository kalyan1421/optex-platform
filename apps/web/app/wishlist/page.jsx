'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { api } from '@/lib/api';
import { formatKesNumber } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

/**
 * Dedicated wishlist page (SPEC-10 R6). A saved product that's since been
 * discontinued renders as unavailable with a remove action — never a
 * broken row or a page-level error (an edge case the API's own
 * `WishlistItemView.product.isActive` flag exists specifically to carry).
 */
/**
 * The API already returns a single resolved `image` string (server-side
 * `images[0]`), but seed-fixture products store a `/seed/...` placeholder
 * path that only `getProductImageUrl`'s SEED_MAP knows how to turn into a
 * real asset — same resolution every other product surface applies.
 */
function resolveImage(product) {
  return getProductImageUrl({ images: product.image ? [product.image] : [] });
}

export default function WishlistPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { addToCart } = useCart();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    api.wishlist
      .list()
      .then((data) => {
        setItems(data);
        setError('');
      })
      .catch((err) => {
        console.error('Wishlist load error:', err);
        setError('We could not load your wishlist. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function handleRemove(productId) {
    setBusyId(productId);
    try {
      await api.wishlist.remove(productId);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch (err) {
      console.error('Wishlist remove error:', err);
      setError('We could not remove that item. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleMoveToCart(item) {
    setBusyId(item.productId);
    try {
      await addToCart({
        id: item.product.id,
        title: item.product.name,
        price: String(item.product.priceKes),
        image: resolveImage(item.product),
        brand: item.product.brand ?? '',
        quantity: 1,
      });
      await api.wishlist.remove(item.productId);
      setItems((prev) => prev.filter((i) => i.productId !== item.productId));
      router.push('/cart');
    } catch (err) {
      console.error('Move to cart error:', err);
      setError('We could not move that item to your cart. Please try again.');
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-6 py-10 lg:py-[60px]">
      <h1 className="font-poppins text-[28px] font-bold text-[#0A0A0A] lg:text-[36px]">
        My Wishlist
      </h1>
      <p className="font-inter mt-2 text-[#717182]">
        {!authLoading && user
          ? `${items.length} saved ${items.length === 1 ? 'item' : 'items'}`
          : 'Sign in to see your saved frames.'}
      </p>

      {!authLoading && !user && (
        <div className="mt-8 flex flex-col items-center justify-center rounded-[32px] border-[0.8px] border-[#D4D4D4] px-6 py-[80px] text-center">
          <p className="font-inter mb-[24px] max-w-[420px] text-[16px] text-[#717182]">
            Your wishlist is tied to your account so it follows you between devices.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent('/wishlist')}`}
            className="font-inter flex h-[44px] items-center justify-center rounded-[26843500px] bg-[#2E3192] px-[28px] text-[15px] font-semibold text-white transition-colors hover:bg-[#1e2361]"
          >
            Sign in
          </Link>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[14px] font-medium text-red-600"
        >
          {error}
        </div>
      )}

      {user && loading && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-[28px] border border-[#E5E7EB] p-4">
              <div className="mb-4 h-40 rounded-[20px] bg-gray-100" />
              <div className="mb-2 h-4 w-3/4 rounded bg-gray-100" />
              <div className="h-4 w-1/2 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      )}

      {user && !loading && items.length === 0 && !error && (
        <div className="mt-8 flex flex-col items-center justify-center rounded-[32px] border-[0.8px] border-[#D4D4D4] px-6 py-[80px] text-center">
          <h2 className="font-poppins mb-[8px] text-[22px] font-semibold text-[#0A0A0A]">
            You have not saved anything yet
          </h2>
          <p className="font-inter mb-[24px] max-w-[420px] text-[16px] text-[#717182]">
            Tap the heart icon on any product while browsing to add it here.
          </p>
          <Link
            href="/shop"
            className="font-inter flex h-[44px] items-center justify-center rounded-[26843500px] bg-[#2E3192] px-[28px] text-[15px] font-semibold text-white transition-colors hover:bg-[#1e2361]"
          >
            Browse the shop
          </Link>
        </div>
      )}

      {user && !loading && items.length > 0 && (
        <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const unavailable = !item.product.isActive;
            const busy = busyId === item.productId;
            return (
              <li
                key={item.productId}
                className="flex h-full flex-col overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white transition-shadow hover:shadow-lg"
              >
                <Link
                  href={`/product/${item.product.slug}`}
                  className="relative block bg-[#F5F5F5] p-6"
                >
                  {unavailable && (
                    <span className="absolute left-3 top-3 z-10 rounded-full bg-[#0A0A0A]/80 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Unavailable
                    </span>
                  )}
                  <div className="relative mx-auto h-40 w-full">
                    <Image
                      src={resolveImage(item.product)}
                      alt={item.product.name}
                      fill
                      sizes="(min-width: 1024px) 22vw, 45vw"
                      className={`object-contain ${unavailable ? 'opacity-50' : ''}`}
                    />
                  </div>
                </Link>

                <div className="flex flex-1 flex-col p-5">
                  {item.product.brand && (
                    <span className="font-inter mb-1 text-[11px] font-bold uppercase tracking-wider text-[#717182]">
                      {item.product.brand}
                    </span>
                  )}
                  <Link
                    href={`/product/${item.product.slug}`}
                    className="font-poppins mb-2 text-[15px] font-bold text-[#0A0A0A] hover:text-[#2A3182]"
                  >
                    {item.product.name}
                  </Link>
                  <p className="font-poppins mb-5 text-[16px] font-black text-[#2A3182]">
                    KSH. {formatKesNumber(item.product.priceKes)}
                  </p>

                  <div className="mt-auto flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleMoveToCart(item)}
                      disabled={unavailable || busy}
                      className="font-inter rounded-full bg-[#2A3182] px-4 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {unavailable ? 'No longer available' : 'Move to Cart'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.productId)}
                      disabled={busy}
                      className="font-inter rounded-full border border-[#E5E7EB] px-4 py-2.5 text-[13px] font-bold text-[#717182] transition-colors hover:border-red-200 hover:text-[#E53935] disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
