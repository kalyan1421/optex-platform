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
    <div className="relative min-h-screen flex flex-col bg-white">
      {!hideNavFooter && <Header />}
      <main className={`flex-1 flex flex-col w-full ${isHomePage ? 'overflow-x-hidden' : 'pt-[139px]'}`}>
        {children}
      </main>
      {!hideNavFooter && <Footer />}
    </div>
  );
}
