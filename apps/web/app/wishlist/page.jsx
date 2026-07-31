'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

export default function WishlistPage() {
  const router = useRouter();
  const { entries, refreshEntries, remove, loading, error, signedIn } = useWishlist();
  const { addToCart } = useCart();

  useEffect(() => {
    if (signedIn) refreshEntries();
  }, [signedIn, refreshEntries]);

  async function moveToCart(entry) {
    await addToCart({
      id: entry.product.id,
      title: entry.product.name,
      price: String(entry.product.price_kes),
      image: getProductImageUrl(entry.product),
      brand: entry.product.brand ?? '',
      quantity: 1,
    });
    await remove(entry.product_id);
    router.push('/cart');
  }

  return (
    <main className="min-h-[60vh] bg-[#F7F8FC] py-12">
      <div className="site-container">
        <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-gray-500">
          <Link href="/" className="hover:text-[#2A3182]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-gray-900">Wishlist</span>
        </nav>

        <h1 className="mb-2 text-[28px] font-black tracking-tight text-[#2A3182] sm:text-[34px]">
          My Wishlist
        </h1>
        <p className="mb-8 text-[14px] font-medium text-gray-500">
          {signedIn ? `${entries.length} saved item${entries.length === 1 ? '' : 's'}` : 'Sign in to see your saved frames.'}
        </p>

        {/* Signed out */}
        {!loading && !signedIn && (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-sm">
            <p className="mb-6 text-[15px] font-medium text-gray-600">
              Your wishlist is tied to your account so it follows you between devices.
            </p>
            <Link
              href="/login?next=%2Fwishlist"
              className="inline-block rounded-full bg-[#2A3182] px-8 py-3 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        )}

        {/* Loading */}
        {loading && signedIn && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-[28px] bg-white p-4 shadow-sm">
                <div className="mb-4 h-48 rounded-[20px] bg-gray-100" />
                <div className="mb-2 h-4 w-3/4 rounded bg-gray-100" />
                <div className="h-4 w-1/2 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-[20px] border border-red-100 bg-red-50 p-5 text-[14px] font-medium text-red-700"
          >
            {error}{' '}
            <button onClick={refreshEntries} className="font-bold underline">
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && signedIn && entries.length === 0 && !error && (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-sm">
            <p className="mb-6 text-[15px] font-medium text-gray-600">
              You have not saved anything yet.
            </p>
            <Link
              href="/shop"
              className="inline-block rounded-full bg-[#2A3182] px-8 py-3 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            >
              Browse the collection
            </Link>
          </div>
        )}

        {/* Items */}
        {!loading && entries.length > 0 && (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex h-full flex-col overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-xl"
              >
                <Link
                  href={`/product/${entry.product.slug}`}
                  className="block bg-[#F4F5FA] p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182]"
                >
                  <img
                    src={getProductImageUrl(entry.product)}
                    alt={entry.product.name}
                    loading="lazy"
                    className="mx-auto h-40 w-full object-contain"
                  />
                </Link>

                <div className="flex flex-1 flex-col p-5">
                  {entry.product.brand && (
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">
                      {entry.product.brand}
                    </span>
                  )}
                  <Link
                    href={`/product/${entry.product.slug}`}
                    className="mb-2 text-[15px] font-bold text-gray-900 hover:text-[#2A3182]"
                  >
                    {entry.product.name}
                  </Link>
                  <p className="mb-5 text-[16px] font-black text-[#2A3182]">
                    {formatKes(entry.product.price_kes)}
                  </p>

                  <div className="mt-auto flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => moveToCart(entry)}
                      className="rounded-full bg-[#2A3182] px-4 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182] focus-visible:ring-offset-2"
                    >
                      Move to Cart
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(entry.product_id)}
                      className="rounded-full border border-gray-200 px-4 py-2.5 text-[13px] font-bold text-gray-600 transition-colors hover:border-red-200 hover:text-[#E53935] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A3182] focus-visible:ring-offset-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
