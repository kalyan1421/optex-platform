'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { resolveImageUrl } from '@/lib/product-image';

export default function ProductGallery({ product }) {
  const images = useMemo(() => {
    const values = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
    return values.length > 0 ? values : [null];
  }, [product?.images]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedImage = resolveImageUrl(images[selectedIndex]);

  return (
    <div className="flex flex-col gap-[16px] lg:w-[590px]">
      <div className="relative w-full overflow-hidden rounded-[40px] border-[0.8px] border-[#D4D4D4] bg-[#F5F5F5] p-[0.8px] lg:h-[459.6px]">
        <Image
          src={selectedImage}
          alt={product.name}
          fill
          priority
          sizes="(min-width: 1024px) 590px, 100vw"
          className="rounded-[40px] object-contain transition-transform duration-500 hover:scale-105"
        />
      </div>
      <div className="flex w-full snap-x snap-mandatory gap-[16px] overflow-x-auto">
        {images.map((image, index) => (
          <button
            type="button"
            key={`${image ?? 'fallback'}-${index}`}
            onClick={() => setSelectedIndex(index)}
            aria-label={`View product image ${index + 1}`}
            aria-pressed={selectedIndex === index}
            className={`relative h-[102.9px] w-[102.9px] flex-shrink-0 snap-center rounded-[16px] border-[0.8px] bg-[#F5F5F5] p-[0.8px] transition-opacity ${selectedIndex === index ? 'border-[#2E3192] opacity-100' : 'border-[#D4D4D4] opacity-60 hover:opacity-100'}`}
          >
            <Image
              src={resolveImageUrl(image)}
              alt={`${product.name} thumbnail ${index + 1}`}
              fill
              sizes="103px"
              className="rounded-[16px] object-contain"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
