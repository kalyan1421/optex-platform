import React from 'react';

const FinalCTA = () => {
  return (
    <section className="relative overflow-hidden bg-[#2A3182] py-16 sm:py-20">
      {/* Subtle decorative glow for premium feel */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-[120px]"></div>

      <div className="section-container relative z-10">
        <div data-aos="fade-up" className="flex flex-col items-center text-center">
          <h2 className="mb-6 max-w-4xl text-[30px] font-bold leading-[1.05] tracking-tight text-white sm:text-[38px] md:text-[48px]">
            Ready to see the world with perfect clarity?
          </h2>
          <p className="mb-10 max-w-2xl text-[14px] font-medium leading-relaxed text-white/85 sm:text-[15px] md:text-[16px]">
            Join over 50,000+ satisfied customers who have chosen Optex Opticians for their vision
            needs.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <button className="transform rounded-full bg-white px-8 py-4 text-[15px] font-bold text-[#2A3182] transition-all duration-300 hover:shadow-[0_15px_30px_rgba(255,255,255,0.2)] active:scale-95 md:px-10 md:text-[16px]">
              Shop Collection
            </button>
            <button className="transform rounded-full border-2 border-white px-8 py-4 text-[15px] font-bold text-white transition-all duration-300 hover:bg-white/10 active:scale-95 md:px-10 md:text-[16px]">
              Book Appointment
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
