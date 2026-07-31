import React from 'react';

const Testimonials = () => {
  const testimonials = [
    {
      id: 1,
      name: 'Sarah Johnson',
      role: 'Marketing Director',
      text: '"Best eyewear shopping experience ever! The virtual try-on feature helped me find the perfect frames, and the quality is outstanding. Highly recommend!"',
      image: 'https://i.pravatar.cc/150?u=sarah',
      rating: 5,
    },
    {
      id: 2,
      name: 'Michael Chen',
      role: 'Software Engineer',
      text: '"The blue light blocking lenses have made a huge difference for my eye strain. Professional service and great product quality."',
      image: 'https://i.pravatar.cc/150?u=michael',
      rating: 5,
    },
    {
      id: 3,
      name: 'Emily Rodriguez',
      role: 'Graphic Designer',
      text: '"Love my new glasses! The staff helped me choose frames that perfectly match my style. The whole process was smooth and enjoyable."',
      image: 'https://i.pravatar.cc/150?u=emily',
      rating: 5,
    },
  ];

  return (
    <section className="overflow-hidden bg-[#F9FAFB] py-16">
      <div className="site-container">
        <div data-aos="fade-up" className="mb-12 text-center">
          <span className="mb-4 block text-[11px] font-bold uppercase tracking-[0.2em] text-[#E53935]">
            Testimonials
          </span>
          <h2 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900 md:text-[36px]">
            What Our Customers Say
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {testimonials.map((item, index) => (
            <div
              key={item.id}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className="group flex flex-col rounded-[30px] border border-gray-50 bg-white p-8 shadow-sm transition-all duration-500 hover:shadow-md md:p-10"
            >
              <div className="mb-6 flex">
                {[...Array(item.rating)].map((_, i) => (
                  <svg
                    key={i}
                    className="mr-1 h-4 w-4 text-[#FFC107]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <p className="mb-6 text-[14px] font-medium italic leading-[1.6] text-[#4B5563] md:text-[15px]">
                {item.text}
              </p>

              <div className="mt-auto">
                <hr className="mb-8 border-gray-100" />
                <div className="flex items-center">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="mr-3 h-10 w-10 rounded-full border-2 border-transparent object-cover transition-all duration-300 group-hover:border-[#E53935]"
                  />
                  <div>
                    <h4 className="mb-0.5 text-[15px] font-bold leading-tight text-gray-900">
                      {item.name}
                    </h4>
                    <p className="text-[12px] font-medium text-[#6B7280]">{item.role}</p>
                  </div>
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
