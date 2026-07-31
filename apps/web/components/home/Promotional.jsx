'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@optex/db/browser';

/**
 * Homepage promotional cards, driven by the `promo_banners` table.
 *
 * These were previously hardcoded (two Unsplash URLs and fixed copy) with
 * buttons that did nothing, so the Promotions admin screen had no effect on the
 * storefront. Copy, imagery, link target, scheduling window and accent colour
 * all now come from the database — migrations 0001 and 0010.
 */

/** Only the two brand overlays the design uses; `accent` is CHECK-constrained. */
const ACCENTS = {
  dark: {
    overlay: 'bg-gradient-to-t from-black/80 via-black/30 to-transparent',
    badge: 'bg-[#E53935] text-white',
    cta: 'bg-white text-black hover:bg-gray-100',
  },
  blue: {
    overlay: 'bg-gradient-to-t from-[#2A3182]/90 via-[#2A3182]/50 to-transparent',
    badge: 'bg-white text-[#2A3182]',
    cta: 'bg-[#E53935] text-white hover:bg-red-600',
  },
};

function CardSkeleton() {
  return (
    <div
      className="h-[340px] animate-pulse rounded-[30px] bg-gray-100 shadow-lg md:h-[380px]"
      aria-hidden="true"
    />
  );
}

const Promotional = () => {
  const [banners, setBanners] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    let active = true;
    const db = createBrowserSupabase();
    const now = new Date().toISOString();

    db.from('promo_banners')
      .select('id, image_url, target_url, badge, headline, body, cta_label, accent')
      .eq('is_active', true)
      // Respect the scheduling window: a banner outside its dates is not live.
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('sort_order', { ascending: true })
      .limit(2)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Promotional banners error:', error);
          setState('error');
          return;
        }
        setBanners(data ?? []);
        setState('ready');
      });

    return () => {
      active = false;
    };
  }, []);

  // Nothing scheduled, or the fetch failed — drop the section rather than
  // showing an empty band or an error the visitor can do nothing about.
  if (state === 'error' || (state === 'ready' && banners.length === 0)) return null;

  return (
    <section className="overflow-hidden bg-white py-16">
      <div className="site-container">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {state === 'loading' ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : (
            banners.map((banner, index) => {
              const accent = ACCENTS[banner.accent] ?? ACCENTS.dark;
              const href = banner.target_url || '/shop';

              return (
                <Link
                  key={banner.id}
                  href={href}
                  data-aos={index === 0 ? 'fade-right' : 'fade-left'}
                  className="group relative block h-[340px] overflow-hidden rounded-[30px] shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2A3182]/40 md:h-[380px]"
                >
                  <img
                    src={banner.image_url}
                    alt={banner.headline ?? 'Promotion'}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                  <div className={`absolute inset-0 ${accent.overlay}`} />

                  <div className="absolute inset-0 flex flex-col items-start justify-end p-8 md:p-10">
                    {banner.badge && (
                      <span
                        className={`mb-4 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider ${accent.badge}`}
                      >
                        {banner.badge}
                      </span>
                    )}
                    {banner.headline && (
                      <h2 className="mb-4 max-w-sm text-[24px] font-bold leading-tight tracking-tight text-white md:text-[32px]">
                        {banner.headline}
                      </h2>
                    )}
                    {banner.body && (
                      <p className="mb-6 max-w-sm text-[14px] font-medium leading-relaxed text-white/80 md:text-[15px]">
                        {banner.body}
                      </p>
                    )}
                    {banner.cta_label && (
                      <span
                        className={`transform rounded-full px-7 py-3 text-[13px] font-bold shadow-sm transition-all duration-300 group-active:scale-95 ${accent.cta}`}
                      >
                        {banner.cta_label}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default Promotional;
