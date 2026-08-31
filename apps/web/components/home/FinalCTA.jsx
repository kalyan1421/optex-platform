import React from 'react';
import Link from 'next/link';

const FinalCTA = () => {
  return (
    <section className="relative flex w-full flex-col items-center overflow-hidden bg-[#2E3192] px-6 lg:px-[100px] lg:pb-[120px] lg:pt-[120px]">
      {/* Decorative gradient overlay (Right edge) */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-full opacity-10"
        style={{
          width: '537.19px',
          background: 'linear-gradient(270deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%)',
        }}
      ></div>

      <div className="relative z-10 flex w-full flex-col items-center lg:w-[1143px]">
        {/* Heading */}
        <h2
          className="text-center text-[#FFFFFF] lg:h-[160px] lg:w-[753px]"
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

        {/* Paragraph */}
        <p
          className="text-center lg:h-[66px] lg:w-[700px]"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: 'clamp(16px, 3.5vw, 22px)',
            lineHeight: 1.5,
            letterSpacing: '0px',
            color: 'rgba(255, 255, 255, 0.8)',
            marginTop: '24px',
            marginBottom: '0',
          }}
          data-aos="fade-up"
          data-aos-delay="100"
        >
          Join customers who trust Optex Opticians for clearer vision and confident style.
        </p>

        {/* Buttons Container */}
        <div
          className="flex flex-col items-center justify-center sm:flex-row lg:h-[67px] lg:w-[1143px]"
          style={{ gap: '24px', marginTop: '50px' }}
          data-aos="fade-up"
          data-aos-delay="200"
        >
          {/* Primary Button */}
          <Link
            href="/shop"
            className="flex items-center justify-center bg-[#FFFFFF] transition-transform duration-300 hover:scale-105 active:scale-95"
            style={{
              width: '240.7px',
              height: '67px',
              borderRadius: '48px',
              boxShadow: '0px 8px 10px -6px rgba(0,0,0,0.1), 0px 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <span
              className="text-[#2E3192]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '18px',
                lineHeight: '27px',
                margin: 0,
              }}
            >
              Shop Collection
            </span>
          </Link>

          {/* Secondary Button */}
          <Link
            href="/appointments"
            className="flex items-center justify-center bg-transparent transition-all duration-300 hover:bg-white/10 active:scale-95"
            style={{
              width: '273.25px',
              height: '67px',
              borderRadius: '48px',
              border: '2px solid #FFFFFF',
            }}
          >
            <span
              className="text-[#FFFFFF]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '18px',
                lineHeight: '27px',
                margin: 0,
              }}
            >
              Book Appointment
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
