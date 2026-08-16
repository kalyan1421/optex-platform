'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { getProductImageUrl } from '@/lib/product-image';
import WishlistToggle from '@/components/wishlist/WishlistToggle';

/**
 * The Add to Cart / wishlist half of the Featured Products grid. Split out
 * so the section header can stay server-rendered — `products` arrives as a
 * prop, already fetched on the server.
 */
export default function FeaturedProductsGrid({ products }) {
  const { addToCart } = useCart();

  return (
    <div className="flex flex-wrap justify-between gap-6 lg:grid lg:w-[1240px] lg:grid-cols-4 lg:gap-[24px]">
      {products.map((product, index) => (
        <div
          key={product.id}
          data-aos="fade-up"
          data-aos-delay={index * 50}
          className="group flex cursor-pointer flex-col items-center bg-[#FFFFFF] p-[1px] transition-transform duration-500 hover:-translate-y-1 lg:h-[378.2px] lg:w-[291px] lg:gap-[10px]"
          style={{
            borderRadius: '32px',
            border: '0.8px solid #D4D4D4',
            boxShadow: '0px 8px 24px 0px rgba(0,0,0,0.05)',
          }}
        >
          {/* Product Image */}
          <div className="relative w-full lg:h-[225.2px] lg:w-[289px]">
            <WishlistToggle
              productId={product.id}
              className="absolute left-[12px] top-[12px] z-10"
            />
            <Link
              href={`/product/${product.slug}`}
              className="relative block h-full w-full overflow-hidden bg-[#F5F5F5]"
              style={{ borderRadius: '31px 31px 0 0' }}
            >
              <Image
                src={getProductImageUrl(product)}
                alt={product.name}
                fill
                sizes="(min-width: 1024px) 289px, 45vw"
                className="object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
              />
            </Link>
          </div>

          {/* Product Info */}
          <div className="flex flex-col lg:h-[141px] lg:w-[289px] lg:gap-[10px] lg:px-[12px] lg:pb-[12px]">
            <div className="flex flex-col lg:h-[72px] lg:w-[265px]">
              <Link href={`/product/${product.slug}`}>
                <h3
                  className="truncate text-[#000000] transition-colors group-hover:text-[#2E3192] lg:h-[30px] lg:w-[265px]"
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '20px',
                    lineHeight: '30px',
                    letterSpacing: '-0.2px',
                  }}
                >
                  {product.name}
                </h3>
              </Link>
              <p
                className="line-clamp-2 text-[#717182] lg:h-[42px] lg:w-[265px]"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '21px',
                  letterSpacing: '-0.14px',
                }}
              >
                {product.description || 'Unisex style with UV protection'}
              </p>
            </div>

            <div className="flex items-center justify-between lg:h-[37px] lg:w-[265px]">
              <span
                className="whitespace-nowrap text-[#2E3192]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 700,
                  fontSize: '18px',
                  lineHeight: '27px',
                  letterSpacing: '-0.18px',
                }}
              >
                KSH.{' '}
                {Number(product.price_kes).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  addToCart({
                    id: product.id,
                    title: product.name,
                    price: String(product.price_kes),
                    image: getProductImageUrl(product),
                    quantity: 1,
                  });
                }}
                className="flex flex-shrink-0 items-center justify-center bg-[#E53935] transition-colors hover:bg-red-700 lg:h-[37px] lg:w-[127.5px]"
                style={{ borderRadius: '24px' }}
              >
                <span
                  className="text-center text-[#FFFFFF]"
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '14px',
                    lineHeight: '21px',
                  }}
                >
                  Shop Now
                </span>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
