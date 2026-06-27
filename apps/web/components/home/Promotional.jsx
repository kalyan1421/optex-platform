import React from 'react';

const Promotional = () => {
  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="site-container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Limited Offer */}
          <div data-aos="fade-right" className="relative h-[340px] md:h-[380px] rounded-[30px] overflow-hidden group cursor-pointer shadow-lg">
            <img
              src="https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=1000&auto=format&fit=crop"
              alt="Winter Shades"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

            <div className="absolute inset-0 p-8 md:p-10 flex flex-col items-start justify-end">
              <span className="bg-[#E53935] text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full mb-4 uppercase tracking-wider">
                Limited Offer
              </span>
              <h2 className="text-white text-[24px] md:text-[32px] font-bold leading-tight mb-4 max-w-sm tracking-tight">
                Buy 1 Get 1 Free on Winter Shades
              </h2>
              <p className="text-white/80 text-[14px] md:text-[15px] mb-6 max-w-sm font-medium leading-relaxed">
                Protect your eyes in style with our latest polarized sunglasses. Offer ends this Sunday.
              </p>
              <button className="bg-white text-black text-[13px] font-bold px-7 py-3 rounded-full hover:bg-gray-100 transition-all duration-300 transform active:scale-95 shadow-sm">
                Shop Now
              </button>
            </div>
          </div>

          {/* Card 2: New Collection */}
          <div data-aos="fade-left" className="relative h-[340px] md:h-[380px] rounded-[30px] overflow-hidden group cursor-pointer shadow-lg">
            <img
              src="https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1000&auto=format&fit=crop"
              alt="Designer Frames"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            {/* Blueish gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#2A3182]/90 via-[#2A3182]/50 to-transparent"></div>

            <div className="absolute inset-0 p-8 md:p-10 flex flex-col items-start justify-end">
              <span className="bg-white text-[#2A3182] text-[11px] font-bold px-3.5 py-1.5 rounded-full mb-4 uppercase tracking-wider">
                New Collection
              </span>
              <h2 className="text-white text-[24px] md:text-[32px] font-bold leading-tight mb-4 max-w-sm tracking-tight">
                Up to 30% Off Designer Frames
              </h2>
              <p className="text-white/80 text-[14px] md:text-[15px] mb-6 max-w-sm font-medium leading-relaxed">
                Elevate your look with premium frames from Rayban, Oakley, and more at unbeatable prices.
              </p>
              <button className="bg-[#E53935] text-white text-[13px] font-bold px-7 py-3 rounded-full hover:bg-red-600 transition-all duration-300 transform active:scale-95 shadow-sm">
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
