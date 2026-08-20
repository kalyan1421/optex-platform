import React from 'react';
import Link from 'next/link';
import { publicApi } from '@/lib/api-server';
import BannerCarousel from './BannerCarousel';

/**
 * Server Component — fetches active promo banners at request time (ISR, 60s
 * revalidation) and passes them to the client-side BannerCarousel.
 *
 * Falls back to the original static hero when there are no active banners so
 * the homepage is never empty.
 */
export default async function Hero() {
  let banners = [];

  try {
    const api = publicApi({ revalidate: 60, tags: ['promo-banners'] });
    banners = await api.promotions.listActiveBanners();
  } catch (err) {
    // If the API is unreachable (e.g. during a cold build), fall back silently.
    console.error('[Hero] Failed to fetch banners:', err?.message ?? err);
  }

  // ── Dynamic carousel ──────────────────────────────────────────────────────
  if (banners.length > 0) {
    return <BannerCarousel banners={banners} />;
  }

  // ── Static fallback hero (shown when no banners are configured) ───────────
  return (
    <section className="relative w-full overflow-hidden bg-[#FFFFFF] lg:h-[773px]">
      {/* Background Image Container */}
      <div
        className="pointer-events-none absolute right-0 top-0 z-0 h-full w-full bg-cover bg-center sm:bg-[position:65%_center] lg:left-[300px] lg:top-[11px] lg:h-[762px] lg:w-[1143px] lg:bg-right-top"
        style={{ backgroundImage: 'url(/images/home-banner.png)' }}
      >
        <div className="absolute inset-0 z-0 bg-black/20 lg:hidden" />
      </div>

      {/* Bottom Gradient Mask */}
      <div
        className="pointer-events-none absolute left-0 z-10 hidden h-[276px] w-[1442px] lg:block"
        style={{
          top: '497px',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #FFFFFF 100%)',
        }}
      />

      {/* Mobile content */}
      <div className="relative z-20 mx-auto flex w-full max-w-[580px] flex-col items-center gap-[32px] px-4 pb-16 pt-32 text-center lg:hidden">
        <div className="flex flex-col gap-6">
          <h1
            className="w-full text-[36px] font-bold uppercase text-white drop-shadow-md"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            <span className="block">UWAZI WA</span>
            <span className="block">MAONO,</span>
            <span className="block">UREMBO WA</span>
            <span className="block">MTINDO</span>
          </h1>
          <p
            className="text-center font-normal text-white"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Crafted for bold vision and timeless Kenyan style.
            <br />
            Step into clarity. Step into confidence.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/shop"
            className="flex items-center justify-center rounded-[36px] bg-[#2E3192] px-[20px] py-[10px] transition-colors hover:bg-blue-800"
          >
            <span
              className="font-bold capitalize text-white"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Shop Now
            </span>
          </Link>
          <Link
            href="/category/eyeglasses"
            className="group flex items-center justify-center rounded-[36px] border-[1.25px] border-[#E53935] bg-transparent px-[20px] py-[10px] transition-colors hover:bg-[#E53935]"
          >
            <span
              className="font-bold capitalize text-[#E53935] transition-colors group-hover:text-white"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Explore Collection
            </span>
          </Link>
        </div>
      </div>

      {/* Desktop content */}
      <div className="pointer-events-none absolute inset-0 mx-auto hidden max-w-[1440px] lg:block">
        <div className="pointer-events-auto absolute left-[100px] top-[207px] z-20 flex w-[523px] flex-col items-start gap-[32px] text-left">
          <div className="flex w-[523px] flex-col gap-[20px]">
            <h1
              className="w-full text-left text-[76.67px] font-bold uppercase leading-[0.97] tracking-[-0.01em]"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              <span className="block text-[#E53935]">UWAZI WA</span>
              <span className="block text-[#E53935]">MAONO,</span>
              <span className="block text-[#1A1A2E]">UREMBO WA</span>
              <span className="block text-[#1A1A2E]">MTINDO</span>
            </h1>
            <p
              className="w-[523px] text-left text-[20px] leading-[1.2] tracking-[-0.01em] text-[#1A1A2E]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Crafted for bold vision and timeless Kenyan style.
              <br />
              Step into clarity. Step into confidence.
            </p>
          </div>
          <div className="flex h-[43px] w-[359px] items-center gap-[12px]">
            <Link
              href="/shop"
              className="flex h-[43px] w-[135px] items-center justify-center rounded-[36px] bg-[#2E3192] px-[20px] py-[10px] transition-colors hover:bg-blue-800"
            >
              <span
                className="whitespace-nowrap text-[18.97px] font-bold capitalize leading-[1.2] tracking-[-0.01em] text-[#FFFFFF]"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Shop Now
              </span>
            </Link>
            <Link
              href="/category/eyeglasses"
              className="group flex h-[43px] w-[212px] items-center justify-center rounded-[36px] border-[1.25px] border-[#E53935] bg-transparent px-[20px] py-[10px] transition-colors hover:bg-[#E53935]"
            >
              <span
                className="whitespace-nowrap text-[18.97px] font-bold capitalize leading-[1.2] tracking-[-0.01em] text-[#E53935] transition-colors group-hover:text-white"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Explore Collection
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
