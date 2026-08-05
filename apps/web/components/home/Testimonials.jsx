import React from 'react';

const Testimonials = () => {
  const testimonials = [
    {
      id: 1,
      name: 'Sarah Johnson',
      role: 'Marketing Director',
      text: '"Best eyewear shopping experience ever! The virtual try-on feature helped me find the perfect frames, and the quality is outstanding. Highly recommend!"',
      image: 'https://i.pravatar.cc/150?u=sarah',
      rating: 5
    },
    {
      id: 2,
      name: 'Michael Chen',
      role: 'Software Engineer',
      text: '"The blue light blocking lenses have made a huge difference for my eye strain. Professional service and great product quality."',
      image: 'https://i.pravatar.cc/150?u=michael',
      rating: 5
    },
    {
      id: 3,
      name: 'Emily Rodriguez',
      role: 'Graphic Designer',
      text: '"Love my new glasses! The staff helped me choose frames that perfectly match my style. The whole process was smooth and enjoyable."',
      image: 'https://i.pravatar.cc/150?u=emily',
      rating: 5
    }
  ];

  return (
    <section className="bg-[#F9F9F9] flex flex-col items-center w-full px-6 lg:px-[100px] lg:pt-[80px] lg:pb-[80px]">
      <div className="flex flex-col lg:w-[1240px] w-full" style={{ gap: '60px' }}>
        
        {/* Header */}
        <div data-aos="fade-up" className="flex flex-col items-center lg:w-[1240px]" style={{ gap: '12px' }}>
          <span 
            className="text-[#E53935] uppercase text-center"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '16px', lineHeight: '24px', letterSpacing: '-0.16px' }}
          >
            Testimonials
          </span>
          <h2 
            className="text-[#000000] text-center"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '48px', lineHeight: '57.6px', letterSpacing: '-0.48px', margin: 0 }}
          >
            What Our Customers Say
          </h2>
        </div>

        {/* Grid */}
        <div className="flex flex-col lg:flex-row lg:w-[1240px] w-full" style={{ gap: '24px' }}>
          {testimonials.map((item, index) => (
            <div
              key={item.id}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className="bg-[#FFFFFF] flex flex-col w-full lg:w-[397.33px] lg:h-[332.97px] lg:px-[33px] lg:pt-[33px] lg:pb-[9px] cursor-pointer hover:-translate-y-1 transition-transform duration-500"
              style={{
                gap: '20px',
                borderRadius: '24px',
                border: '1px solid #E5E7EB',
                boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)'
              }}
            >
              {/* Stars */}
              <div className="flex flex-row items-center lg:w-[331.33px] lg:h-[30px]" style={{ gap: '4px' }}>
                {[...Array(item.rating)].map((_, i) => (
                  <svg
                    key={i}
                    width="21"
                    height="21"
                    viewBox="0 0 20 20"
                    fill="#FFD700"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Text */}
              <p 
                className="text-[#1A1A1A] lg:w-[331.33px] flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '16px', lineHeight: '25.6px', letterSpacing: '-0.16px', margin: 0 }}
              >
                {item.text}
              </p>

              {/* User Info Container */}
              <div 
                className="flex flex-row items-center lg:w-[331.33px] lg:h-[69px] pt-[20px] mt-auto flex-shrink-0"
                style={{ gap: '16px', borderTop: '1px solid #D4D4D4' }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-[48px] h-[48px] object-cover flex-shrink-0"
                  style={{ borderRadius: '33554400px', backgroundColor: '#F5F5F5' }}
                />
                <div className="flex flex-col justify-center flex-1 lg:h-[45px]">
                  <h4 
                    className="text-[#000000] whitespace-nowrap"
                    style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '16px', lineHeight: '24px', letterSpacing: '-0.16px', margin: 0 }}
                  >
                    {item.name}
                  </h4>
                  <p 
                    className="text-[#717182] whitespace-nowrap"
                    style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '14px', lineHeight: '21px', letterSpacing: '-0.14px', margin: 0 }}
                  >
                    {item.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Testimonials;
