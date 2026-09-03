'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { api } from '@/lib/api';
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

// One consistent outlined icon language for the whole action cluster —
// stroke-2, 24x24 viewBox — replacing the previous mix of thin-stroke
// (search/bell) and bold filled custom paths (cart/profile) at wildly
// different sizes.
const CartIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l2.775 10.405a1.125 1.125 0 001.11.91h9.593a1.125 1.125 0 001.11-.91l1.313-6.545a1.125 1.125 0 00-1.11-1.34H5.85" />
    <circle cx="6.75" cy="20.25" r="1.125" fill="currentColor" stroke="none" />
    <circle cx="17.25" cy="20.25" r="1.125" fill="currentColor" stroke="none" />
  </svg>
);

const UserIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0A9 9 0 106.018 18.725m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275" />
    <circle cx="12" cy="9.75" r="3" />
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
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const BellIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef(null);
  const { cartCount } = useCart();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    function loadUnreadCount() {
      api.notifications
        .unreadCount()
        .then((res) => setUnreadCount(res.count))
        .catch((err) => console.error('Unread notifications count error:', err));
    }
    loadUnreadCount();
    window.addEventListener('focus', loadUnreadCount);
    return () => window.removeEventListener('focus', loadUnreadCount);
    // Re-checks on route change too — e.g. after visiting /notifications and
    // marking things read, the badge should drop as soon as they navigate away.
  }, [user, pathname]);

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
      className="relative z-30 py-2 transition-all duration-500 ease-in-out sm:py-2.5 lg:h-[72px] lg:py-2"
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
              style={{ maxHeight: '72px' }}
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

        <div className="ml-auto flex items-center gap-2 sm:gap-3 lg:ml-0">
          {/* One grouped pill for the utility icons — a single consistent
              outline icon language (was a mix of thin-stroke search/bell and
              bold custom-path cart/profile at three different sizes), each
              getting its own "lifted" hover segment against the shared tint
              so the group reads as one control instead of four loose icons. */}
          <div className="flex items-center gap-0.5 rounded-full bg-[#2A3182]/[0.06] p-1">
            <button
              aria-label="Search"
              onClick={openSearch}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#2A3182] transition-colors hover:bg-white hover:shadow-sm"
            >
              <SearchNavIcon />
            </button>
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#2A3182] transition-colors hover:bg-white hover:shadow-sm"
            >
              <CartIcon />
              {cartCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E53935] px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>
            {user && (
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#2A3182] transition-colors hover:bg-white hover:shadow-sm"
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E53935] px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <Link
              href="/profile"
              aria-label="Profile"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#2A3182] transition-colors hover:bg-white hover:shadow-sm"
            >
              <UserIcon />
            </Link>
          </div>
          <Link href="/appointments" className="btn-appointment hidden sm:block">
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
            href="/appointments"
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
          <button
            type="button"
            aria-label="Close search"
            className="fixed inset-0 z-40 cursor-default bg-black/30 backdrop-blur-sm"
            onClick={closeSearch}
          />
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
