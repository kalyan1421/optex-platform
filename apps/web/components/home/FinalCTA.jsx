import React from 'react';

const FinalCTA = () => {
  return (
    <section className="relative overflow-hidden bg-[#2E3192] flex flex-col items-center w-full px-6 lg:px-[100px] lg:pt-[120px] lg:pb-[120px]">
      
      {/* Decorative gradient overlay (Right edge) */}
      <div 
        className="absolute right-0 top-0 h-full pointer-events-none opacity-10"
        style={{
          width: '537.19px',
          background: 'linear-gradient(270deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%)'
        }}
      ></div>

      <div className="relative z-10 flex flex-col items-center lg:w-[1143px] w-full">
        
        {/* Heading */}
        <h2 
          className="text-[#FFFFFF] text-center lg:w-[753px] lg:h-[160px]"
          style={{ 
            fontFamily: 'Poppins, sans-serif', 
            fontWeight: 700, 
            fontSize: '64px', 
            lineHeight: '80px', 
            letterSpacing: '0px',
            margin: 0
          }}
          data-aos="fade-up"
        >
          Ready to see the world with perfect clarity?
        </h2>

        {/* Paragraph */}
        <p 
          className="text-center lg:w-[700px] lg:h-[66px]"
          style={{ 
            fontFamily: 'Inter, sans-serif', 
            fontWeight: 400, 
            fontSize: '22px', 
            lineHeight: '33px', 
            letterSpacing: '0px',
            color: 'rgba(255, 255, 255, 0.8)',
            marginTop: '24px',
            marginBottom: '0'
          }}
          data-aos="fade-up"
          data-aos-delay="100"
        >
          Join over 50,000+ satisfied customers who have chosen Optex Opticians for their vision needs.
        </p>

        {/* Buttons Container */}
        <div 
          className="flex flex-col sm:flex-row items-center justify-center lg:w-[1143px] lg:h-[67px]"
          style={{ gap: '24px', marginTop: '50px' }}
          data-aos="fade-up"
          data-aos-delay="200"
        >
          {/* Primary Button */}
          <button 
            className="flex items-center justify-center bg-[#FFFFFF] transition-transform duration-300 hover:scale-105 active:scale-95"
            style={{ 
              width: '240.7px', 
              height: '67px', 
              borderRadius: '48px',
              boxShadow: '0px 8px 10px -6px rgba(0,0,0,0.1), 0px 20px 25px -5px rgba(0,0,0,0.1)'
            }}
          >
            <span 
              className="text-[#2E3192]"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px', lineHeight: '27px', margin: 0 }}
            >
              Shop Collection
            </span>
          </button>

          {/* Secondary Button */}
          <button 
            className="flex items-center justify-center bg-transparent transition-all duration-300 hover:bg-white/10 active:scale-95"
            style={{ 
              width: '273.25px', 
              height: '67px', 
              borderRadius: '48px',
              border: '2px solid #FFFFFF'
            }}
          >
            <span 
              className="text-[#FFFFFF]"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px', lineHeight: '27px', margin: 0 }}
            >
              Book Appointment
            </span>
          </button>
        </div>

      </div>
    </section>
  );
};

export default FinalCTA;
