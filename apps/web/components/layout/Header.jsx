'use client'

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import TopBar from './TopBar';
import Navbar from './Navbar';

export default function Header() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const headerBg = isHomePage 
    ? (scrolled ? 'bg-white shadow-sm' : 'bg-transparent')
    : 'bg-white shadow-sm';

  return (
    <header className={`fixed top-0 left-0 w-full z-50 flex flex-col transition-colors duration-300 ${headerBg}`}>
      <TopBar />
      <Navbar />
    </header>
  );
}
