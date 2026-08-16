'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import SearchAutocomplete from '@/components/search/SearchAutocomplete';

const CATEGORIES = [
  { name: 'Eyeglasses', slug: 'eyeglasses' },
  { name: 'Sunglasses', slug: 'sunglasses' },
  { name: 'Contact Lenses', slug: 'contact-lenses' },
  { name: 'Kids Eyewear', slug: 'kids' },
  { name: 'Computer Glasses', slug: 'computer-glasses' },
  { name: 'Reading Glasses', slug: 'reading-glasses' },
];

const ChevronDown = () => (
  <svg className="h-[8px] w-[14px] flex-shrink-0" fill="none" viewBox="0 0 14 8">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.37629 7.37629C7.18876 7.56376 6.93445 7.66907 6.66929 7.66907C6.40412 7.66907 6.14982 7.56376 5.96229 7.37629L0.305288 1.71929C0.209778 1.62704 0.133596 1.5167 0.0811869 1.39469C0.0287779 1.27269 0.00119157 1.14147 3.77564e-05 1.00869C-0.00111606 0.87591 0.0241859 0.744231 0.0744668 0.621335C0.124748 0.498438 0.199001 0.386786 0.292893 0.292893C0.386786 0.199 0.498438 0.124747 0.621334 0.0744663C0.744231 0.0241854 0.87591 -0.00111606 1.00869 3.77571e-05C1.14147 0.00119157 1.27269 0.0287779 1.39469 0.0811869C1.5167 0.133596 1.62704 0.209778 1.71929 0.305288L6.66929 5.25529L11.6193 0.305288C11.8079 0.12313 12.0605 0.0223355 12.3227 0.0246139C12.5849 0.0268924 12.8357 0.132061 13.0211 0.317469C13.2065 0.502877 13.3117 0.75369 13.314 1.01589C13.3162 1.27808 13.2154 1.53069 13.0333 1.71929L7.37629 7.37629Z"
      fill="currentColor"
    />
  </svg>
);

// streamline:shopping-cart-2-solid
const CartIcon = () => (
  <svg className="h-6 w-6 text-[#2E3192] sm:h-[37px] sm:w-[37px]" fill="none" viewBox="0 0 37 37">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.98214 3.96429H5.67157L6.67321 7.77L6.69964 7.85986L9.25793 20.6645L9.28964 20.8706L10.3996 26.4206V26.4286C10.552 27.1748 10.9574 27.8454 11.5474 28.327C12.1373 28.8086 12.8756 29.0716 13.6371 29.0714H29.7321C30.2578 29.0714 30.762 28.8626 31.1337 28.4909C31.5055 28.1191 31.7143 27.615 31.7143 27.0893C31.7143 26.5636 31.5055 26.0594 31.1337 25.6877C30.762 25.316 30.2578 25.1071 29.7321 25.1071H14.1789L13.5182 21.8036H32.0076C32.1001 21.8036 32.3644 21.8115 32.6076 21.7719C33.0435 21.6981 33.4542 21.5173 33.803 21.2456C34.1517 20.9739 34.4275 20.6198 34.6056 20.2152C34.7483 19.8875 34.8196 19.4726 34.8434 19.3351L34.8514 19.2981L36.9419 9.09143L36.9471 9.065C37.0167 8.68477 37.002 8.29391 36.9042 7.91997C36.8063 7.54602 36.6275 7.19811 36.3806 6.90074C36.1336 6.60338 35.8244 6.36381 35.4748 6.19892C35.1252 6.03404 34.7437 5.94785 34.3571 5.94643H10.2886L9.40857 2.57679C9.24354 1.84502 8.83437 1.1912 8.24837 0.722884C7.66237 0.254564 6.93443 -0.000374735 6.18429 4.13439e-07H1.98214C1.45645 4.13439e-07 0.95228 0.208833 0.580556 0.580557C0.208832 0.95228 0 1.45645 0 1.98214C0 2.50784 0.208832 3.01201 0.580556 3.38373C0.95228 3.75545 1.45645 3.96429 1.98214 3.96429ZM30.7364 33.8286C30.7364 33.0232 30.4165 32.2508 29.847 31.6813C29.2775 31.1119 28.5052 30.7919 27.6998 30.7919C26.8944 30.7919 26.122 31.1119 25.5526 31.6813C24.9831 32.2508 24.6631 33.0232 24.6631 33.8286C24.6864 34.6181 25.0164 35.3675 25.5831 35.9177C26.1498 36.4679 26.9086 36.7756 27.6985 36.7756C28.4883 36.7756 29.2471 36.4679 29.8138 35.9177C30.3805 35.3675 30.7105 34.6181 30.7338 33.8286H30.7364ZM14.4829 30.7946C14.889 30.7826 15.2934 30.8522 15.6721 30.9994C16.0509 31.1465 16.3962 31.3682 16.6878 31.6512C16.9793 31.9343 17.211 32.2729 17.3693 32.6472C17.5275 33.0214 17.6091 33.4236 17.6091 33.8299C17.6091 34.2362 17.5275 34.6384 17.3693 35.0126C17.211 35.3869 16.9793 35.7255 16.6878 36.0086C16.3962 36.2916 16.0509 36.5133 15.6721 36.6604C15.2934 36.8076 14.889 36.8772 14.4829 36.8652C13.6933 36.8419 12.944 36.5119 12.3938 35.9452C11.8435 35.3785 11.5358 34.6197 11.5358 33.8299C11.5358 33.04 11.8435 32.2813 12.3938 31.7146C12.944 31.1479 13.6933 30.8179 14.4829 30.7946Z"
      fill="currentColor"
    />
  </svg>
);

