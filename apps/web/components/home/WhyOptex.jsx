import React from 'react';

const WhyOptex = () => {
  const features = [
    {
      title: 'Certified Optometrists',
      description:
        'Our team of professional eye specialists ensures you get the most accurate eye care.',
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-700"
        >
          <path d="M4.8 2.3A.3.3 0 1 0 5 2a.3.3 0 0 0-.2.3Z" />
          <path d="M10 22v-2a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2" />
          <path d="M18 22v-2a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2" />
          <circle cx="7" cy="10" r="4" />
          <circle cx="15" cy="10" r="4" />
          <path d="M12 21h-2a2 2 0 0 1-2-2v-3a2 2 0 1 1 4 0v3a2 2 0 0 1-2 2Z" />
        </svg>
      ),
    },
    {
      title: 'Latest Technology',
      description:
        'We use state-of-the-art diagnostic tools for comprehensive eye health assessments.',
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-700"
        >
          <path d="M6 18h8" />
          <path d="M3 22h18" />
          <path d="M14 22a7 7 0 1 0 0-14h-1" />
          <path d="M9 14h2" />
          <path d="M9 12a2 2 0 1 0-2 2h2V4a2 2 0 1 0-4 0v10a2 2 0 1 0 2 2h2" />
        </svg>
      ),
    },
    {
      title: 'Premium Materials',
      description:
        'Only the highest quality acetate, titanium, and lens materials for durability and comfort.',
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-700"
        >
          <path d="M6 3h12l4 6-10 12L2 9l4-6Z" />
          <path d="M11 3 8 9l4 12 4-12-3-6" />
          <path d="M2 9h20" />
        </svg>
      ),
    },
    {
      title: 'Same Day Service',
      description:
        'In-house lab capabilities allow us to provide quick turnaround on many prescriptions.',
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-700"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="overflow-hidden bg-white py-16">
      <div className="section-container">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:gap-14">
          {/* Left Side: Image */}
          <div data-aos="fade-right" className="relative w-full lg:w-5/12">
            <div className="relative z-10">
              <img
                src="/images/why-aptox.png"
                alt="Professional Optometrist"
                className="aspect-square h-auto w-full transform rounded-[30px] object-cover shadow-lg transition-transform duration-500 hover:scale-[1.01] md:aspect-[4/3] lg:aspect-square"
              />
            </div>
          </div>

          {/* Right Side: Content */}
          <div data-aos="fade-left" className="w-full lg:w-7/12">
            <div className="max-w-xl">
              <span className="mb-4 block text-[11px] font-bold uppercase tracking-[0.2em] text-[#E53935]">
                Why Optex Opticians
              </span>
              <h2 className="mb-8 text-[28px] font-bold leading-[1.2] tracking-tight text-gray-900 md:text-[36px]">
                Your vision is our priority. Experience the difference.
              </h2>

              <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2 md:gap-x-10 md:gap-y-10">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    data-aos="fade-up"
                    data-aos-delay={index * 100}
                    className="group flex flex-col"
                  >
                    <div className="group-hover:bg-brand-blue mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] transition-all duration-300 group-hover:text-white">
                      <div className="scale-90 transition-transform duration-300 group-hover:scale-105">
                        {feature.icon}
                      </div>
                    </div>
                    <h3 className="mb-1.5 text-[16px] font-bold text-gray-900">{feature.title}</h3>
                    <p className="text-[13px] font-medium leading-relaxed text-[#6B7280] sm:text-[13.5px]">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyOptex;
