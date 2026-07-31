'use client';

import { useEffect } from 'react';
import AOS from 'aos';

export default function AosInit() {
  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-quad',
      offset: 50,
      disableMutationObserver: false,
      anchorPlacement: 'top-bottom',
    });
  }, []);

  return null;
}
