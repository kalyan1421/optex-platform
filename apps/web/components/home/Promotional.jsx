import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

/**
 * Two promo cards. Both CTAs were `<button>` elements with no handler and no
 * href — they rendered as buttons and did nothing when clicked. They are
 * `<Link>`s to /shop now, which is where every other storefront CTA points.
 *
 * The scrim behind the copy is split mobile/desktop on purpose: on desktop the
 * text sits in a 350px column on the left, so a horizontal gradient can fade
 * out and leave the photo visible; on mobile the text spans the full card, so
 * it needs a vertical scrim instead. Both are tuned to keep the body copy at
 * >=4.5:1 against the lightest pixels either photo can present.
 */

const CARDS = [
  {
    aos: 'fade-right',
    href: '/shop',
    bg: '#1A1A1A',
    image:
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=1000&auto=format&fit=crop',
    alt: 'Polarized black sunglasses from the winter shades range',
    scrimMobile:
      'linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.72) 55%, rgba(0,0,0,0.65) 100%)',
    scrimDesktop:
      'linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.88) 72%, rgba(0,0,0,0.40) 88%, rgba(0,0,0,0) 100%)',
    badge: 'Limited Offer',
    badgeClass: 'bg-[#E53935] text-[#FFFFFF]',
    title: (
      <>
        Buy 1 Get 1 Free <br /> on Winter Shades
      </>
    ),
    body: 'Protect your eyes in style with our latest polarized sunglasses. Offer ends this Sunday.',
    cta: 'Shop Now',
    ctaClass: 'bg-[#FFFFFF] text-[#000000]',
  },
  {
    aos: 'fade-left',
    href: '/shop',
    bg: '#2E3192',
    image:
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1000&auto=format&fit=crop',
    alt: 'Rose gold round designer frames from the new collection',
    scrimMobile:
      'linear-gradient(180deg, rgba(46,49,146,0.94) 0%, rgba(46,49,146,0.86) 55%, rgba(46,49,146,0.80) 100%)',
    scrimDesktop:
      'linear-gradient(90deg, rgba(46,49,146,0.97) 0%, rgba(46,49,146,0.95) 72%, rgba(46,49,146,0.50) 88%, rgba(46,49,146,0) 100%)',
    badge: 'New Collection',
    badgeClass: 'bg-[#FFFFFF] text-[#2E3192]',
    title: (
      <>
        Up to 30% Off <br /> Designer Frames
      </>
    ),
    body: 'Elevate your look with premium frames from our curated collection, selected for comfort, fit, and everyday style.',
    cta: 'Explore Sale',
    ctaClass: 'bg-[#E53935] text-[#FFFFFF]',
  },
];

const Promotional = () => {
  return (
    <section className="flex w-full flex-col items-center overflow-hidden bg-[#FFFFFF] px-6 py-12 lg:px-[100px] lg:py-[80px]">
      <div className="flex w-full max-w-[1240px] flex-col gap-6 lg:flex-row lg:gap-[32px]">
        {CARDS.map((card) => (
          <div
            key={card.cta}
            data-aos={card.aos}
            className="group relative flex h-[450px] w-full flex-col overflow-hidden rounded-[40px] lg:h-[500px] lg:flex-1"
            style={{ backgroundColor: card.bg }}
          >
            <Image
              src={card.image}
              alt={card.alt}
              fill
              sizes="(min-width: 1024px) 604px, 100vw"
              className="object-cover transition-transform duration-1000 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />

            {/* Scrim — vertical on mobile (copy is full-bleed), horizontal on desktop. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 z-10 lg:hidden"
              style={{ background: card.scrimMobile }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 z-10 hidden lg:block"
              style={{ background: card.scrimDesktop }}
            />

            <div className="relative z-20 flex h-full w-full flex-col items-start px-8 pt-10 lg:pl-[60px] lg:pr-[40px] lg:pt-[68px]">
              <span
                className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 uppercase ${card.badgeClass}`}
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 700,
                  fontSize: '12px',
                  lineHeight: '18px',
                  letterSpacing: '1.2px',
                }}
              >
                {card.badge}
              </span>

              <h2
                className="mt-6 text-[#FFFFFF] lg:mt-[24px] lg:max-w-[444px]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 700,
                  fontSize: 'clamp(24px, 6vw, 48px)',
                  lineHeight: 1.25,
                }}
              >
                {card.title}
              </h2>

              <p
                className="mt-4 lg:mt-[16px] lg:max-w-[350px]"
                style={{
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: 'clamp(14px, 3.5vw, 18px)',
                  lineHeight: 1.5,
                }}
              >
                {card.body}
              </p>

              <Link
                href={card.href}
                className={`mt-8 inline-flex min-h-[60px] items-center justify-center rounded-[48px] px-8 shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 lg:mt-[32px] ${card.ctaClass}`}
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 700,
                  fontSize: '16px',
                  lineHeight: '24px',
                }}
              >
                {card.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Promotional;
