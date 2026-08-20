import React from 'react';
import Image from 'next/image';

const WhyOptex = () => {
  const features = [
    {
      title: 'Certified Optometrists',
      description:
        'Our team of professional eye specialists ensures you get the most accurate eye care.',
      icon: '🩺',
    },
    {
      title: 'Latest Technology',
      description:
        'We use state-of-the-art diagnostic tools for comprehensive eye health assessments.',
      icon: '🔬',
    },
    {
      title: 'Premium Materials',
      description:
        'Only the highest quality acetate, titanium, and lens materials for durability and comfort.',
      icon: '💎',
    },
    {
      title: 'Same Day Service',
      description:
        'In-house lab capabilities allow us to provide quick turnaround on many prescriptions.',
      icon: '⚡',
    },
  ];

  return (
    <section className="flex w-full flex-col items-center overflow-hidden bg-[#FFFFFF] px-6 lg:px-[100px] lg:pb-[100px] lg:pt-[100px]">
      <div className="flex w-full flex-col gap-10 lg:h-[664.375px] lg:w-[1240px] lg:flex-row lg:justify-start lg:gap-[80px]">
        {/* Left Side: Image */}
        <div
          data-aos="fade-right"
          className="relative w-full h-[400px] flex-shrink-0 sm:h-[500px] lg:h-[664.375px] lg:w-[531.5px]"
        >
          <Image
            src="/images/why-aptox.png"
            alt="Professional Optometrist"
            fill
            sizes="(min-width: 1024px) 532px, 100vw"
            className="object-cover"
            style={{
              borderRadius: '40px',
              boxShadow: '0px 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          />
        </div>

        {/* Right Side: Content */}
        <div
          data-aos="fade-left"
          className="flex w-full flex-col lg:mt-[13.06px] lg:h-[638.25px] lg:w-[531.5px]"
        >
          <span
            className="block uppercase text-[#E53935]"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '16px',
              lineHeight: '24px',
              letterSpacing: '2px',
            }}
          >
            Why Optex Opticians
          </span>

          <h2
            className="mt-[16px] text-[#000000] lg:w-[532px]"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(28px, 6vw, 48px)',
              lineHeight: 1.25,
            }}
          >
            Your vision is our priority. Experience the difference.
          </h2>

          <div className="mt-[32px] grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-x-[32px] lg:gap-y-[32px]">
            {features.map((feature, index) => (
              <div
                key={index}
                data-aos="fade-up"
                data-aos-delay={index * 100}
                className="flex flex-col gap-[16px] lg:h-[177.125px] lg:w-[249.75px]"
              >
                <div
                  className="flex flex-shrink-0 items-center justify-center bg-[#F5F5F5]"
                  style={{ width: '50px', height: '50px', borderRadius: '16px' }}
                >
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '24px',
                      lineHeight: '36px',
                      color: '#0A0A0A',
                    }}
                  >
                    {feature.icon}
                  </span>
                </div>

                <div className="flex flex-col gap-[8px] lg:h-[111.125px] lg:w-[249.75px]">
                  <h3
                    className="text-[#000000]"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '20px',
                      lineHeight: '30px',
                    }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="text-[#717182]"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      fontSize: '15px',
                      lineHeight: '24.38px',
                    }}
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
