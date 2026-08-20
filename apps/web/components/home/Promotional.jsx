import React from 'react';
import Image from 'next/image';

const Promotional = () => {
  return (
    <section className="flex w-full flex-col items-center overflow-hidden bg-[#FFFFFF] px-6 lg:px-[100px]">
      <div className="flex w-full flex-col gap-6 lg:h-[500px] lg:w-[1240px] lg:flex-row lg:justify-between lg:gap-[32px]">
        {/* Card 1: Limited Offer */}
        <div
          data-aos="fade-right"
          className="group relative flex w-full h-[450px] cursor-pointer flex-col overflow-hidden lg:h-[500px] lg:w-[604px]"
          style={{ borderRadius: '40px', backgroundColor: '#1A1A1A' }}
        >
          <Image
            src="https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=1000&auto=format&fit=crop"
            alt="Winter Shades"
            fill
            sizes="(min-width: 1024px) 604px, 100vw"
            className="object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          {/* Horizontal dark gradient overlay */}
          <div
            className="absolute left-0 top-0 z-10 h-full w-full lg:w-[555.5px]"
            style={{
              background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%)',
            }}
          ></div>

          <div className="relative z-20 flex h-full w-full flex-col items-start pl-8 pr-8 pt-10 lg:pl-[60px] lg:pr-0 lg:pt-[68.5px]">
            <span
              className="flex items-center justify-center uppercase text-[#FFFFFF]"
              style={{
                width: '133.15px',
                height: '30px',
                backgroundColor: '#E53935',
                borderRadius: '33554400px',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '12px',
                lineHeight: '18px',
                letterSpacing: '1.2px',
              }}
            >
              Limited Offer
            </span>

            <h2
              className="mt-6 text-[#FFFFFF] lg:mt-[24px] lg:h-[120px] lg:w-[444px]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(24px, 6vw, 48px)',
                lineHeight: 1.25,
              }}
            >
              Buy 1 Get 1 Free <br /> on Winter Shades
            </h2>

            <p
              className="mt-4 lg:mt-[16px] lg:h-[81px] lg:w-[350px]"
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: 'clamp(14px, 3.5vw, 18px)',
                lineHeight: 1.5,
              }}
            >
              Protect your eyes in style with our latest polarized sunglasses. Offer ends this
              Sunday.
            </p>

            <button
              className="mt-8 flex transform items-center justify-center bg-[#FFFFFF] text-[#000000] transition-transform active:scale-95 lg:mt-[32px]"
              style={{
                width: '161.15px',
                height: '60px',
                borderRadius: '48px',
                boxShadow: '0px 10px 15px -3px rgba(0,0,0,0.1)',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '16px',
                lineHeight: '24px',
              }}
            >
              Shop Now
            </button>
          </div>
        </div>

        {/* Card 2: New Collection */}
        <div
          data-aos="fade-left"
          className="group relative flex w-full h-[450px] cursor-pointer flex-col overflow-hidden lg:h-[500px] lg:w-[604px]"
          style={{ borderRadius: '40px', backgroundColor: '#2E3192' }}
        >
          <Image
            src="https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1000&auto=format&fit=crop"
            alt="Designer Frames"
            fill
            sizes="(min-width: 1024px) 604px, 100vw"
            className="object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          {/* Horizontal blueish gradient overlay */}
          <div
            className="absolute left-0 top-0 z-10 h-full w-full lg:w-[555.5px]"
            style={{
              background:
                'linear-gradient(90deg, rgba(46, 49, 146, 0.9) 0%, rgba(0, 0, 0, 0) 100%)',
            }}
          ></div>

          <div className="relative z-20 flex h-full w-full flex-col items-start pl-8 pr-8 pt-10 lg:pl-[60px] lg:pr-0 lg:pt-[68.5px]">
            <span
              className="flex items-center justify-center uppercase text-[#2E3192]"
              style={{
                width: '154.23px',
                height: '30px',
                backgroundColor: '#FFFFFF',
                borderRadius: '33554400px',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '12px',
                lineHeight: '18px',
                letterSpacing: '1.2px',
              }}
            >
              New Collection
            </span>

            <h2
              className="mt-6 text-[#FFFFFF] lg:mt-[24px] lg:h-[120px] lg:w-[428px]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(24px, 6vw, 48px)',
                lineHeight: 1.25,
              }}
            >
              Up to 30% Off <br /> Designer Frames
            </h2>

            <p
              className="mt-4 lg:mt-[16px] lg:h-[81px] lg:w-[350px]"
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: 'clamp(14px, 3.5vw, 18px)',
                lineHeight: 1.5,
              }}
            >
              Elevate your look with premium frames from Rayban, Oakley, and more at unbeatable
              prices.
            </p>

            <button
              className="mt-8 flex transform items-center justify-center bg-[#E53935] text-[#FFFFFF] transition-transform active:scale-95 lg:mt-[32px]"
              style={{
                width: '179.21px',
                height: '60px',
                borderRadius: '48px',
                boxShadow: '0px 10px 15px -3px rgba(0,0,0,0.1)',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '16px',
                lineHeight: '24px',
              }}
            >
              Explore Sale
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Promotional;
