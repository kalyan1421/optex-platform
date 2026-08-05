import React from 'react';

export default function VirtualTryOn() {
  return (
    <section className="bg-[#FFFFFF] flex flex-col items-center w-full px-6 lg:px-[100px]">
      <div 
        className="flex flex-col lg:flex-row items-center lg:justify-start bg-[#222D87] lg:w-[1240px] lg:h-[504px] overflow-hidden relative"
        style={{ borderRadius: '32px' }}
      >
        {/* Left Content */}
        <div data-aos="fade-right" className="flex flex-col lg:w-[512px] lg:h-[384px] lg:ml-[60px] lg:gap-[32px] p-8 lg:p-0 z-20">
          <div className="flex flex-col lg:w-[512px] lg:h-[288px] lg:gap-[24px]">
            <h2 
              className="text-[#FFFFFF] capitalize"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '60px', lineHeight: '72px', letterSpacing: '-0.6px' }}
            >
              Try Before You<br className="hidden lg:block" />Choose
            </h2>
            <p 
              className="lg:w-[500px] lg:h-[120px]"
              style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '20px', lineHeight: '30px', color: 'rgba(255, 255, 255, 0.8)' }}
            >
              See how your frames look on your face in real time with our live virtual try-on. Using smart camera technology, you can explore styles instantly and find the perfect fit with confidence.
            </p>
          </div>
          
          <button 
            className="flex justify-center items-center bg-[#FFFFFF] hover:bg-gray-100 transition-colors lg:w-[159.31px] lg:h-[64px]"
            style={{ borderRadius: '32px' }}
          >
            <span 
              className="text-[#222D87] capitalize text-center"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '24px', lineHeight: '36px', letterSpacing: '-0.24px' }}
            >
              Try Now
            </span>
          </button>
        </div>

        {/* Right Image */}
        <div data-aos="fade-left" className="relative lg:absolute lg:right-0 lg:top-[18.5px] flex justify-center items-center p-6 lg:p-0 z-10 w-full lg:w-auto">
          <img
            src="/images/virtual-try-on.png"
            alt="Virtual Try On Interface"
            className="object-cover w-full lg:w-[697px] lg:h-[467px]"
            style={{ borderRadius: '24px' }}
          />
        </div>
        
        {/* Background Glows for depth */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-white opacity-5 blur-[120px] rounded-full pointer-events-none -z-0 transform translate-x-1/3 -translate-y-1/3"></div>
      </div>
    </section>
  );
}
