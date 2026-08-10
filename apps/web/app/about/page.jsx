import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'About Us | Optex Opticians',
  description: 'Learn more about Optex Opticians, Kenya\'s premium eyewear destination.',
};

export default function AboutPage() {
  return (
    <div className="w-full flex flex-col bg-[#F9F9FC]">
      {/* Hero Section */}
      <section className="relative w-full bg-[#2E3192] flex justify-center py-12 lg:py-0 lg:h-[481px] overflow-hidden">
        
        {/* Background Decorative Rings */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1440px] h-full pointer-events-none overflow-hidden">
          <div className="absolute w-[523px] h-[523px] top-[-60px] left-[957px] rounded-[261.5px] border border-white/[0.06]"></div>
          <div className="absolute w-[523px] h-[523px] top-[-140px] left-[1057px] rounded-[261.5px] border border-white/[0.08]"></div>
        </div>

        <div className="w-full max-w-[1440px] px-6 lg:px-[80px] flex flex-col lg:flex-row lg:items-start lg:justify-between relative z-10 gap-12 lg:gap-0 h-full">
          
          {/* Left Text Content */}
          <div className="flex flex-col gap-[28px] w-full lg:w-[532px] lg:h-[380.5px] lg:mt-[60px]">
            
            {/* Text Group */}
            <div className="flex flex-col gap-[11px]">
              <span className="text-[#E53935] font-poppins font-semibold text-[16px] leading-[24px] tracking-[2px] uppercase lg:h-[24px] flex items-center">
                About us
              </span>
              
              <h1 className="text-white font-outfit font-semibold text-[36px] leading-[44px] lg:text-[48px] lg:leading-[60px] lg:h-[120px]">
                More Than Eyewear.<br />Better Vision.
              </h1>
              
              <p className="text-[#F6F6F6] font-poppins font-normal text-[16px] leading-[25px] lg:h-[50px]">
                Trusted eyewear and lenses crafted for better vision, lasting comfort, and everyday confidence.
              </p>
            </div>

            <Link 
              href="/shop" 
              className="bg-[#E53935] hover:bg-red-700 transition-colors rounded-[28px] w-[238px] h-[54px] flex items-center justify-center text-white font-poppins font-bold text-[18px] leading-[27px]"
            >
              Explore Collection
            </Link>

            {/* Stats Row */}
            <div className="flex items-center gap-[34px] flex-wrap">
              <div className="flex flex-col border-l-[2px] border-[#FFFFFF2E] pl-[14px] gap-[5px] h-[54.5px]">
                <span className="font-outfit font-semibold text-[26px] text-white leading-[100%] h-[33px] flex items-center">2009</span>
                <span className="font-poppins font-normal text-[12px] text-[#A9ABD0] leading-[100%] h-[16.5px] flex items-center">Founded in Nairobi</span>
              </div>
              <div className="flex flex-col border-l-[2px] border-[#FFFFFF2E] pl-[14px] gap-[5px] h-[54.5px]">
                <span className="font-outfit font-semibold text-[26px] text-white leading-[100%] h-[33px] flex items-center">50K+</span>
                <span className="font-poppins font-normal text-[12px] text-[#A9ABD0] leading-[100%] h-[16.5px] flex items-center">Happy customers</span>
              </div>
              <div className="flex flex-col border-l-[2px] border-[#FFFFFF2E] pl-[14px] gap-[5px] h-[54.5px]">
                <span className="font-outfit font-semibold text-[26px] text-white leading-[100%] h-[33px] flex items-center">12</span>
                <span className="font-poppins font-normal text-[12px] text-[#A9ABD0] leading-[100%] h-[16.5px] flex items-center">Stores countrywide</span>
              </div>
            </div>
          </div>

          {/* Right Image Content */}
          <div className="relative w-full max-w-[473px] lg:w-[473px] lg:h-[362px] flex-shrink-0 lg:mt-[66px]">
            {/* Image Container with Pink Border */}
            <div className="bg-[#FCC8C7] p-1 rounded-[24px] w-full aspect-[4/3] lg:w-full lg:h-full relative z-10">
              <div className="w-full h-full relative rounded-[20px] overflow-hidden">
                <Image
                  src="/images/about-hero.jpg"
                  alt="Optex Opticians Customer"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            {/* Floating Badge 1: 50K+ */}
            <div className="animate-float hidden md:flex absolute top-[15%] left-[-15%] z-20 items-center gap-[10px] bg-[#E53935] shadow-[0px_20px_40px_-10px_rgba(229,57,53,0.29)] rounded-[28px] py-[8px] pl-[18px] pr-[31px]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="18" height="18" fill="#E53935"/>
                <path d="M15 4.5L6.75 12.75L3 9" stroke="white" strokeWidth="1.5"/>
              </svg>
              <div className="flex flex-col justify-center">
                <span className="font-outfit font-bold text-[13px] text-white leading-none mb-1">50K+</span>
                <span className="font-outfit font-light text-[10px] text-white leading-none">Eyes Examined</span>
              </div>
            </div>

            {/* Floating Badge 2: 4.8/5 */}
            <div className="animate-float-delayed-1 hidden md:flex absolute top-[70%] left-[-10%] z-20 items-center gap-[10px] bg-[#E53935] shadow-[0px_20px_40px_-10px_rgba(229,57,53,0.29)] rounded-[28px] py-[8px] pl-[18px] pr-[31px]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.86487 4.05629C7.81485 2.3521 8.28983 1.5 9 1.5C9.71018 1.5 10.1852 2.35209 11.1351 4.05628L11.3809 4.49717C11.6509 4.98145 11.7858 5.22359 11.9963 5.38336C12.2068 5.54312 12.4688 5.60242 12.9931 5.72104L13.4704 5.82902C15.3151 6.24642 16.2375 6.45512 16.457 7.1608C16.6764 7.86645 16.0476 8.60183 14.7899 10.0724L14.4646 10.4529C14.1072 10.8708 13.9285 11.0797 13.8481 11.3383C13.7678 11.5968 13.7948 11.8756 13.8488 12.4332L13.898 12.9408C14.0881 14.903 14.1832 15.884 13.6087 16.3202C13.0341 16.7563 12.1705 16.3586 10.4432 15.5634L9.99638 15.3576C9.50558 15.1316 9.26018 15.0186 9 15.0186C8.73983 15.0186 8.49443 15.1316 8.00363 15.3576L7.55678 15.5634C5.82951 16.3586 4.96589 16.7563 4.39136 16.3202C3.81684 15.884 3.91191 14.903 4.10205 12.9408L4.15124 12.4332C4.20527 11.8756 4.23229 11.5968 4.1519 11.3383C4.07151 11.0797 3.89282 10.8708 3.53544 10.4529L3.21008 10.0724C1.95244 8.60183 1.32362 7.86645 1.54307 7.1608C1.76252 6.45512 2.6849 6.24642 4.52966 5.82902L5.00692 5.72104C5.53114 5.60242 5.79325 5.54312 6.00371 5.38336C6.21416 5.22359 6.34915 4.98146 6.6191 4.49717L6.86487 4.05629Z" stroke="white" strokeWidth="1.125"/>
              </svg>
              <div className="flex flex-col justify-center">
                <span className="font-outfit font-bold text-[13px] text-white leading-none mb-1">4.8/5</span>
                <span className="font-outfit font-light text-[10px] text-white leading-none">Customer Rating</span>
              </div>
            </div>

            {/* Floating Badge 3: 12 Stores */}
            <div className="animate-float-delayed-2 hidden md:flex absolute top-[30%] right-[-12%] z-20 items-center gap-[10px] bg-[#E53935] shadow-[0px_20px_40px_-10px_rgba(229,57,53,0.29)] rounded-[28px] py-[8px] pl-[18px] pr-[31px]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.84482 9.02183C3.2477 7.00747 3.44914 6.00027 4.11474 5.35157C4.23775 5.23168 4.37085 5.12258 4.51254 5.02546C5.27917 4.5 6.30631 4.5 8.36056 4.5H9.63781C11.6921 4.5 12.7192 4.5 13.4858 5.02546C13.6275 5.12258 13.7606 5.23168 13.8836 5.35157C14.5493 6.00027 14.7507 7.00747 15.1535 9.02183C15.7319 11.9138 16.0211 13.3598 15.3554 14.3845C15.2348 14.57 15.0941 14.7416 14.9359 14.8962C14.0617 15.75 12.587 15.75 9.63781 15.75H8.36056C5.41131 15.75 3.93667 15.75 3.06249 14.8962C2.90421 14.7416 2.76351 14.57 2.64297 14.3845C1.97722 13.3598 2.26642 11.9138 2.84482 9.02183Z" stroke="white" strokeWidth="1.125"/>
                <path d="M6.75 4.5V3.75C6.75 2.50736 7.75732 1.5 9 1.5C10.2427 1.5 11.25 2.50736 11.25 3.75V4.5" stroke="white" strokeWidth="1.125" strokeLinecap="round"/>
                <path d="M6.87891 11.25C7.18778 12.1239 8.02123 12.75 9.00088 12.75C9.98053 12.75 10.814 12.1239 11.1229 11.25" stroke="white" strokeWidth="1.125" strokeLinecap="round"/>
              </svg>
              <div className="flex flex-col justify-center">
                <span className="font-outfit font-bold text-[13px] text-white leading-none mb-1">12</span>
                <span className="font-outfit font-light text-[10px] text-white leading-none">Stores across Kenya</span>
              </div>
            </div>

          </div>
        </div>
      </section>
      
      {/* What Drive Us Section */}
      <section className="w-full bg-[#F9F9FC] flex justify-center py-16 lg:pt-[80px] lg:pb-0 overflow-hidden">
        <div className="w-full max-w-[1440px] px-6 lg:px-[80px] flex flex-col xl:flex-row items-center justify-between gap-12 xl:gap-0">
          {/* Left Content */}
          <div className="flex flex-col gap-5 w-full max-w-[532px]">
            <span className="font-poppins font-semibold text-[16px] text-[#E53935] tracking-[2px] uppercase">
              What drive us
            </span>
            <h2 className="font-outfit font-semibold text-[32px] leading-[34px] text-black">
              Two Perspectives.<br />One Purpose.
            </h2>
            <p className="font-poppins font-normal text-[15px] leading-[26.25px] text-[#5B5C72]">
              Our mission and vision aren't separate departments like a pair of glasses, they only work when they're held together.
            </p>
          </div>

          {/* Right Circles */}
          <div className="relative w-[643px] h-[340px] flex items-center justify-center scale-75 sm:scale-90 lg:scale-100 origin-center xl:origin-right shrink-0">
            
            {/* Mission Circle */}
            <div className="peer/mission group/mission absolute left-0 z-10 hover:z-30 w-[340px] h-[340px] rounded-[400px] bg-white hover:bg-[#2E3192] shadow-[0px_4px_25.6px_0px_rgba(0,0,0,0.07)] hover:shadow-[0px_4px_25.6px_0px_rgba(0,0,0,0.26)] flex items-center justify-center transition-all duration-[800ms] delay-[100ms] ease-in-out">
              <div className="flex flex-col items-center w-[256px] h-[203px] gap-[8px]">
                <div className="flex flex-col items-center gap-[4px] w-[24px] h-[28px]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path className="stroke-[#212360] group-hover/mission:stroke-white transition-colors duration-[800ms] delay-[100ms] ease-in-out" d="M8.03339 3.65784C8.37932 2.78072 9.62068 2.78072 9.96661 3.65785L11.0386 6.37599C11.1442 6.64378 11.3562 6.85576 11.624 6.96137L14.3422 8.03339C15.2193 8.37932 15.2193 9.62068 14.3422 9.96661L11.624 11.0386C11.3562 11.1442 11.1442 11.3562 11.0386 11.624L9.96661 14.3422C9.62067 15.2193 8.37932 15.2193 8.03339 14.3422L6.96137 11.624C6.85575 11.3562 6.64378 11.1442 6.37599 11.0386L3.65784 9.96661C2.78072 9.62067 2.78072 8.37932 3.65785 8.03339L6.37599 6.96137C6.64378 6.85575 6.85576 6.64378 6.96137 6.37599L8.03339 3.65784Z" strokeWidth="1.5"/>
                    <path className="stroke-[#212360] group-hover/mission:stroke-white transition-colors duration-[800ms] delay-[100ms] ease-in-out" d="M16.4885 13.3481C16.6715 12.884 17.3285 12.884 17.5115 13.3481L18.3121 15.3781C18.368 15.5198 18.4802 15.632 18.6219 15.6879L20.6519 16.4885C21.116 16.6715 21.116 17.3285 20.6519 17.5115L18.6219 18.3121C18.4802 18.368 18.368 18.4802 18.3121 18.6219L17.5115 20.6519C17.3285 21.116 16.6715 21.116 16.4885 20.6519L15.6879 18.6219C15.632 18.4802 15.5198 18.368 15.3781 18.3121L13.3481 17.5115C12.884 17.3285 12.884 16.6715 13.3481 16.4885L15.3781 15.6879C15.5198 15.632 15.632 15.5198 15.6879 15.3781L16.4885 13.3481Z" strokeWidth="1.5"/>
                  </svg>
                  <div className="w-[24px] h-[0px] border-t-[2px] border-[#212360] group-hover/mission:border-white transition-colors duration-[800ms] delay-[100ms] ease-in-out"></div>
                </div>
                <span className="font-poppins font-semibold text-[14px] leading-[26.25px] text-[#000000] group-hover/mission:text-[#F9F9F9] transition-colors duration-[800ms] delay-[100ms] ease-in-out uppercase text-center w-full">OUR MISSION</span>
                <p className="font-poppins font-normal group-hover/mission:font-light text-[14px] leading-[26.25px] text-[#5B5C72] group-hover/mission:text-[#F9F9F9] transition-all duration-[800ms] delay-[100ms] ease-in-out text-center w-full">
                  To make premium eyewear and vision care accessible through trusted products, transparent pricing, and an effortless shopping experience.
                </p>
              </div>
            </div>

            {/* Connecting Red Line */}
            <div className="hidden sm:block absolute z-40 left-[282px] peer-hover/mission:left-[305px] transition-all duration-[800ms] delay-[100ms] ease-in-out top-[156px] w-[56px] h-[10px] rounded-[6px] bg-[#E53935]"></div>

            {/* Vision Circle */}
            <div className="absolute right-0 z-30 peer-hover/mission:z-10 w-[340px] h-[340px] rounded-[400px] bg-[#2E3192] peer-hover/mission:bg-white shadow-[0px_4px_25.6px_0px_rgba(0,0,0,0.26)] peer-hover/mission:shadow-[0px_4px_25.6px_0px_rgba(0,0,0,0.07)] flex flex-col items-center pt-[79px] px-[34px] pb-[76px] transition-all duration-[800ms] delay-[100ms] ease-in-out peer-hover/mission:[&_path]:stroke-[#212360] peer-hover/mission:[&_.v-line]:border-[#212360] peer-hover/mission:[&_span]:text-[#000000] peer-hover/mission:[&_p]:text-[#5B5C72] peer-hover/mission:[&_p]:font-normal">
              <div className="flex flex-col items-center w-[272px] h-[176px] gap-[8px]">
                <div className="flex flex-col items-center gap-[4px]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path className="stroke-white transition-colors duration-[800ms] delay-[100ms] ease-in-out" d="M3.27489 15.2957C2.42496 14.1915 2 13.6394 2 12C2 10.3606 2.42496 9.80853 3.27489 8.70433C4.97196 6.49956 7.81811 4 12 4C16.1819 4 19.028 6.49956 20.7251 8.70433C21.575 9.80853 22 10.3606 22 12C22 13.6394 21.575 14.1915 20.7251 15.2957C19.028 17.5004 16.1819 20 12 20C7.81811 20 4.97196 17.5004 3.27489 15.2957Z" strokeWidth="1.5"/>
                    <path className="stroke-white transition-colors duration-[800ms] delay-[100ms] ease-in-out" d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" strokeWidth="1.5"/>
                  </svg>
                  <div className="v-line w-[24px] h-[0px] border-t-[2px] border-white transition-colors duration-[800ms] delay-[100ms] ease-in-out"></div>
                </div>
                <span className="font-poppins font-normal text-[14px] leading-[26.25px] text-[#F9F9F9] transition-colors duration-[800ms] delay-[100ms] ease-in-out uppercase text-center w-full">OUR VISION</span>
                <p className="font-poppins font-light text-[14px] leading-[26.25px] text-[#F9F9F9] transition-all duration-[800ms] delay-[100ms] ease-in-out text-center w-full">
                  To become the most trusted destination for eyewear by combining innovation, quality, and exceptional customer care.
                </p>
              </div>
            </div>
            
          </div>
        </div>
      </section>

      {/* How We Work Section */}
      <section className="w-full bg-[#F9F9FC] flex justify-center pb-16 lg:pt-[82px] lg:pb-[80px]">
        <div className="w-full max-w-[1440px] px-6 lg:px-[80px] flex flex-col gap-10">
          
          {/* Header */}
          <div className="flex flex-col gap-5 w-full max-w-[532px]">
            <span className="font-poppins font-semibold text-[16px] text-[#E53935] tracking-[2px] uppercase">
              How we work
            </span>
            <h2 className="font-outfit font-semibold text-[32px] leading-[34px] text-black">
              The five things we won't compromise on
            </h2>
          </div>

          {/* Grid Layout */}
          <div className="flex flex-col xl:flex-row gap-6">
            
            {/* Left Large Card */}
            <div className="group cursor-pointer w-full xl:w-[415px] h-auto min-h-[238px] rounded-[16px] bg-white border border-[#EBEBF5] hover:bg-[#2E3192] hover:border-[#2E3192] hover:shadow-[0px_10px_30px_rgba(0,0,0,0.3)] transition-all duration-500 ease-in-out flex flex-col p-[30px] justify-center gap-6 relative overflow-hidden">
               
               <div className="flex items-center gap-[16px] z-10">
                 <div className="w-[52px] h-[52px] rounded-[16px] bg-[#F0F0FF] group-hover:bg-white transition-all duration-500 ease-in-out flex items-center justify-center flex-shrink-0">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E3192" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                     <circle cx="12" cy="12" r="3"></circle>
                   </svg>
                 </div>
                 <h3 className="font-outfit font-bold text-[22px] text-[#1A1A1A] group-hover:text-white transition-all duration-500 ease-in-out leading-tight">Certified optometrists</h3>
               </div>
               
               <div className="z-10">
                 <p className="font-poppins font-normal text-[14px] leading-[24px] text-[#5B5C72] group-hover:text-white/90 transition-all duration-500 ease-in-out">
                   Every eye exam is performed by registered professionals, providing precise prescriptions, trusted expertise, and personalized care instead of sales assistants making assumptions.
                 </p>
               </div>
            </div>

            {/* Right 2x2 Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Card 1 */}
              <div className="group cursor-pointer rounded-[16px] border border-[#EBEBF5] bg-white hover:bg-[#2E3192] hover:border-[#2E3192] hover:shadow-[0px_10px_30px_rgba(0,0,0,0.3)] transition-all duration-500 ease-in-out p-6 flex gap-4 items-center">
                <div className="w-10 h-10 rounded-[10px] bg-[#F0F0FF] group-hover:bg-white transition-all duration-500 ease-in-out flex-shrink-0 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.24935 2.75H3.66602V8.25M13.7493 2.75H18.3327V8.25M8.24935 19.25H3.66602V13.75M13.7493 19.25H18.3327V13.75" stroke="#2E3192" strokeWidth="1.46667"/>
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="font-outfit font-bold text-[16px] text-[#1A1A1A] group-hover:text-white transition-all duration-500 ease-in-out">Diagnostics you can trust</h4>
                  <p className="font-poppins font-normal text-[12px] text-gray-500 group-hover:text-white/90 transition-all duration-500 ease-in-out leading-tight">Digital retinal imaging and precision lensmeters replace guesswork with actual data.</p>
                </div>
              </div>

              {/* Card 2 */}
              <div className="group cursor-pointer rounded-[16px] border border-[#EBEBF5] bg-white hover:bg-[#2E3192] hover:border-[#2E3192] hover:shadow-[0px_10px_30px_rgba(0,0,0,0.3)] transition-all duration-500 ease-in-out p-6 flex gap-4 items-center">
                <div className="w-10 h-10 rounded-[10px] bg-[#F0F0FF] group-hover:bg-white transition-all duration-500 ease-in-out flex-shrink-0 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.0003 1.83301L13.2003 6.23301L18.3337 7.33301L14.667 10.908L15.492 15.9497L11.0003 13.658L6.50866 15.9497L7.33366 10.908L3.66699 7.33301L8.80033 6.23301L11.0003 1.83301" stroke="#2E3192" strokeWidth="1.46667"/>
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="font-outfit font-bold text-[16px] text-[#1A1A1A] group-hover:text-white transition-all duration-500 ease-in-out">Materials with intent</h4>
                  <p className="font-poppins font-normal text-[12px] text-gray-500 group-hover:text-white/90 transition-all duration-500 ease-in-out leading-tight">Premium acetate, titanium, and lenses ensuring lasting durability, comfort, and timeless style.</p>
                </div>
              </div>

              {/* Card 3 */}
              <div className="group cursor-pointer rounded-[16px] border border-[#EBEBF5] bg-white hover:bg-[#2E3192] hover:border-[#2E3192] hover:shadow-[0px_10px_30px_rgba(0,0,0,0.3)] transition-all duration-500 ease-in-out p-6 flex gap-4 items-center">
                <div className="w-10 h-10 rounded-[10px] bg-[#F0F0FF] group-hover:bg-white transition-all duration-500 ease-in-out flex-shrink-0 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.75 11C2.75 15.5533 6.4467 19.25 11 19.25C15.5533 19.25 19.25 15.5533 19.25 11C19.25 6.4467 15.5533 2.75 11 2.75C6.4467 2.75 2.75 6.4467 2.75 11V11" stroke="#2E3192" strokeWidth="1.46667"/>
                    <path d="M11 6.41699V11.0003L13.75 13.7503" stroke="#2E3192" strokeWidth="1.46667"/>
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="font-outfit font-bold text-[16px] text-[#1A1A1A] group-hover:text-white transition-all duration-500 ease-in-out">Same-day service</h4>
                  <p className="font-poppins font-normal text-[12px] text-gray-500 group-hover:text-white/90 transition-all duration-500 ease-in-out leading-tight">Most single-vision glasses are crafted and delivered the very same afternoon.</p>
                </div>
              </div>

              {/* Card 4 */}
              <div className="group cursor-pointer rounded-[16px] border border-[#EBEBF5] bg-white hover:bg-[#2E3192] hover:border-[#2E3192] hover:shadow-[0px_10px_30px_rgba(0,0,0,0.3)] transition-all duration-500 ease-in-out p-6 flex gap-4 items-center">
                <div className="w-10 h-10 rounded-[10px] bg-[#F0F0FF] group-hover:bg-white transition-all duration-500 ease-in-out flex-shrink-0 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.57394 8.0924C5.88631 7.40477 5.5 6.47214 5.5 5.49967C5.5 4.52721 5.88631 3.59458 6.57394 2.90695C7.26157 2.21932 8.19421 1.83301 9.16667 1.83301C10.1391 1.83301 11.0718 2.21932 11.7594 2.90695C12.447 3.59458 12.8333 4.52721 12.8333 5.49967C12.8333 6.47214 12.447 7.40477 11.7594 8.0924C11.0718 8.78003 10.1391 9.16634 9.16667 9.16634C8.19421 9.16634 7.26157 8.78003 6.57394 8.0924Z" stroke="#2E3192" strokeWidth="1.375"/>
                    <path d="M16.4997 16.042C16.4997 18.3202 16.4997 20.167 9.16634 20.167C1.83301 20.167 1.83301 18.3202 1.83301 16.042C1.83301 13.7638 5.11625 11.917 9.16634 11.917C13.2164 11.917 16.4997 13.7638 16.4997 16.042Z" stroke="#2E3192" strokeWidth="1.375"/>
                    <path d="M17.417 7.9234L16.9294 8.40812C17.0585 8.53792 17.2339 8.6109 17.417 8.6109C17.6001 8.6109 17.7755 8.53792 17.9046 8.40812L17.417 7.9234ZM16.9985 10.9473C16.5527 10.6069 16.1511 10.3347 15.8274 9.98183C15.5275 9.65486 15.3545 9.31697 15.3545 8.89158H13.9795C13.9795 9.76092 14.3592 10.4153 14.8142 10.9113C15.2455 11.3816 15.8011 11.763 16.1644 12.0403L16.9985 10.9473ZM15.3545 8.89158C15.3545 8.51393 15.5743 8.20862 15.8562 8.08389C16.1002 7.97589 16.4888 7.96484 16.9294 8.40812L17.9046 7.43869C17.1078 6.63726 16.1213 6.46293 15.2998 6.82652C14.5159 7.17338 13.9795 7.97451 13.9795 8.89158H15.3545ZM16.1644 12.0403C16.3009 12.1444 16.478 12.2797 16.6647 12.3853C16.8516 12.4911 17.1105 12.6043 17.417 12.6043V11.2293C17.4485 11.2293 17.4324 11.2399 17.3417 11.1886C17.2508 11.1372 17.1476 11.0609 16.9985 10.9473L16.1644 12.0403ZM18.6696 12.0403C19.0329 11.763 19.5885 11.3816 20.0198 10.9113C20.4748 10.4153 20.8545 9.76092 20.8545 8.89158H19.4795C19.4795 9.31697 19.3065 9.65486 19.0066 9.98183C18.6829 10.3347 18.2813 10.6069 17.8354 10.9473L18.6696 12.0403ZM20.8545 8.89158C20.8545 7.97451 20.3181 7.17338 19.5342 6.82652C18.7127 6.46293 17.7262 6.63726 16.9294 7.43869L17.9046 8.40812C18.3452 7.96484 18.7338 7.97589 18.9778 8.08389C19.2597 8.20862 19.4795 8.51393 19.4795 8.89158H20.8545ZM17.8354 10.9473C17.6864 11.0609 17.5832 11.1372 17.4923 11.1886C17.4016 11.2399 17.3855 11.2293 17.417 11.2293V12.6043C17.7235 12.6043 17.9824 12.4911 18.1693 12.3853C18.356 12.2797 18.533 12.1444 18.6696 12.0403L17.8354 10.9473Z" fill="#2E3192"/>
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="font-outfit font-bold text-[16px] text-[#1A1A1A] group-hover:text-white transition-all duration-500 ease-in-out">Trusted expert care</h4>
                  <p className="font-poppins font-normal text-[12px] text-gray-500 group-hover:text-white/90 transition-all duration-500 ease-in-out leading-tight">Experienced eye care professionals delivering accurate personalized vision solutions.</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Blue Stat Banner */}
      <section className="relative w-full bg-[#2A3182] flex justify-center overflow-hidden">
        {/* Background Decorative Ring */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1440px] h-full pointer-events-none">
          <div className="absolute w-[283px] h-[283px] top-[-90px] left-[1217px] rounded-full border border-white/10"></div>
        </div>

        <div className="relative z-10 w-full max-w-[1440px] px-6 lg:px-[132px] grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10 border-white/10">
          <div className="flex flex-col items-center justify-center text-center gap-2 px-4 py-8 lg:py-[66px]">
            <span className="font-outfit font-extrabold text-[32px] lg:text-[42px] text-white leading-none">50,000+</span>
            <span className="font-poppins font-normal text-[13px] text-[#B3B4D6]">Happy Customers</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center gap-2 px-4 py-8 lg:py-[66px]">
            <span className="font-outfit font-extrabold text-[32px] lg:text-[42px] text-white leading-none">500+</span>
            <span className="font-poppins font-normal text-[13px] text-[#B3B4D6]">Eyewear Styles</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center gap-2 px-4 py-8 lg:py-[66px]">
            <span className="font-outfit font-extrabold text-[32px] lg:text-[42px] text-white leading-none">100%</span>
            <span className="font-poppins font-normal text-[13px] text-[#B3B4D6]">Authentic Products</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center gap-2 px-4 py-8 lg:py-[66px]">
            <span className="font-outfit font-extrabold text-[32px] lg:text-[42px] text-white leading-none">24/7</span>
            <span className="font-poppins font-normal text-[13px] text-[#B3B4D6]">Customer Support</span>
          </div>
        </div>
      </section>

      {/* From Walk-in to Wearing */}
      <section className="w-full bg-white flex justify-center py-16 lg:pt-[100px] lg:pb-[100px]">
        <div className="w-full max-w-[1440px] px-6 lg:px-[80px] flex flex-col gap-[40px]">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <span className="font-poppins font-semibold text-[16px] text-[#E53935] tracking-[2px] uppercase">
              From walk-in to wearing
            </span>
            <h2 className="font-outfit font-semibold text-[32px] leading-[34px] text-black">
              What actually happens when you visit
            </h2>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-[45px] mt-4">
            
            {/* Step 1 */}
            <div className="flex flex-col gap-[10px] group cursor-pointer">
              <div className="w-[52px] h-[52px] rounded-[26px] border-[2px] border-[#2E3192] bg-white text-[#2E3192] group-hover:border-[#E53935] group-hover:bg-[#E53935] group-hover:text-white transition-all duration-500 ease-in-out flex items-center justify-center font-outfit font-extrabold text-[18px]">
                01
              </div>
              <h3 className="font-outfit font-bold text-[20px] leading-[17px] tracking-[-0.16px] text-[#20225F] mt-2">
                Comprehensive exam
              </h3>
              <p className="font-poppins font-normal text-[13px] leading-[22.1px] text-[#6A6B82]">
                A full digital eye test with a certified optometrist usually under 20 minutes.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col gap-[10px] group cursor-pointer">
              <div className="w-[52px] h-[52px] rounded-[26px] border-[2px] border-[#2E3192] bg-white text-[#2E3192] group-hover:border-[#E53935] group-hover:bg-[#E53935] group-hover:text-white transition-all duration-500 ease-in-out flex items-center justify-center font-outfit font-extrabold text-[18px]">
                02
              </div>
              <h3 className="font-outfit font-bold text-[20px] leading-[17px] tracking-[-0.16px] text-[#20225F] mt-2">
                Frame styling session
              </h3>
              <p className="font-poppins font-normal text-[13px] leading-[22.1px] text-[#6A6B82]">
                We match frames to your face shape, prescription and how you actually live.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col gap-[10px] group cursor-pointer">
              <div className="w-[52px] h-[52px] rounded-[26px] border-[2px] border-[#2E3192] bg-white text-[#2E3192] group-hover:border-[#E53935] group-hover:bg-[#E53935] group-hover:text-white transition-all duration-500 ease-in-out flex items-center justify-center font-outfit font-extrabold text-[18px]">
                03
              </div>
              <h3 className="font-outfit font-bold text-[20px] leading-[17px] tracking-[-0.16px] text-[#20225F] mt-2">
                Precision fitting
              </h3>
              <p className="font-poppins font-normal text-[13px] leading-[22.1px] text-[#6A6B82]">
                Lenses cut and glazed in our own lab, then adjusted to your face not the other way round.
              </p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col gap-[10px] group cursor-pointer">
              <div className="w-[52px] h-[52px] rounded-[26px] border-[2px] border-[#2E3192] bg-white text-[#2E3192] group-hover:border-[#E53935] group-hover:bg-[#E53935] group-hover:text-white transition-all duration-500 ease-in-out flex items-center justify-center font-outfit font-extrabold text-[18px]">
                04
              </div>
              <h3 className="font-outfit font-bold text-[20px] leading-[17px] tracking-[-0.16px] text-[#20225F] mt-2">
                Same-day pickup
              </h3>
              <p className="font-poppins font-normal text-[13px] leading-[22.1px] text-[#6A6B82]">
                Most single vision pairs are ready before the store closes. No week long wait.
              </p>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
