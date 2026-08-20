import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

const Footer = () => {
  return (
    <footer className="flex w-full flex-col items-center bg-[#1A1A1A] px-6 lg:px-[100px] lg:pb-[80px] lg:pt-[80px]">
      <div className="flex w-full flex-col lg:w-[1240px]" style={{ gap: '60px' }}>
        {/* ROW 1: Logo, Info & 4 Link Columns (All 6 are direct siblings for perfect spacing) */}
        <div className="flex w-full flex-col items-start justify-between gap-10 lg:h-[259.2px] lg:flex-row lg:gap-0">
          {/* 1. Logo Box */}
          <div
            className="flex flex-shrink-0 items-center justify-center overflow-hidden bg-[#FFFFFF]"
            style={{ width: '279.03px', height: '259.2px', borderRadius: '32px' }}
          >
            <Image
              src="/images/footer-img.png"
              alt="Optex Opticians"
              width={279}
              height={259}
              className="h-full w-full rounded-[32px] object-cover"
            />
          </div>

          {/* 2. Company Info */}
          <div
            className="flex flex-shrink-0 flex-col"
            style={{ width: '296px', height: '259.2px' }}
          >
            <p
              className="text-white/80"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '22.4px',
                letterSpacing: '-0.14px',
                margin: 0,
                paddingBottom: '24.69px',
              }}
            >
              Precision eyewear designed for clarity, comfort, and confidence. Your trusted partner
              for all things vision since 2009.
            </p>

            <div className="flex flex-col gap-4">
              {/* Phone */}
              <div className="flex flex-row items-center gap-3">
                <div className="flex h-[20px] w-[20px] items-center justify-center">
                  <svg
                    width="20"
                    height="17"
                    viewBox="0 0 20 17"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M18.3335 12.4997V14.9997C18.3335 15.4601 17.9606 15.833 17.5002 15.833H15.0002C7.17613 15.833 0.833496 9.49034 0.833496 1.66634C0.833496 1.20611 1.2066 0.833008 1.66683 0.833008H4.16683C4.62706 0.833008 5.00016 1.20611 5.00016 1.66634V4.16634C5.00016 4.62657 4.62706 4.99967 4.16683 4.99967H3.3335C3.3335 10.4768 7.85634 14.9997 13.3335 14.9997V14.1663C13.3335 13.7061 13.7066 13.333 14.1668 13.333H16.6668C17.1271 13.333 17.5002 13.7061 17.5002 14.1663V14.9997"
                      stroke="#E53935"
                      strokeWidth="1.66667"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span
                  className="text-white/90"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    lineHeight: '21px',
                  }}
                >
                  +254 700 897 007 / +254 704 520 201
                </span>
              </div>

              {/* Email */}
              <div className="flex flex-row items-center gap-3">
                <div className="flex h-[20px] w-[20px] items-center justify-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3.33366 3.33325H16.667C17.5837 3.33325 18.3337 4.08325 18.3337 4.99992V14.9999C18.3337 15.9166 17.5837 16.6666 16.667 16.6666H3.33366C2.41699 16.6666 1.66699 15.9166 1.66699 14.9999V4.99992C1.66699 4.08325 2.41699 3.33325 3.33366 3.33325Z"
                      stroke="#E53935"
                      strokeWidth="1.66667"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M18.3337 5L10.0003 10.8333L1.66699 5"
                      stroke="#E53935"
                      strokeWidth="1.66667"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span
                  className="text-white/90"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    lineHeight: '21px',
                  }}
                >
                  optexopticals@gmail.com
                </span>
              </div>

              {/* Address */}
              <div className="flex flex-row gap-3">
                <div className="mt-0.5 flex h-[20px] w-[20px] items-center justify-center">
                  <div className="relative flex h-[20px] w-[17px] items-center justify-center">
                    <svg
                      width="17"
                      height="20"
                      viewBox="0 0 17 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="absolute inset-0"
                    >
                      <path
                        d="M15.8335 8.33301C15.8335 14.1663 8.3335 19.1663 8.3335 19.1663C8.3335 19.1663 0.833496 14.1663 0.833496 8.33301C0.833496 4.19087 4.19136 0.833008 8.3335 0.833008C12.4757 0.833008 15.8335 4.19087 15.8335 8.33301Z"
                        stroke="#E53935"
                        strokeWidth="1.66667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <svg
                      width="7"
                      height="7"
                      viewBox="0 0 7 7"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="absolute left-[5px] top-[5px]"
                    >
                      <path
                        d="M3.3335 5.83301C4.71421 5.83301 5.8335 4.71372 5.8335 3.33301C5.8335 1.9523 4.71421 0.833008 3.3335 0.833008C1.95278 0.833008 0.833496 1.9523 0.833496 3.33301C0.833496 4.71372 1.95278 5.83301 3.3335 5.83301Z"
                        stroke="#E53935"
                        strokeWidth="1.66667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <span
                  className="text-white/90"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    lineHeight: '21px',
                    maxWidth: '211px',
                  }}
                >
                  Krishna Park, next to Doctor's Park, 3rd Parklands, Nairobi, Kenya
                </span>
              </div>
            </div>
          </div>

          {/* 3. Shop */}
          <div
            className="flex flex-shrink-0 flex-col"
            style={{ width: '123.2px', height: '259.2px', gap: '24px' }}
          >
            <h4
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: '#FFFFFF',
                margin: 0,
              }}
            >
              Shop
            </h4>
            <ul
              className="flex flex-col text-white/60"
              style={{
                gap: '16px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '21px',
              }}
            >
              <li className="cursor-pointer transition-colors hover:text-white">Eyeglasses</li>
              <li className="cursor-pointer transition-colors hover:text-white">Sunglasses</li>
              <li className="cursor-pointer transition-colors hover:text-white">Contact Lenses</li>
              <li className="cursor-pointer transition-colors hover:text-white">Accessories</li>
              <li className="cursor-pointer transition-colors hover:text-white">Brands</li>
            </ul>
          </div>

          {/* 4. Services */}
          <div
            className="flex flex-shrink-0 flex-col"
            style={{ width: '123.2px', height: '259.2px', gap: '24px' }}
          >
            <h4
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: '#FFFFFF',
                margin: 0,
              }}
            >
              Services
            </h4>
            <ul
              className="flex flex-col text-white/60"
              style={{
                gap: '16px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '21px',
              }}
            >
              <li className="cursor-pointer transition-colors hover:text-white">Eye Examination</li>
              <li className="cursor-pointer transition-colors hover:text-white">Frame Fitting</li>
              <li className="cursor-pointer transition-colors hover:text-white">
                Lens Replacement
              </li>
              <li className="cursor-pointer transition-colors hover:text-white">Repairs</li>
              <li className="cursor-pointer transition-colors hover:text-white">Virtual Try-On</li>
            </ul>
          </div>

          {/* 5. Company */}
          <div
            className="flex flex-shrink-0 flex-col"
            style={{ width: '123.2px', height: '259.2px', gap: '24px' }}
          >
            <h4
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: '#FFFFFF',
                margin: 0,
              }}
            >
              Company
            </h4>
            <ul
              className="flex flex-col text-white/60"
              style={{
                gap: '16px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '21px',
              }}
            >
              <li className="cursor-pointer transition-colors hover:text-white">About Us</li>
              <li className="cursor-pointer transition-colors hover:text-white">Our Story</li>
              <li className="cursor-pointer transition-colors hover:text-white">Careers</li>
              <li className="cursor-pointer transition-colors hover:text-white">Blog</li>
              <li className="cursor-pointer transition-colors hover:text-white">Press</li>
            </ul>
          </div>

          {/* 6. Support */}
          <div
            className="flex flex-shrink-0 flex-col"
            style={{ width: '123.2px', height: '259.2px', gap: '24px' }}
          >
            <h4
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: '#FFFFFF',
                margin: 0,
              }}
            >
              Support
            </h4>
            <ul
              className="flex flex-col text-white/60"
              style={{
                gap: '16px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '21px',
              }}
            >
              <li className="cursor-pointer transition-colors hover:text-white">Contact Us</li>
              <li className="cursor-pointer transition-colors hover:text-white">FAQs</li>
              <li className="cursor-pointer transition-colors hover:text-white">
                Shipping &<br />
                Returns
              </li>
              <li className="cursor-pointer transition-colors hover:text-white">Privacy Policy</li>
              <li className="cursor-pointer transition-colors hover:text-white">
                Terms of Service
              </li>
            </ul>
          </div>
        </div>

        {/* ROW 2: Newsletter Container */}
        <div className="flex w-full flex-col items-center justify-between rounded-[24px] border-t border-white/10 bg-white/5 px-8 py-8 lg:h-[145.6px] lg:flex-row lg:px-[32.8px] lg:py-[32.8px]">
          {/* Newsletter Text */}
          <div className="mb-6 flex flex-col gap-2 lg:mb-0 lg:w-[442.59px]">
            <h4
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '20px',
                lineHeight: '30px',
                letterSpacing: '-0.2px',
                color: '#FFFFFF',
                margin: 0,
              }}
            >
              Subscribe to Our Newsletter
            </h4>
            <p
              className="text-white/60"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '21px',
                margin: 0,
              }}
            >
              Get exclusive offers, eye care tips, and latest collections delivered to your inbox
            </p>
          </div>

          {/* Newsletter Input */}
          <div className="flex w-full flex-col items-center gap-3 sm:flex-row lg:w-[447.01px]">
            <input
              type="email"
              placeholder="Enter your email"
              className="h-[46.6px] w-full flex-1 appearance-none rounded-[32px] border-t border-white/20 bg-white/10 px-[20px] text-[#FFFFFF] outline-none placeholder:text-white/40 lg:w-[300px]"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
              }}
            />
            <button
              className="flex w-full items-center justify-center bg-[#E53935] transition-transform hover:scale-105 active:scale-95 sm:w-auto"
              style={{
                width: '135.01px',
                height: '46.6px',
                borderRadius: '32px',
                boxShadow: '0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)',
              }}
            >
              <span
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#FFFFFF',
                  margin: 0,
                }}
              >
                Subscribe
              </span>
            </button>
          </div>
        </div>

        {/* ROW 3: Copyright & Socials */}
        <div className="flex w-full flex-col-reverse items-center justify-between gap-6 border-t border-white/10 pt-[32px] lg:h-[72.8px] lg:flex-row lg:gap-0">
          <p
            className="text-white/40"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '14px',
              margin: 0,
            }}
          >
            © 2026 Optex Opticians. All rights reserved.
          </p>

          <div className="flex flex-row items-center gap-[12px]">
            {['FB', 'IG', 'TW', 'LN'].map((social) => (
              <div
                key={social}
                className="flex cursor-pointer items-center justify-center bg-white/10 transition-colors hover:bg-white/20"
                style={{ width: '40px', height: '40px', borderRadius: '50%' }}
              >
                <span
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '12px',
                    color: '#FFFFFF',
                  }}
                >
                  {social}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
