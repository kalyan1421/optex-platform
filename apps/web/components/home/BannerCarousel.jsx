'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

const AUTO_PLAY_INTERVAL = 5000; // ms

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

/**
 * Client-side banner carousel. Receives pre-fetched active banners from the
 * server component wrapper in Hero.jsx.
 *
 * @param {{ banners: import('@optex/api-client').PromoBanner[] }} props
 */
export default function BannerCarousel({ banners }) {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef(null);

  const total = banners.length;

  const goTo = useCallback(
    (index) => {
      setCurrent(((index % total) + total) % total);
    },
    [total],
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  // Auto-play — pauses when the user hovers over the carousel.
  useEffect(() => {
    if (total <= 1 || isHovered || reducedMotion) return;
    timerRef.current = setInterval(next, AUTO_PLAY_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [total, isHovered, next, reducedMotion]);

  if (total === 0) return null;

  return (
    <section
      className="relative h-[640px] w-full overflow-hidden bg-[#1A1A2E] sm:h-[700px] lg:h-[773px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Slides */}
      {banners.map((b, i) => (
        <div
          key={b.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === current ? 'z-10 opacity-100' : 'z-0 opacity-0'
          }`}
          aria-hidden={i !== current}
        >
          {/* Banner image */}
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center sm:bg-[position:65%_center] lg:bg-right-top"
            style={{ backgroundImage: `url(${b.image_url})` }}
          >
            {/* Dark overlay for mobile text legibility */}
            <div className="absolute inset-0 bg-black/30 lg:hidden" />
          </div>

          {/* Bottom gradient fade on desktop */}
          <div
            className="pointer-events-none absolute left-0 z-10 hidden h-[276px] w-full lg:block"
            style={{
              top: '497px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #FFFFFF 100%)',
            }}
          />

          {/* Mobile content */}
          <div className="relative z-20 mx-auto flex h-full w-full max-w-[580px] flex-col items-center justify-center gap-8 px-4 pb-24 pt-32 text-center lg:hidden">
            {b.headline && (
              <h1
                className="w-full text-[36px] font-bold uppercase leading-tight text-white drop-shadow-lg"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                {b.headline.split('\\n').map((line, idx) => (
                  <span key={idx} className="block">
                    {line}
                  </span>
                ))}
              </h1>
            )}
            {b.target_url && (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href={b.target_url}
                  className="flex items-center justify-center rounded-[36px] bg-[#2E3192] px-[20px] py-[10px] font-bold capitalize text-white transition-colors hover:bg-blue-800"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Shop Now
                </Link>
              </div>
            )}
          </div>

          {/* Desktop content */}
          <div className="pointer-events-none absolute inset-0 mx-auto hidden max-w-[1440px] lg:block">
            <div className="pointer-events-auto absolute left-[100px] top-[207px] z-20 flex w-[523px] flex-col items-start gap-[32px] text-left">
              {b.headline && (
                <div className="flex w-[523px] flex-col gap-[20px]">
                  <h1
                    className="w-full text-left text-[76.67px] font-bold uppercase leading-[0.97] tracking-[-0.01em]"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {b.headline.split('\\n').map((line, idx) => (
                      <span
                        key={idx}
                        className={`block ${idx % 2 === 0 ? 'text-[#E53935]' : 'text-[#1A1A2E]'}`}
                      >
                        {line}
                      </span>
                    ))}
                  </h1>
                </div>
              )}
              {b.target_url && (
                <div className="flex h-[43px] items-center gap-[12px]">
                  <Link
                    href={b.target_url}
                    className="flex h-[43px] min-w-[135px] items-center justify-center rounded-[36px] bg-[#2E3192] px-[20px] py-[10px] transition-colors hover:bg-blue-800"
                  >
                    <span
                      className="whitespace-nowrap text-[18.97px] font-bold capitalize leading-[1.2] tracking-[-0.01em] text-[#FFFFFF]"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      Shop Now
                    </span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Navigation arrows — only shown when there are multiple banners */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous banner"
            className="absolute left-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md transition-all hover:bg-white hover:shadow-lg lg:left-8"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={next}
            aria-label="Next banner"
            className="absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md transition-all hover:bg-white hover:shadow-lg lg:right-8"
          >
            <ChevronRight />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 gap-2">
          {banners.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to banner ${i + 1}`}
              aria-current={i === current ? 'true' : undefined}
              className={`rounded-full transition-all duration-300 ${
                i === current ? 'h-3 w-7 bg-[#2E3192]' : 'h-3 w-3 bg-white/70 hover:bg-white'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