const UserIcon = () => (
  <svg className="h-6 w-6 text-[#2E3192] sm:h-[38px] sm:w-[38px]" fill="none" viewBox="0 0 38 38">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18.75 2.06013e-10C21.2123 -1.15418e-05 23.6504 0.484962 25.9253 1.42723C28.2002 2.3695 30.2672 3.75061 32.0083 5.49171C33.7494 7.23281 35.1305 9.29979 36.0728 11.5746C37.015 13.8495 37.5 16.2877 37.5 18.75C37.5 29.1053 29.1053 37.5 18.75 37.5C8.3947 37.5 0 29.1053 0 18.75C0 8.3947 8.3947 2.06013e-10 18.75 2.06013e-10ZM20.625 20.625H16.875C12.2331 20.625 8.24783 23.4364 6.52896 27.4496C9.24864 31.2632 13.7089 33.75 18.75 33.75C23.791 33.75 28.2513 31.2632 30.9711 27.4493C29.2522 23.4364 25.267 20.625 20.625 20.625ZM18.75 5.625C15.6434 5.625 13.125 8.14342 13.125 11.25C13.125 14.3566 15.6434 16.875 18.75 16.875C21.8566 16.875 24.375 14.3566 24.375 11.25C24.375 8.14342 21.8566 5.625 18.75 5.625Z"
      fill="currentColor"
    />
  </svg>
);

const MenuIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SearchNavIcon = () => (
  <svg
    className="text-brand-blue h-6 w-6 sm:h-7 sm:w-7"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef(null);
  const { cartCount } = useCart();
  const pathname = usePathname();
  const router = useRouter();

  const [isCatOpen, setIsCatOpen] = useState(false);
  const catRef = useRef(null);

  // Close category dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (catRef.current && !catRef.current.contains(e.target)) {
        setIsCatOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop', hasDropdown: true },
    { name: 'Eye Care', path: '/eye-care' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  const isHomePage = pathname === '/';
  const isCompactNav = pathname === '/about' || pathname === '/eye-care';

  // Figma: "hero page" frame fill is #FFFFFF80 (50% white) over the hero photo;
  // "other pages" frame has no fill override, i.e. opaque white.
  const navbarBackground = isHomePage ? 'rgba(255, 255, 255, 0.5)' : '#FFFFFF';

  function openSearch() {
    setIsSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  function closeSearch() {
    setIsSearchOpen(false);
    setSearchValue('');
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    const trimmed = searchValue.trim();
    if (!trimmed) return;
    closeSearch();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <nav
      className={`relative z-30 py-2 transition-all duration-500 ease-in-out sm:py-3 lg:py-[3px] ${isCompactNav ? 'shadow-sm lg:h-[51px]' : 'lg:h-[99px]'}`}
      style={{ backgroundColor: navbarBackground }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1440px] items-center gap-4 px-4 sm:px-10 lg:justify-between lg:gap-0 lg:px-[100px]">
        <div className="flex h-full flex-shrink-0 items-center">
          <Link href="/" className="flex h-full items-center">
            <Image
              src="/images/Logo.png"
              alt="Optex"
              width={448}
              height={372}
              priority
              className="h-full w-auto object-contain transition-all duration-500 ease-in-out"
              style={{ maxHeight: isCompactNav ? '39px' : '99px' }}
            />
          </Link>
        </div>

        <div className="hidden items-center gap-[44px] lg:flex">
          {navLinks.map((link) => {
            if (link.name === 'Shop') {
              const isShopActive = pathname === '/shop' || pathname.startsWith('/category');
              return (
                <div
                  key="Shop"
                  ref={catRef}
                  className="relative flex items-center"
                  onMouseEnter={() => setIsCatOpen(true)}
                  onMouseLeave={() => setIsCatOpen(false)}
                >
                  <Link
                    href="/shop"
                    onClick={() => setIsCatOpen(false)}
                    className={`nav-link flex items-center gap-[10px] ${isShopActive ? 'nav-link-active' : ''}`}
                  >
                    Shop
                    <ChevronDown />
                  </Link>
                  {isCatOpen && (
                    <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3">
                      <div className="w-52 rounded-[18px] border border-gray-100 bg-white py-2 shadow-2xl">
                        {CATEGORIES.map((cat) => (
                          <Link
                            key={cat.slug}
                            href={`/category/${cat.slug}`}
                            onClick={() => setIsCatOpen(false)}
                            className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold transition-colors hover:bg-[#2A3182]/5 hover:text-[#2A3182] ${pathname === `/category/${cat.slug}` ? 'text-[#2A3182]' : 'text-gray-700'}`}
                          >
                            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E53935]"></span>
                            {cat.name}
                          </Link>
                        ))}
                        <div className="mx-4 my-2 border-t border-gray-100"></div>
                        <Link
                          href="/shop"
                          onClick={() => setIsCatOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-[#2A3182] transition-colors hover:bg-[#2A3182]/5"
                        >
                          View All Products →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={link.name}
                href={link.path}
                className={`nav-link flex items-center gap-[10px] ${pathname === link.path ? 'nav-link-active' : ''}`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-[20px] lg:ml-0">
          <button
            aria-label="Search"
            onClick={openSearch}
            className="p-1 transition-opacity hover:opacity-80 sm:hidden"
          >
            <SearchNavIcon />
          </button>
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative p-1 transition-opacity hover:opacity-80 sm:p-0"
          >
            <CartIcon />
            {cartCount > 0 && (
              <span className="absolute right-0 top-0 inline-flex h-4 w-4 -translate-y-1 translate-x-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white sm:h-5 sm:w-5 sm:text-[11px]">
                {cartCount}
              </span>
            )}
          </Link>
          <Link
            href="/profile"
            aria-label="Profile"
            className="p-1 transition-opacity hover:opacity-80 sm:p-0"
          >
            <UserIcon />
          </Link>
          <Link href="/login" className="btn-appointment hidden sm:block">
            Book Appointment
          </Link>
          <button
            className="text-brand-blue p-2 lg:hidden"
            aria-label="Toggle menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="absolute left-0 top-full z-50 flex max-h-[80vh] w-full flex-col gap-4 overflow-y-auto border-t border-gray-100 bg-white px-6 py-4 shadow-xl lg:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.path}
              className={`nav-link flex items-center justify-between border-b border-gray-50 py-2 text-[16px] font-bold ${pathname === link.path ? 'nav-link-active' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.name}
              {link.hasDropdown && <ChevronDown />}
            </Link>
          ))}

          {/* Mobile categories */}
          <div className="border-b border-gray-50 pb-3">
            <p className="mb-2 text-[12px] font-black uppercase tracking-widest text-gray-400">
              Categories
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`rounded-full border px-3 py-2 text-center text-[12px] font-bold transition-colors ${pathname === `/category/${cat.slug}` ? 'border-[#2A3182] bg-[#2A3182]/5 text-[#2A3182]' : 'border-gray-200 text-gray-600 hover:border-[#2A3182] hover:text-[#2A3182]'}`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/login"
            className="btn-appointment mt-2 w-full text-center"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Book Appointment
          </Link>
        </div>
      )}

      {/* Search overlay dropdown */}
      {isSearchOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeSearch} />
          {/* Search bar panel */}
          <div className="absolute left-0 top-full z-50 w-full border-t border-gray-100 bg-white px-6 py-5 shadow-2xl">
            <div className="site-container mx-auto flex max-w-3xl items-start gap-3">
              <SearchAutocomplete
                value={searchValue}
                onChange={setSearchValue}
                onNavigate={closeSearch}
                inputRef={searchInputRef}
              />
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="flex-shrink-0 rounded-xl bg-[#2A3182] px-6 py-3 text-[13px] font-bold text-white transition-colors hover:bg-[#1e2461]"
              >
                Search
              </button>
              <button
                type="button"
                onClick={closeSearch}
                className="flex-shrink-0 p-3 text-gray-400 transition-colors hover:text-gray-600"
                aria-label="Close search"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
