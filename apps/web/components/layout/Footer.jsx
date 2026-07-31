import Image from 'next/image';
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="bg-[#121212] pt-12 text-white sm:pt-14">
      <div className="section-container">
        <div className="mb-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-6 lg:gap-10">
          <div className="space-y-4 lg:col-span-2">
            <div className="inline-flex">
              <Image
                src="/images/footer-img.png"
                alt="Optex Opticians"
                width={165}
                height={60}
                className="block h-auto w-[165px] object-contain"
              />
            </div>
            <p className="max-w-sm text-[13px] font-medium leading-relaxed text-gray-400 sm:text-[13.5px]">
              Precision eyewear designed for clarity, comfort, and confidence. Your trusted partner
              for all things vision since 2009.
            </p>
            <div className="space-y-3">
              <div className="group flex items-center space-x-3 text-gray-300">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E53935]/10 text-[#E53935] transition-all duration-300 group-hover:bg-[#E53935] group-hover:text-white">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <span className="text-[12.5px] font-semibold">+254 700 000 000</span>
              </div>
              <div className="group flex items-center space-x-3 text-gray-300">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E53935]/10 text-[#E53935] transition-all duration-300 group-hover:bg-[#E53935] group-hover:text-white">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <span className="text-[12.5px] font-semibold">optexopticians@gmail.com</span>
              </div>
              <div className="group flex items-center space-x-3 text-gray-300">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E53935]/10 text-[#E53935] transition-all duration-300 group-hover:bg-[#E53935] group-hover:text-white">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <span className="text-[12.5px] font-semibold leading-tight">
                  Nairobi CBD, Kenya
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[15px] font-bold text-white">Shop</h4>
            <ul className="space-y-2.5 text-[13.5px] font-medium text-gray-400">
              <li className="transition-colors hover:text-[#E53935]">
                <Link href="/category/eyeglasses" className="hover:text-[#E53935]">
                  Eyeglasses
                </Link>
              </li>
              <li className="transition-colors hover:text-[#E53935]">
                <Link href="/category/sunglasses" className="hover:text-[#E53935]">
                  Sunglasses
                </Link>
              </li>
              <li className="transition-colors hover:text-[#E53935]">
                <Link href="/category/contact-lenses" className="hover:text-[#E53935]">
                  Contact Lenses
                </Link>
              </li>
              <li className="transition-colors hover:text-[#E53935]">
                <Link href="/category/kids" className="hover:text-[#E53935]">
                  Kids Eyewear
                </Link>
              </li>
              <li className="transition-colors hover:text-[#E53935]">
                <Link href="/shop" className="hover:text-[#E53935]">
                  All Products
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-[15px] font-bold text-white">Services</h4>
            <ul className="space-y-2.5 text-[13.5px] font-medium text-gray-400">
              <li className="cursor-pointer transition-colors hover:text-[#E53935]">
                Eye Examination
              </li>
              <li className="cursor-pointer transition-colors hover:text-[#E53935]">
                Frame Fitting
              </li>
              <li className="cursor-pointer transition-colors hover:text-[#E53935]">
                Lens Replacement
              </li>
              <li className="cursor-pointer transition-colors hover:text-[#E53935]">Repairs</li>
              <li className="cursor-pointer transition-colors hover:text-[#E53935]">
                Virtual Try-On
              </li>
              <li className="transition-colors hover:text-[#E53935]">
                <Link href="/branch-locator" className="hover:text-[#E53935]">
                  Find a Store
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-[15px] font-bold text-white">Company</h4>
            <ul className="space-y-2.5 text-[13.5px] font-medium text-gray-400">
              <li className="cursor-pointer transition-colors hover:text-[#E53935]">About Us</li>
              <li className="cursor-pointer transition-colors hover:text-[#E53935]">Our Story</li>
              <li className="cursor-pointer transition-colors hover:text-[#E53935]">Careers</li>
              <li className="cursor-pointer transition-colors hover:text-[#E53935]">Blog</li>
              <li className="cursor-pointer transition-colors hover:text-[#E53935]">Press</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-[15px] font-bold text-white">Support</h4>
            <ul className="space-y-2.5 text-[13.5px] font-medium text-gray-400">
              <li className="transition-colors hover:text-[#E53935]">
                <Link href="/contact" className="hover:text-[#E53935]">
                  Contact Us
                </Link>
              </li>
              <li className="cursor-pointer transition-colors hover:text-[#E53935]">FAQs</li>
              <li className="transition-colors hover:text-[#E53935]">
                <Link href="/returns" className="hover:text-[#E53935]">
                  Returns Policy
                </Link>
              </li>
              <li className="transition-colors hover:text-[#E53935]">
                <Link href="/delivery" className="hover:text-[#E53935]">
                  Delivery Policy
                </Link>
              </li>
              <li className="transition-colors hover:text-[#E53935]">
                <Link href="/warranty" className="hover:text-[#E53935]">
                  Warranty Policy
                </Link>
              </li>
              <li className="transition-colors hover:text-[#E53935]">
                <Link href="/privacy" className="hover:text-[#E53935]">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mb-8 rounded-[25px] border border-gray-800/50 bg-[#1A1A1A] p-5 sm:p-6 md:p-8">
          <div className="flex flex-col items-stretch justify-between gap-6 lg:flex-row lg:items-center">
            <div className="space-y-2 text-center lg:text-left">
              <h3 className="text-[20px] font-bold tracking-tight text-white md:text-[24px]">
                Subscribe to Our Newsletter
              </h3>
              <p className="max-w-md text-[13px] font-medium text-gray-400 sm:text-[13.5px]">
                Get exclusive offers, eye care tips, and latest collections delivered to your inbox.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 rounded-[22px] border border-gray-700/50 bg-[#2A2A2A] p-2 sm:flex-row sm:items-center sm:rounded-full lg:w-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full bg-transparent px-4 py-2 text-[13.5px] text-white outline-none sm:px-5 lg:w-64"
              />
              <button className="whitespace-nowrap rounded-full bg-[#E53935] px-6 py-2.5 text-[13.5px] font-bold text-white shadow-xl transition-all hover:bg-red-600 active:scale-95">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-800 py-6 text-center md:flex-row md:text-left">
          <p className="text-[12.5px] text-gray-500">
            Copyright 2026 Optex Opticians. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 md:justify-end">
            <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-400 transition-all hover:bg-white hover:text-black">
              FB
            </div>
            <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-400 transition-all hover:bg-white hover:text-black">
              IG
            </div>
            <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-400 transition-all hover:bg-white hover:text-black">
              TW
            </div>
            <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-gray-400 transition-all hover:bg-white hover:text-black">
              LN
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
