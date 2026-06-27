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
    <section className="py-16 bg-[#F8F9FA] overflow-hidden">
      <div className="site-container">
        <div data-aos="fade-up" className="text-center mb-12">
          <h2 className="text-[36px] font-bold text-gray-900 mb-4 tracking-tight leading-tight">
            Shop by Face Shape
          </h2>
          <p className="text-[#6B7280] text-[16px] max-w-2xl mx-auto font-medium">
            Not sure which frames suit you best? Find the perfect match based on your unique facial features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {shapes.map((shape, index) => (
            <div
              key={shape.id}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className="bg-white rounded-[40px] md:rounded-[45px] overflow-hidden shadow-sm flex flex-col border border-gray-50"
            >
              <div className="h-64 md:h-72 relative bg-[#F3F4F6] flex items-center justify-center">
                {shape.image ? (
                  <img
                    src={shape.image}
                    alt={shape.title}
                    className="w-full h-full object-cover"
                  />
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

              <div className="p-6 pt-6 flex flex-col items-center text-center flex-grow">
                <h3 className="text-[20px] md:text-[22px] font-bold text-gray-900 mb-2">
                  {shape.title}
                </h3>
                <p className="text-[#6B7280] text-[13px] md:text-[14px] leading-relaxed mb-6 px-1 font-medium">
                  {shape.description}
                </p>
                <a
                  href={`#shop-${shape.id}`}
                  className="mt-auto text-[#2A3182] font-bold text-[15px] md:text-[16px] border-b-2 border-[#2A3182] pb-0.5 hover:text-[#E53935] hover:border-[#E53935] transition-all duration-200"
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
