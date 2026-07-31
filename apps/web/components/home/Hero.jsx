import React from 'react';
import Image from 'next/image';

export default function Hero() {
  return (
    <section className="relative h-screen w-full select-none overflow-hidden bg-white">
      <div className="site-container relative flex h-full items-center justify-center pt-20 lg:justify-start lg:pt-0">
        {/* Left: Content */}
        <div
          data-aos="fade-up"
          data-aos-delay="200"
          className="z-20 mx-auto flex w-full max-w-[580px] flex-col items-center text-center lg:mx-0 lg:w-[50%] lg:items-start lg:text-left"
        >
          <h1 className="text-[30px] font-[900] uppercase leading-[0.95] tracking-tighter drop-shadow-md sm:text-[40px] md:text-[44px] lg:text-[60px] lg:drop-shadow-none">
            <span className="lg:text-brand-red block text-white">UWAZI WA</span>
            <span className="lg:text-brand-red block text-white">MAONO,</span>
            <span className="lg:text-brand-dark mt-1 block text-white">UREMBO WA</span>
            <span className="lg:text-brand-dark block text-white">MTINDO</span>
          </h1>

          <p className="mt-5 inline-block max-w-[460px] px-2 py-1 text-[14px] font-semibold leading-relaxed text-white sm:px-0 lg:block lg:bg-transparent lg:py-0 lg:text-[15px] lg:text-gray-700">
            Crafted for bold vision and timeless Kenyan style.
            <br className="hidden sm:block" />
            Step into clarity. Step into confidence.
          </p>

          <div className="mt-8 flex w-full max-w-[420px] flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4 lg:max-w-none lg:justify-start">
            <a
              href="#shop"
              className="bg-brand-blue w-full transform rounded-full px-6 py-3 text-center text-[14px] font-bold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-800 sm:w-auto"
            >
              Shop Now
            </a>
            <a
              href="#collection"
              className="border-brand-red text-brand-red hover:bg-brand-red w-full transform rounded-full border-0 bg-white px-6 py-3 text-center text-[14px] font-bold shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:text-white sm:w-auto sm:border-[1.5px] lg:bg-transparent"
            >
              Explore Collection
            </a>
          </div>
        </div>

        {/* Right: Background Image - Full 100vh Height Coverage */}
        <div
          className="pointer-events-none absolute right-0 top-0 z-10 h-full w-full bg-cover bg-center bg-no-repeat sm:bg-[position:65%_center] lg:w-[65%] lg:bg-right-top"
          style={{
            backgroundImage: `url(/images/home-banner.png)`,
          }}
        >
          {/* Mobile Overlay for text readability */}
          <div className="absolute inset-0 z-0 bg-black/20 lg:bg-transparent" />

          {/* Smooth Bottom-Up Fade Overlay */}
          <div className="absolute bottom-0 left-0 z-10 h-[40%] w-full bg-gradient-to-t from-white via-white/40 to-transparent" />
        </div>
      </div>
    </section>
  );
}
