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
    <section className="py-16 bg-[#F9FAFB] overflow-hidden">
      <div className="site-container">
        <div data-aos="fade-up" className="text-center mb-12">
          <span className="text-[#E53935] font-bold text-[11px] tracking-[0.2em] uppercase mb-4 block">
            Testimonials
          </span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-gray-900 leading-tight tracking-tight">
            What Our Customers Say
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {testimonials.map((item, index) => (
            <div
              key={item.id}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className="bg-white p-8 md:p-10 rounded-[30px] shadow-sm hover:shadow-md transition-all duration-500 flex flex-col border border-gray-50 group"
            >
              <div className="flex mb-6">
                {[...Array(item.rating)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-4 h-4 text-[#FFC107] mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <p className="text-[#4B5563] text-[14px] md:text-[15px] leading-[1.6] mb-6 font-medium italic">
                {item.text}
              </p>

              <div className="mt-auto">
                <hr className="border-gray-100 mb-8" />
                <div className="flex items-center">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-10 h-10 rounded-full object-cover mr-3 border-2 border-transparent group-hover:border-[#E53935] transition-all duration-300"
                  />
                  <div>
                    <h4 className="text-gray-900 font-bold text-[15px] leading-tight mb-0.5">
                      {item.name}
                    </h4>
                    <p className="text-[#6B7280] text-[12px] font-medium">
                      {item.role}
                    </p>
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
