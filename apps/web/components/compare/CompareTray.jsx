'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCompare } from '@/context/CompareContext';

/**
 * Floating bar showing what's queued for comparison. Rendered globally
 * (mounted once in the root layout) rather than per-page, so it survives
 * navigation between the shop, PDP and home.
 */
export default function CompareTray() {
  const { items, remove, clear, compareCount } = useCompare();
  const pathname = usePathname();

  // Redundant with the table itself once you're already on /compare.
  if (compareCount === 0 || pathname === '/compare') return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5E7EB] bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => remove(item.id)}
                title={`Remove ${item.name} from comparison`}
                className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-[#F5F5F5] transition-opacity hover:opacity-70"
              >
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
          <span className="font-inter text-sm text-[#0A0A0A]">
            {compareCount} {compareCount === 1 ? 'frame' : 'frames'} selected to compare
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={clear}
            className="font-inter text-sm text-[#717182] hover:text-[#0A0A0A]"
          >
            Clear
          </button>
          <Link
            href="/compare"
            className="flex h-10 items-center justify-center rounded-full bg-[#2A3182] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1e2361]"
          >
            Compare
          </Link>
        </div>
      </div>
    </div>
  );
}
