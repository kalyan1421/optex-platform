import React from 'react';
import Image from 'next/image';

export default function VirtualTryOn() {
  return (
    <section className="flex w-full flex-col items-center bg-[#FFFFFF] px-6 lg:px-[100px]">
      <div
        className="relative flex flex-col items-center overflow-hidden bg-[#222D87] lg:h-[504px] lg:w-[1240px] lg:flex-row lg:justify-start"
        style={{ borderRadius: '32px' }}
      >
        {/* Left Content */}
        <div
          data-aos="fade-right"
          className="z-20 flex flex-col p-8 lg:ml-[60px] lg:h-[384px] lg:w-[512px] lg:gap-[32px] lg:p-0"
        >
          <div className="flex flex-col lg:h-[288px] lg:w-[512px] lg:gap-[24px]">
            <h2
              className="capitalize text-[#FFFFFF]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(34px, 7vw, 60px)',
                lineHeight: 1.2,
                letterSpacing: '-0.6px',
              }}
            >
              Try Before You
              <br className="hidden lg:block" />
              Choose
            </h2>
            <p
              className="lg:h-[120px] lg:w-[500px]"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: 'clamp(15px, 3.5vw, 20px)',
                lineHeight: 1.5,
                color: 'rgba(255, 255, 255, 0.8)',
              }}
            >
              See how your frames look on your face in real time with our live virtual try-on. Using
              smart camera technology, you can explore styles instantly and find the perfect fit
              with confidence.
            </p>
          </div>

          <button
            className="flex items-center justify-center bg-[#FFFFFF] transition-colors hover:bg-gray-100 lg:h-[64px] lg:w-[159.31px]"
            style={{ borderRadius: '32px' }}
          >
            <span
              className="text-center capitalize text-[#222D87]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '24px',
                lineHeight: '36px',
                letterSpacing: '-0.24px',
              }}
            >
              Try Now
            </span>
          </button>
        </div>

        {/* Right Image */}
        <div
          data-aos="fade-left"
          className="relative z-10 flex w-full items-center justify-center p-6 lg:absolute lg:right-0 lg:top-[18.5px] lg:w-auto lg:p-0"
        >
          <Image
            src="/images/virtual-try-on.png"
            alt="Virtual Try On Interface"
            width={697}
            height={467}
            sizes="(min-width: 1024px) 697px, 100vw"
            className="h-auto w-full object-cover lg:h-[467px] lg:w-[697px]"
            style={{ borderRadius: '24px' }}
          />
        </div>

        {/* Background Glows for depth */}
        <div className="pointer-events-none absolute right-0 top-0 -z-0 h-[800px] w-[800px] -translate-y-1/3 translate-x-1/3 transform rounded-full bg-white opacity-5 blur-[120px]"></div>
      </div>
    </section>
  );
}
