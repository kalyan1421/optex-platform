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
  <svg
    className="ml-1 h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const CartIcon = () => (
  <svg
    className="text-brand-blue h-6 w-6 sm:h-8 sm:w-8"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);

const UserIcon = () => (
  <svg className="text-brand-blue h-6 w-6 sm:h-8 sm:w-8" fill="currentColor" viewBox="0 0 24 24">
    <path
      fillRule="evenodd"
      d="M18 10a6 6 0 11-12 0 6 6 0 0112 0zm-6 8c2.67 0 8 1.34 8 4v2H4v-2c0-2.66 5.33-4 8-4z"
      clipRule="evenodd"
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef(null);
  const { cartCount } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === '/';

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
    { name: 'Contact', path: '/contact' },
  ];

  useEffect(() => {
    if (!isHomePage) {
      setIsScrolled(true);
      return undefined;
    }
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHomePage]);

  const navbarBackground = isHomePage ? (isScrolled ? '#ffffff' : '#ffffff7d') : '#ffffff';

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
      className="relative z-30 py-2 shadow-sm transition-colors duration-300 sm:py-3"
      style={{ backgroundColor: navbarBackground }}
    >
      <div className="site-container flex items-center gap-6">
        <div className="flex-shrink-0">
          <Link href="/">
            <Image
              src="/images/Logo.png"
              alt="Optex"
              width={120}
              height={60}
              className="h-[40px] w-auto object-contain sm:h-[60px]"
            />
          </Link>
        </div>

        <div className="ml-auto hidden items-center gap-10 lg:flex xl:gap-12">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.path}
              className={`nav-link flex items-center ${pathname === link.path ? 'nav-link-active' : ''}`}
            >
              {link.name}
              {link.hasDropdown && <ChevronDown />}
            </Link>
          ))}

          {/* Categories dropdown */}
          <div ref={catRef} className="relative">
            <button
              onClick={() => setIsCatOpen((v) => !v)}
              className={`nav-link flex items-center gap-0.5 ${pathname.startsWith('/category') ? 'nav-link-active' : ''}`}
            >
              Categories
              <ChevronDown />
            </button>
            {isCatOpen && (
              <div className="absolute left-1/2 top-full z-50 mt-3 w-52 -translate-x-1/2 rounded-[18px] border border-gray-100 bg-white py-2 shadow-2xl">
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
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-6 lg:ml-0">
          <div className="flex items-center gap-1 sm:gap-4">
            <button
              aria-label="Search"
              onClick={openSearch}
              className="p-1 transition-opacity hover:opacity-80 sm:p-2"
            >
              <SearchNavIcon />
            </button>
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative p-1 transition-opacity hover:opacity-80 sm:p-2"
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
              className="p-1 transition-opacity hover:opacity-80 sm:p-2"
            >
              <UserIcon />
            </Link>
          </div>
          <Link href="/login" className="btn-appointment hidden sm:block">
            Book Appointment
          </Link>
          <button
            className="text-brand-blue p-2 lg:hidden"
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
            <div className="site-container mx-auto flex max-w-3xl items-center gap-3">
              {/* Debounced full-text autocomplete with keyboard navigation.
                  Replaces a submit-only input that offered no suggestions. */}
              <SearchAutocomplete
                autoFocus
                className="flex-1"
                placeholder="Search frames, sunglasses, brands…"
                onNavigate={closeSearch}
              />
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
