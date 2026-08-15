import React from 'react';
import Hero from '@/components/home/Hero';
import FeaturedCollection from '@/components/home/FeaturedCollection';
import Promotional from '@/components/home/Promotional';
import TrendingNow from '@/components/home/TrendingNow';
import WhyOptex from '@/components/home/WhyOptex';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import FaceShape from '@/components/home/FaceShape';
import VirtualTryOn from '@/components/home/VirtualTryOn';
import FinalCTA from '@/components/home/FinalCTA';

const Home = () => {
  return (
    <>
      <Hero />
      <FeaturedCollection />
      <TrendingNow />
      <FeaturedProducts />
      <VirtualTryOn />
      <FaceShape />
      <WhyOptex />
      <Promotional />
      <FinalCTA />
    </>
  );
};

export default Home;
