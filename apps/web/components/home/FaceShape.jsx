import React from 'react';

const FaceShape = () => {
  const shapes = [
    {
      id: 'oval',
      title: 'Oval',
      description: 'Balanced proportions. Suits most frame shapes, especially rectangular and square.',
      linkText: 'Shop For Oval',
      // Using a placeholder icon style for Oval as seen in the screenshot
      image: null,
    },
    {
      id: 'round',
      title: 'Round',
      description: 'Soft curves. Angular frames like rectangular or geometric help define features.',
      linkText: 'Shop For Round',
      image: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'square',
      title: 'Square',
      description: 'Strong jawline. Round or oval frames soften angular lines for a balanced look.',
      linkText: 'Shop For Square',
      image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'heart',
      title: 'Heart',
      description: 'Wide forehead. Bottom-heavy frames or cat-eye shapes complement your face.',
      linkText: 'Shop For Heart',
      // Using a placeholder icon style for Heart as seen in the screenshot
      image: null,
    }
  ];

  return (
    <section className="bg-[#F9F9F9] flex flex-col items-center w-full px-6 lg:px-[100px] lg:pt-[100px] lg:pb-[100px]">
      <div className="flex flex-col lg:w-[1240px] lg:gap-[60px] w-full">
        
        {/* Header Row */}
        <div data-aos="fade-up" className="flex flex-col items-center justify-center lg:w-[1240px] lg:h-[142px] lg:gap-[16px]">
          <h2 
            className="text-[#000000] text-center capitalize"
            style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '48px', lineHeight: '72px' }}
          >
            Shop by Face Shape
          </h2>
          <p 
            className="text-[#717182] text-center lg:w-[600px] lg:h-[54px]"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '18px', lineHeight: '27px' }}
          >
            Not sure which frames suit you best? Find the perfect match based on your unique facial features.
          </p>
        </div>

        {/* Grid Row */}
        <div className="flex flex-col lg:flex-row lg:justify-center lg:w-[1240px] lg:h-[476px] gap-6 lg:gap-[24px]">
          {shapes.map((shape, index) => (
            <div
              key={shape.id}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className="group bg-[#FFFFFF] flex flex-col items-center lg:w-[267.75px] lg:h-[476px] p-[1px] hover:-translate-y-1 transition-transform duration-500 cursor-pointer"
              style={{
                borderRadius: '32px',
                border: '1px solid #E5E7EB',
                boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.1)'
              }}
            >
              <div className="relative flex items-center justify-center bg-[#F3F4F6] w-full lg:w-[265.75px] lg:h-[265.75px] overflow-hidden" style={{ borderRadius: '31px 31px 0 0' }}>
                {shape.image ? (
                  <img
                    src={shape.image}
                    alt={shape.title}
                    className="w-full h-full object-cover"
                  />
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
              
              <div className="relative flex flex-col items-center w-full lg:w-[265.75px] lg:h-[208.25px]">
                <h3 
                  className="absolute text-center text-[#000000]"
                  style={{ top: '24px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '22px', lineHeight: '33px' }}
                >
                  {shape.title}
                </h3>
                <p 
                  className="absolute text-center text-[#717182] w-full px-[24px]"
                  style={{ top: '65px', fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '14px', lineHeight: '22.75px' }}
                >
                  {shape.description}
                </p>
                <a 
                  href={`#shop-${shape.id}`}
                  className="absolute text-center text-[#2E3192] transition-colors hover:text-[#E53935] hover:border-[#E53935]"
                  style={{ top: '158.25px', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '16px', lineHeight: '24px', borderBottom: '2px solid #2E3192' }}
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
