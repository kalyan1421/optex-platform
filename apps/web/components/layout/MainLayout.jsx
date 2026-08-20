'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const isCompactNav = pathname === '/about' || pathname === '/eye-care';
  const isSpecialPage = ['/cart', '/profile', '/product'].some(
    (p) => pathname === p || pathname.startsWith('/product/'),
  );
  const hideNavFooter = ['/login', '/signup'].includes(pathname);

  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      {/* F-16: skip link. The header carries a full nav plus a search box, so a
          keyboard or screen-reader user previously had to tab through the whole
          thing on every single page before reaching the content. Visually hidden
          until focused, which is the point — it appears for exactly the people
          who need it. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[#2A3182] focus:px-5 focus:py-3 focus:text-[14px] focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      {!hideNavFooter && <Header />}
      <main
        id="main-content"
        // -1 so the skip link can move focus here without adding the whole
        // region to the tab order.
        tabIndex={-1}
        className={`flex w-full flex-1 flex-col transition-all duration-500 ease-in-out ${hideNavFooter ? '' : isHomePage ? 'overflow-x-hidden' : isCompactNav ? 'pt-[103px] sm:pt-[107px] lg:pt-[87px]' : 'pt-[124px] sm:pt-[128px] lg:pt-[108px]'}`}
      >
        {children}
      </main>
      {!hideNavFooter && <Footer />}
    </div>
  );
}
