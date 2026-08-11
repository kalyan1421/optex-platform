import React from 'react';

const FaceShape = () => {
  const shapes = [
    {
      id: 'oval',
      title: 'Oval',
      description:
        'Balanced proportions. Suits most frame shapes, especially rectangular and square.',
      linkText: 'Shop For Oval',
      // Using a placeholder icon style for Oval as seen in the screenshot
      image: null,
    },
    {
      id: 'round',
      title: 'Round',
      description:
        'Soft curves. Angular frames like rectangular or geometric help define features.',
      linkText: 'Shop For Round',
      image:
        'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'square',
      title: 'Square',
      description: 'Strong jawline. Round or oval frames soften angular lines for a balanced look.',
      linkText: 'Shop For Square',
      image:
        'https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'heart',
      title: 'Heart',
      description: 'Wide forehead. Bottom-heavy frames or cat-eye shapes complement your face.',
      linkText: 'Shop For Heart',
      // Using a placeholder icon style for Heart as seen in the screenshot
      image: null,
    },
  ];

  return (
    <section className="flex w-full flex-col items-center bg-[#F9F9F9] px-6 lg:px-[100px] lg:pb-[100px] lg:pt-[100px]">
      <div className="flex w-full flex-col lg:w-[1240px] lg:gap-[60px]">
        {/* Header Row */}
        <div
          data-aos="fade-up"
          className="flex flex-col items-center justify-center lg:h-[142px] lg:w-[1240px] lg:gap-[16px]"
        >
          <h2
            className="text-center capitalize text-[#000000]"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '48px',
              lineHeight: '72px',
            }}
          >
            Shop by Face Shape
          </h2>
          <p
            className="text-center text-[#717182] lg:h-[54px] lg:w-[600px]"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '27px',
            }}
          >
            Not sure which frames suit you best? Find the perfect match based on your unique facial
            features.
          </p>
        </div>

        {/* Grid Row */}
        <div className="flex flex-col gap-6 lg:h-[476px] lg:w-[1240px] lg:flex-row lg:justify-center lg:gap-[24px]">
          {shapes.map((shape, index) => (
            <div
              key={shape.id}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className="group flex cursor-pointer flex-col items-center bg-[#FFFFFF] p-[1px] transition-transform duration-500 hover:-translate-y-1 lg:h-[476px] lg:w-[267.75px]"
              style={{
                borderRadius: '32px',
                border: '1px solid #E5E7EB',
                boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.1)',
              }}
            >
              <div
                className="relative flex w-full items-center justify-center overflow-hidden bg-[#F3F4F6] lg:h-[265.75px] lg:w-[265.75px]"
                style={{ borderRadius: '31px 31px 0 0' }}
              >
                {shape.image ? (
                  <img src={shape.image} alt={shape.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center opacity-50">
                    <svg
                      width="70"
                      height="70"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-900"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="relative flex w-full flex-col items-center lg:h-[208.25px] lg:w-[265.75px]">
                <h3
                  className="absolute text-center text-[#000000]"
                  style={{
                    top: '24px',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '22px',
                    lineHeight: '33px',
                  }}
                >
                  {shape.title}
                </h3>
                <p
                  className="absolute w-full px-[24px] text-center text-[#717182]"
                  style={{
                    top: '65px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    lineHeight: '22.75px',
                  }}
                >
                  {shape.description}
                </p>
                <a
                  href={`#shop-${shape.id}`}
                  className="absolute text-center text-[#2E3192] transition-colors hover:border-[#E53935] hover:text-[#E53935]"
                  style={{
                    top: '158.25px',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 700,
                    fontSize: '16px',
                    lineHeight: '24px',
                    borderBottom: '2px solid #2E3192',
                  }}
                >
                  {shape.linkText}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FaceShape;
