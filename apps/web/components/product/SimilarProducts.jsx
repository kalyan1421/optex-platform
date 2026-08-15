'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { formatKesNumber } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

/**
 * The "Similar Products" carousel. A client island only because each card's
 * Add to Cart button mutates the cart — the cards and links themselves need
 * no browser and could be server-rendered, but splitting one button out of a
 * repeated card is more indirection than the win is worth.
 */
export default function SimilarProducts({ products }) {
  const { addToCart } = useCart();

  if (products.length === 0) return null;

  return (
    <div className="hide-scrollbar flex w-full snap-x snap-mandatory gap-[26.6px] overflow-x-auto pb-[20px]">
      {products.map((p) => (
        <div
          key={p.id}
          className="relative h-[480px] w-[290px] flex-shrink-0 snap-start rounded-[32px] border-[0.8px] border-[#D4D4D4] bg-white"
        >
          <Link href={`/product/${p.slug}`}>
            <div className="relative mx-[0.8px] mt-[0.8px] h-[288.4px] w-[288.4px] overflow-hidden rounded-t-[32px] bg-[#F5F5F5]">
              <img
                src={getProductImageUrl(p)}
                alt={p.name}
                className="h-full w-full object-cover mix-blend-multiply"
              />
              <div className="absolute right-[16px] top-[16px] flex h-[26px] items-center justify-center rounded-[26843500px] bg-[#FFFFFFE5] px-[12px]">
                <span
                  className="capitalize text-[#2E3192]"
                  style={{
                    fontFamily: 'Arimo, sans-serif',
                    fontSize: '12px',
                    lineHeight: '18px',
                    fontWeight: 400,
                  }}
                >
                  {p.frame_shape || 'Eyewear'}
                </span>
              </div>
            </div>
          </Link>
          <div className="mt-[24.8px] px-[24.8px]">
            <div className="mb-[8px] flex h-[27px] items-center justify-between">
              <Link href={`/product/${p.slug}`}>
                <h3
                  className="max-w-[135px] truncate text-[#000000]"
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: '18px',
                    lineHeight: '27px',
                    fontWeight: 600,
                    letterSpacing: '-0.2px',
                  }}
                >
                  {p.name}
                </h3>
              </Link>
              <span
                className="uppercase text-[#2E3192]"
                style={{
                  fontFamily: 'Arimo, sans-serif',
                  fontSize: '14px',
                  lineHeight: '21px',
                  fontWeight: 400,
                }}
              >
                {p.brand}
              </span>
            </div>
            <p
              className="line-clamp-2 h-[42px] text-[#717182]"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                lineHeight: '21px',
                fontWeight: 400,
              }}
            >
              {p.description ||
                `Premium quality ${p.frame_shape?.toLowerCase() || 'eyewear'} designed for maximum comfort and style.`}
            </p>
            <div className="mt-[24px] flex h-[41px] items-center justify-between">
              <p className="flex items-baseline gap-[4px] text-[#2E3192]">
                <span
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: '12px',
                    lineHeight: '33px',
                    fontWeight: 700,
                  }}
                >
                  KSH.
                </span>
                <span
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: '22px',
                    lineHeight: '33px',
                    fontWeight: 700,
                  }}
                >
                  {formatKesNumber(p.price_kes)}
                </span>
              </p>
              <button
                onClick={() =>
                  addToCart({
                    id: p.id,
                    title: p.name,
                    price: String(p.price_kes),
                    image: getProductImageUrl(p),
                    quantity: 1,
                    brand: p.brand,
                  })
                }
                className="flex h-[41px] w-[121.375px] items-center justify-center rounded-[24px] bg-[#E53935] text-white transition-colors hover:bg-red-700"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '14px',
                  lineHeight: '21px',
                  fontWeight: 600,
                }}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
