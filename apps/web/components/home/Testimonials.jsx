import React from 'react';
import Image from 'next/image';

/**
 * Not rendered on the homepage (see app/page.jsx) until real testimonials
 * exist — docs/CLIENT-QUESTIONS.md E2 asked the client for 3-5 genuine
 * quotes with permission to publish, or approval to drop the section.
 * Takes real data via props rather than shipping any built-in fallback, so
 * this can't silently render fabricated people again if re-added.
 */
const Testimonials = ({ testimonials = [] }) => {
  if (testimonials.length === 0) return null;

  return (
    <section className="flex w-full flex-col items-center bg-[#F9F9F9] px-6 lg:px-[100px] lg:pb-[80px] lg:pt-[80px]">
      <div className="flex w-full flex-col lg:w-[1240px]" style={{ gap: '60px' }}>
        {/* Header */}
        <div
          data-aos="fade-up"
          className="flex flex-col items-center lg:w-[1240px]"
          style={{ gap: '12px' }}
        >
          <span
            className="text-center uppercase text-[#E53935]"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '16px',
              lineHeight: '24px',
              letterSpacing: '-0.16px',
            }}
          >
            Testimonials
          </span>
          <h2
            className="text-center text-[#000000]"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(28px, 6vw, 48px)',
              lineHeight: 1.2,
              letterSpacing: '-0.48px',
              margin: 0,
            }}
          >
            What Our Customers Say
          </h2>
        </div>

        {/* Grid */}
        <div className="flex w-full flex-col lg:w-[1240px] lg:flex-row" style={{ gap: '24px' }}>
          {testimonials.map((item, index) => (
            <div
              key={item.id}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className="flex w-full cursor-pointer flex-col bg-[#FFFFFF] transition-transform duration-500 hover:-translate-y-1 lg:h-[332.97px] lg:w-[397.33px] lg:px-[33px] lg:pb-[9px] lg:pt-[33px]"
              style={{
                gap: '20px',
                borderRadius: '24px',
                border: '1px solid #E5E7EB',
                boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)',
              }}
            >
              {/* Stars */}
              <div
                className="flex flex-row items-center lg:h-[30px] lg:w-[331.33px]"
                style={{ gap: '4px' }}
              >
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
                className="min-h-0 flex-1 overflow-y-auto text-[#1A1A1A] [-ms-overflow-style:none] [scrollbar-width:none] lg:w-[331.33px] [&::-webkit-scrollbar]:hidden"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '16px',
                  lineHeight: '25.6px',
                  letterSpacing: '-0.16px',
                  margin: 0,
                }}
              >
                {item.text}
              </p>

              {/* User Info Container */}
              <div
                className="mt-auto flex flex-shrink-0 flex-row items-center pt-[20px] lg:h-[69px] lg:w-[331.33px]"
                style={{ gap: '16px', borderTop: '1px solid #D4D4D4' }}
              >
                <Image
                  src={item.image}
                  alt={item.name}
                  width={48}
                  height={48}
                  className="h-[48px] w-[48px] flex-shrink-0 object-cover"
                  style={{ borderRadius: '33554400px', backgroundColor: '#F5F5F5' }}
                />
                <div className="flex flex-1 flex-col justify-center lg:h-[45px]">
                  <h4
                    className="whitespace-nowrap text-[#000000]"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '16px',
                      lineHeight: '24px',
                      letterSpacing: '-0.16px',
                      margin: 0,
                    }}
                  >
                    {item.name}
                  </h4>
                  <p
                    className="whitespace-nowrap text-[#717182]"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px',
                      lineHeight: '21px',
                      letterSpacing: '-0.14px',
                      margin: 0,
                    }}
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
