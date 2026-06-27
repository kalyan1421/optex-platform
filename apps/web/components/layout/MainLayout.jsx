'use client'

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const isSpecialPage = ['/cart', '/profile', '/product'].some(p => pathname === p || pathname.startsWith('/product/'));
  const hideNavFooter = ['/login', '/signup'].includes(pathname);

  return (
    <div className="relative min-h-screen bg-white">
      {!hideNavFooter && <Header />}
      <main
        className={`
          ${!isHomePage && !hideNavFooter ? (isSpecialPage ? 'pt-[118px]' : 'pt-[100px]') : ''}
          ${!isHomePage && !hideNavFooter ? 'sm:pt-[120px]' : ''}
          ${isHomePage ? 'overflow-x-hidden' : ''}
        `}
      >
        {children}
      </main>
      {!hideNavFooter && <Footer />}
    </div>
  );
}
