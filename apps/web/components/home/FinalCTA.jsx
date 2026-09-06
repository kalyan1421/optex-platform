import React from 'react';
import Link from 'next/link';

/**
 * Closing CTA band.
 *
 * Previously the vertical padding was `lg:pt-[120px] lg:pb-[120px]` with no
 * base value, so below 1024px the section had zero padding and the heading sat
 * flush against the section edge. The heading also carried `lg:h-[160px]`,
 * which clipped its own descenders at 164px of content.
 */
const FinalCTA = () => {
  return (
    <section className="relative flex w-full flex-col items-center overflow-hidden bg-[#2E3192] px-6 py-16 lg:px-[100px] lg:py-[120px]">
      {/* Decorative gradient overlay (right edge) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-full w-1/2 max-w-[537px] opacity-10"
        style={{
          background: 'linear-gradient(270deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%)',
        }}
      />

      <div className="relative z-10 flex w-full max-w-[1143px] flex-col items-center">
        <h2
          className="max-w-[753px] text-center text-[#FFFFFF]"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(32px, 7vw, 64px)',
            lineHeight: 1.25,
            letterSpacing: '0px',
            margin: 0,
          }}
          data-aos="fade-up"
        >
          Ready to see the world with perfect clarity?
        </h2>

        <p
          className="max-w-[700px] text-center"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: 'clamp(16px, 3.5vw, 22px)',
            lineHeight: 1.5,
            letterSpacing: '0px',
            color: 'rgba(255, 255, 255, 0.85)',
            marginTop: '24px',
            marginBottom: '0',
          }}
          data-aos="fade-up"
          data-aos-delay="100"
        >
          Join customers who trust Optex Opticians for clearer vision and confident style.
        </p>

        <div
          className="mt-10 flex w-full flex-col items-stretch justify-center gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-6 lg:mt-[50px]"
          data-aos="fade-up"
          data-aos-delay="200"
        >
          <Link
            href="/shop"
            className="inline-flex min-h-[67px] items-center justify-center rounded-[48px] bg-[#FFFFFF] px-10 text-[#2E3192] shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.1),0px_20px_25px_-5px_rgba(0,0,0,0.1)] transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2E3192] active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '18px',
              lineHeight: '27px',
            }}
          >
            Shop Collection
          </Link>

          <Link
            href="/appointments"
            className="inline-flex min-h-[67px] items-center justify-center rounded-[48px] border-2 border-[#FFFFFF] bg-transparent px-10 text-[#FFFFFF] transition-all duration-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2E3192] active:scale-95 motion-reduce:transition-none"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '18px',
              lineHeight: '27px',
            }}
          >
            Book Appointment
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
