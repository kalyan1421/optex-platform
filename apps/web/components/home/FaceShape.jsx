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
    <section className="overflow-hidden bg-[#F8F9FA] py-16">
      <div className="site-container">
        <div data-aos="fade-up" className="mb-12 text-center">
          <h2 className="mb-4 text-[36px] font-bold leading-tight tracking-tight text-gray-900">
            Shop by Face Shape
          </h2>
          <p className="mx-auto max-w-2xl text-[16px] font-medium text-[#6B7280]">
            Not sure which frames suit you best? Find the perfect match based on your unique facial
            features.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          {shapes.map((shape, index) => (
            <div
              key={shape.id}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className="flex flex-col overflow-hidden rounded-[40px] border border-gray-50 bg-white shadow-sm md:rounded-[45px]"
            >
              <div className="relative flex h-64 items-center justify-center bg-[#F3F4F6] md:h-72">
                {shape.image ? (
                  <img src={shape.image} alt={shape.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center">
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

              <div className="flex flex-grow flex-col items-center p-6 pt-6 text-center">
                <h3 className="mb-2 text-[20px] font-bold text-gray-900 md:text-[22px]">
                  {shape.title}
                </h3>
                <p className="mb-6 px-1 text-[13px] font-medium leading-relaxed text-[#6B7280] md:text-[14px]">
                  {shape.description}
                </p>
                <a
                  href={`#shop-${shape.id}`}
                  className="mt-auto border-b-2 border-[#2A3182] pb-0.5 text-[15px] font-bold text-[#2A3182] transition-all duration-200 hover:border-[#E53935] hover:text-[#E53935] md:text-[16px]"
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
