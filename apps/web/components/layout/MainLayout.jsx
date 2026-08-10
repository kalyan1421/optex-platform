'use client'

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const isCompactNav = pathname === '/about' || pathname === '/eye-care';
  const isSpecialPage = ['/cart', '/profile', '/product'].some(p => pathname === p || pathname.startsWith('/product/'));
  const hideNavFooter = ['/login', '/signup'].includes(pathname);

  return (
    <div className="relative min-h-screen flex flex-col bg-white">
      {!hideNavFooter && <Header />}
      <main className={`flex-1 flex flex-col w-full transition-all duration-500 ease-in-out ${isHomePage ? 'overflow-x-hidden' : (isCompactNav ? 'pt-[87px]' : 'pt-[135px]')}`}>
        {children}
      </main>
      {!hideNavFooter && <Footer />}
    </div>
  );
}
