import React from 'react';

const Promotional = () => {
  return (
    <section className="overflow-hidden bg-white py-16">
      <div className="site-container">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Card 1: Limited Offer */}
          <div
            data-aos="fade-right"
            className="group relative h-[340px] cursor-pointer overflow-hidden rounded-[30px] shadow-lg md:h-[380px]"
          >
            <img
              src="https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=1000&auto=format&fit=crop"
              alt="Winter Shades"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

            <div className="absolute inset-0 flex flex-col items-start justify-end p-8 md:p-10">
              <span className="mb-4 rounded-full bg-[#E53935] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
                Limited Offer
              </span>
              <h2 className="mb-4 max-w-sm text-[24px] font-bold leading-tight tracking-tight text-white md:text-[32px]">
                Buy 1 Get 1 Free on Winter Shades
              </h2>
              <p className="mb-6 max-w-sm text-[14px] font-medium leading-relaxed text-white/80 md:text-[15px]">
                Protect your eyes in style with our latest polarized sunglasses. Offer ends this
                Sunday.
              </p>
              <button className="transform rounded-full bg-white px-7 py-3 text-[13px] font-bold text-black shadow-sm transition-all duration-300 hover:bg-gray-100 active:scale-95">
                Shop Now
              </button>
            </div>
          </div>

          {/* Card 2: New Collection */}
          <div
            data-aos="fade-left"
            className="group relative h-[340px] cursor-pointer overflow-hidden rounded-[30px] shadow-lg md:h-[380px]"
          >
            <img
              src="https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1000&auto=format&fit=crop"
              alt="Designer Frames"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            {/* Blueish gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#2A3182]/90 via-[#2A3182]/50 to-transparent"></div>

            <div className="absolute inset-0 flex flex-col items-start justify-end p-8 md:p-10">
              <span className="mb-4 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2A3182]">
                New Collection
              </span>
              <h2 className="mb-4 max-w-sm text-[24px] font-bold leading-tight tracking-tight text-white md:text-[32px]">
                Up to 30% Off Designer Frames
              </h2>
              <p className="mb-6 max-w-sm text-[14px] font-medium leading-relaxed text-white/80 md:text-[15px]">
                Elevate your look with premium frames from Rayban, Oakley, and more at unbeatable
                prices.
              </p>
              <button className="transform rounded-full bg-[#E53935] px-7 py-3 text-[13px] font-bold text-white shadow-sm transition-all duration-300 hover:bg-red-600 active:scale-95">
                Explore Sale
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Promotional;
