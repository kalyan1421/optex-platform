import React from 'react';

const Promotional = () => {
  return (
    <section className="bg-[#FFFFFF] flex flex-col items-center w-full px-6 lg:px-[100px] overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:w-[1240px] lg:h-[500px] gap-6 lg:gap-[32px] w-full">
        
        {/* Card 1: Limited Offer */}
        <div data-aos="fade-right" className="relative flex flex-col w-full lg:w-[604px] lg:h-[500px] overflow-hidden group cursor-pointer" style={{ borderRadius: '40px', backgroundColor: '#1A1A1A' }}>
          <img
            src="https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=1000&auto=format&fit=crop"
            alt="Winter Shades"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          {/* Horizontal dark gradient overlay */}
          <div 
            className="absolute top-0 left-0 h-full w-full lg:w-[555.5px] z-10" 
            style={{ background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%)' }}
          ></div>

          <div className="relative z-20 flex flex-col items-start w-full h-full pl-8 pt-10 lg:pl-[60px] lg:pt-[68.5px]">
            <span 
              className="flex items-center justify-center text-[#FFFFFF] uppercase"
              style={{ width: '133.15px', height: '30px', backgroundColor: '#E53935', borderRadius: '33554400px', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '12px', lineHeight: '18px', letterSpacing: '1.2px' }}
            >
              Limited Offer
            </span>
            
            <h2 
              className="text-[#FFFFFF] mt-6 lg:mt-[24px] lg:w-[444px] lg:h-[120px]"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '48px', lineHeight: '60px' }}
            >
              Buy 1 Get 1 Free <br/> on Winter Shades
            </h2>
            
            <p 
              className="mt-4 lg:mt-[16px] lg:w-[350px] lg:h-[81px]"
              style={{ color: 'rgba(255, 255, 255, 0.7)', fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '18px', lineHeight: '27px' }}
            >
              Protect your eyes in style with our latest polarized sunglasses. Offer ends this Sunday.
            </p>
            
            <button 
              className="mt-8 lg:mt-[32px] text-[#000000] bg-[#FFFFFF] flex items-center justify-center transition-transform transform active:scale-95"
              style={{ width: '161.15px', height: '60px', borderRadius: '48px', boxShadow: '0px 10px 15px -3px rgba(0,0,0,0.1)', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '16px', lineHeight: '24px' }}
            >
              Shop Now
            </button>
          </div>
        </div>

        {/* Card 2: New Collection */}
        <div data-aos="fade-left" className="relative flex flex-col w-full lg:w-[604px] lg:h-[500px] overflow-hidden group cursor-pointer" style={{ borderRadius: '40px', backgroundColor: '#2E3192' }}>
          <img
            src="https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1000&auto=format&fit=crop"
            alt="Designer Frames"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          {/* Horizontal blueish gradient overlay */}
          <div 
            className="absolute top-0 left-0 h-full w-full lg:w-[555.5px] z-10" 
            style={{ background: 'linear-gradient(90deg, rgba(46, 49, 146, 0.9) 0%, rgba(0, 0, 0, 0) 100%)' }}
          ></div>

          <div className="relative z-20 flex flex-col items-start w-full h-full pl-8 pt-10 lg:pl-[60px] lg:pt-[68.5px]">
            <span 
              className="flex items-center justify-center text-[#2E3192] uppercase"
              style={{ width: '154.23px', height: '30px', backgroundColor: '#FFFFFF', borderRadius: '33554400px', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '12px', lineHeight: '18px', letterSpacing: '1.2px' }}
            >
              New Collection
            </span>
            
            <h2 
              className="text-[#FFFFFF] mt-6 lg:mt-[24px] lg:w-[428px] lg:h-[120px]"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '48px', lineHeight: '60px' }}
            >
              Up to 30% Off <br/> Designer Frames
            </h2>
            
            <p 
              className="mt-4 lg:mt-[16px] lg:w-[350px] lg:h-[81px]"
              style={{ color: 'rgba(255, 255, 255, 0.7)', fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '18px', lineHeight: '27px' }}
            >
              Elevate your look with premium frames from Rayban, Oakley, and more at unbeatable prices.
            </p>
            
            <button 
              className="mt-8 lg:mt-[32px] text-[#FFFFFF] bg-[#E53935] flex items-center justify-center transition-transform transform active:scale-95"
              style={{ width: '179.21px', height: '60px', borderRadius: '48px', boxShadow: '0px 10px 15px -3px rgba(0,0,0,0.1)', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '16px', lineHeight: '24px' }}
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
