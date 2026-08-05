import React from 'react';

const WhyOptex = () => {
  const features = [
    {
      title: 'Certified Optometrists',
      description: 'Our team of professional eye specialists ensures you get the most accurate eye care.',
      icon: '🩺'
    },
    {
      title: 'Latest Technology',
      description: 'We use state-of-the-art diagnostic tools for comprehensive eye health assessments.',
      icon: '🔬'
    },
    {
      title: 'Premium Materials',
      description: 'Only the highest quality acetate, titanium, and lens materials for durability and comfort.',
      icon: '💎'
    },
    {
      title: 'Same Day Service',
      description: 'In-house lab capabilities allow us to provide quick turnaround on many prescriptions.',
      icon: '⚡'
    }
  ];

  return (
    <section className="bg-[#FFFFFF] flex flex-col items-center w-full px-6 lg:px-[100px] lg:pt-[100px] lg:pb-[100px] overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:justify-start lg:w-[1240px] lg:h-[664.375px] lg:gap-[80px] w-full gap-10">
        
        {/* Left Side: Image */}
        <div data-aos="fade-right" className="lg:w-[531.5px] lg:h-[664.375px] w-full flex-shrink-0 relative">
          <img
            src="/images/why-aptox.png"
            alt="Professional Optometrist"
            className="w-full h-full object-cover"
            style={{ 
              borderRadius: '40px',
              boxShadow: '0px 25px 50px -12px rgba(0,0,0,0.25)'
            }}
          />
        </div>

        {/* Right Side: Content */}
        <div data-aos="fade-left" className="flex flex-col lg:w-[531.5px] lg:h-[638.25px] lg:mt-[13.06px] w-full">
          <span 
            className="text-[#E53935] uppercase block"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '16px', lineHeight: '24px', letterSpacing: '2px' }}
          >
            Why Optex Opticians
          </span>
          
          <h2 
            className="text-[#000000] mt-[16px] lg:w-[532px]"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '48px', lineHeight: '60px' }}
          >
            Your vision is our priority. Experience the difference.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:gap-x-[32px] lg:gap-y-[32px] mt-[32px] gap-8">
            {features.map((feature, index) => (
              <div key={index} data-aos="fade-up" data-aos-delay={index * 100} className="flex flex-col lg:w-[249.75px] lg:h-[177.125px] gap-[16px]">
                
                <div 
                  className="flex items-center justify-center bg-[#F5F5F5] flex-shrink-0"
                  style={{ width: '50px', height: '50px', borderRadius: '16px' }}
                >
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '24px', lineHeight: '36px', color: '#0A0A0A' }}>
                    {feature.icon}
                  </span>
                </div>
                
                <div className="flex flex-col lg:w-[249.75px] lg:h-[111.125px] gap-[8px]">
                  <h3 
                    className="text-[#000000]"
                    style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '20px', lineHeight: '30px' }}
                  >
                    {feature.title}
                  </h3>
                  <p 
                    className="text-[#717182]"
                    style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '15px', lineHeight: '24.38px' }}
                  >
                    {feature.description}
                  </p>
                </div>
                
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default WhyOptex;
