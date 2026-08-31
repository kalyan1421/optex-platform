'use client';

import { useEffect } from 'react';
import AOS from 'aos';

export default function AosInit() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    AOS.init({
      duration: reducedMotion ? 0 : 800,
      once: true,
      easing: 'ease-out-quad',
      offset: 50,
      disableMutationObserver: false,
      anchorPlacement: 'top-bottom',
      disable: reducedMotion,
    });
  }, []);

  return null;
}
