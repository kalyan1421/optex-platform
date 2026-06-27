import React from 'react';

export default function VirtualTryOn() {
  return (
    <section className="bg-white py-16">
      <div className="site-container">
        <div className="relative flex flex-col items-center gap-10 overflow-hidden rounded-[32px] bg-[#1E2B7B] p-6 shadow-2xl sm:p-8 lg:flex-row lg:gap-14 lg:rounded-[44px] lg:p-14">

          {/* Left Content */}
          <div data-aos="fade-right" className="z-10 w-full text-white lg:w-[45%]">
            <h2 className="mb-5 text-[30px] font-bold leading-[1.1] tracking-tight sm:text-[36px] lg:text-[48px]">
              Try Before You <br className="hidden lg:block" />
              Choose
            </h2>
            <p className="mb-8 max-w-xl text-[14px] leading-relaxed text-white/80 sm:text-[15px] lg:text-[16px]">
              See how your frames look on your face in real time with our live virtual try-on.
              Using smart camera technology, you can explore styles instantly and find
              the perfect fit with confidence.
            </p>
            <button className="rounded-[18px] bg-white px-8 py-3.5 text-[15px] font-bold text-[#1E2B7B] shadow-xl transition-all hover:bg-gray-100 active:scale-95 sm:text-[16px]">
              Try Now
            </button>
          </div>

          {/* Right Image (Interface Screenshot) */}
          <div data-aos="fade-left" className="group relative w-full lg:w-[55%]">
            <div className="relative z-10 overflow-hidden rounded-[20px] shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]">
              <img
                src="/images/virtual-try-on.png"
                alt="Virtual Try On Interface"
                className="h-auto w-full rounded-[20px] object-cover"
              />
            </div>

            {/* Background Glows for depth */}
            <div className="absolute -top-1/4 -right-1/4 w-[150%] h-[150%] bg-gradient-to-br from-blue-400/20 to-transparent blur-[120px] -z-0"></div>
          </div>

        </div>
      </div>
    </section>
  );
}
