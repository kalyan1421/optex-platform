'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCompare } from '@/context/CompareContext';
import { useCart } from '@/context/CartContext';
import { formatKesNumber } from '@optex/ui';

/** Row definitions for the comparison table, in display order. */
const SPEC_ROWS = [
  { label: 'Brand', key: 'brand' },
  { label: 'Price', key: 'priceKes', isPrice: true },
  { label: 'Frame Material', key: 'frameMaterial' },
  { label: 'Frame Shape', key: 'frameShape' },
  { label: 'Gender', key: 'gender' },
];

function cellValue(item, row) {
  const raw = item[row.key];
  if (row.isPrice) return `KSH. ${formatKesNumber(raw)}`;
  return raw || '—';
}

export default function ComparePage() {
  const { items, remove, clear } = useCompare();
  const { addToCart } = useCart();

  return (
    <div className="mx-auto w-full max-w-[1240px] px-6 py-10 lg:py-[60px]">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-poppins text-[28px] font-bold text-[#0A0A0A] lg:text-[36px]">
            Compare Frames
          </h1>
          <p className="font-inter mt-2 text-[#717182]">
            {items.length === 0
              ? 'Add frames to compare from the shop or a product page.'
              : `Comparing ${items.length} ${items.length === 1 ? 'frame' : 'frames'} side by side.`}
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="font-inter shrink-0 text-sm text-[#717182] hover:text-[#0A0A0A]"
          >
            Clear all
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[32px] border-[0.8px] border-[#D4D4D4] px-6 py-[80px] text-center">
          <h2 className="font-poppins mb-[8px] text-[22px] font-semibold text-[#0A0A0A]">
            Nothing to compare yet
          </h2>
          <p className="font-inter mb-[24px] max-w-[420px] text-[16px] text-[#717182]">
            Tap the compare icon on any product card while browsing to add it here.
          </p>
          <Link
            href="/shop"
            className="font-inter flex h-[44px] items-center justify-center rounded-[26843500px] bg-[#2E3192] px-[28px] text-[15px] font-semibold text-white transition-colors hover:bg-[#1e2361]"
          >
            Browse the shop
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <th className="w-[160px]" />
                {items.map((item) => (
                  <th key={item.id} className="px-4 pb-4 text-left align-top">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        aria-label={`Remove ${item.name} from comparison`}
                        className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#717182] shadow hover:text-[#0A0A0A]"
                      >
                        &times;
                      </button>
                      <div className="relative mb-3 h-[160px] w-full overflow-hidden rounded-[20px] bg-[#F5F5F5]">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="220px"
                          className="object-cover"
                        />
                      </div>
                      <Link
                        href={`/product/${item.slug}`}
                        className="font-poppins block text-[16px] font-semibold text-[#0A0A0A] hover:text-[#2E3192]"
                      >
                        {item.name}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SPEC_ROWS.map((row) => (
                <tr key={row.key} className="border-t border-[#E5E7EB]">
                  <td className="font-inter py-4 pr-4 text-sm font-medium text-[#717182]">
                    {row.label}
                  </td>
                  {items.map((item) => (
                    <td key={item.id} className="font-inter px-4 py-4 text-[15px] text-[#0A0A0A]">
                      {cellValue(item, row)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-[#E5E7EB]">
                <td />
                {items.map((item) => (
                  <td key={item.id} className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() =>
                        addToCart({
                          id: item.id,
                          title: item.name,
                          price: String(item.priceKes),
                          image: item.image,
                          quantity: 1,
                        })
                      }
                      className="flex h-[41px] w-full items-center justify-center rounded-[24px] bg-[#E53935] px-4 text-sm font-semibold text-white transition-all hover:bg-[#D32F2F] active:scale-95"
                    >
                      Add to Cart
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
