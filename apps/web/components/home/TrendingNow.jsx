import Image from 'next/image';
import Link from 'next/link';
import { publicApi } from '@/lib/api-server';
import { getProductImageUrl } from '@/lib/product-image';
import WishlistToggle from '@/components/wishlist/WishlistToggle';

const BADGES = ['BEST SELLER', 'TRENDING', 'NEW ARRIVAL', 'HOT'];

/**
 * Trending Now home section — Server Component (SPEC-03 R2, Sprint 6).
 *
 * No client wrapper needed here, unlike the other two home sections: there
 * is no Add to Cart button on this grid, and `WishlistToggle` is already its
 * own client component, so the whole section renders server-side directly.
 */
export default async function TrendingNow() {
  const api = publicApi({ revalidate: 60, tags: ['catalogue'] });
  const { items: products } = await api.catalog.listProducts({ limit: 4 }).catch((err) => {
    console.error('[home] TrendingNow fetch failed:', err);
    return { items: [] };
  });

  return (
    <section className="flex w-full flex-col items-center bg-[#FFFFFF] px-6 lg:px-[100px]">
      <div className="flex flex-col lg:w-[1240px] lg:gap-[60px]">
        {/* Header Row */}
        <div
          data-aos="fade-up"
          className="flex flex-col justify-between lg:h-[142px] lg:w-[1240px] lg:flex-row lg:items-end"
        >
          <div className="flex flex-col lg:h-[142px] lg:w-[600px] lg:gap-[16px]">
            <h2
              className="text-[#000000]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(28px, 6vw, 48px)',
                lineHeight: 1.5,
              }}
            >
              Trending Now
            </h2>
            <p
              className="text-[#717182]"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '18px',
                lineHeight: '27px',
              }}
            >
              Our most popular designs this season, curated for those who value both style and
              visual excellence.
            </p>
          </div>
          <div className="mt-4 flex justify-start lg:mt-0 lg:justify-end">
            <Link
              href="/shop"
              className="flex items-center justify-center transition-opacity hover:opacity-80 lg:h-[33px] lg:w-[157.58px]"
              style={{ borderBottom: '2px solid #2E3192' }}
            >
              <span
                className="text-[#2E3192]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  fontSize: '18px',
                  lineHeight: '27px',
                }}
              >
                View all products
              </span>
            </Link>
          </div>
        </div>

        {/* Product Grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:flex lg:h-[381.75px] lg:w-[1240px] lg:grid-cols-none lg:flex-nowrap lg:gap-0">
            {products.map((product, index) => (
              <div
                key={product.id}
                data-aos="fade-up"
                data-aos-delay={index * 100}
                className="group flex flex-col gap-3 lg:h-[381.75px] lg:w-[261.75px] lg:gap-[24px]"
              >
                {/* Image Block */}
                <div
                  className="relative aspect-square w-full overflow-hidden bg-[#F9F9F9] lg:h-[261.75px] lg:w-[261.75px]"
                  style={{ borderRadius: '32px' }}
                >
                  <div
                    className="absolute z-10 bg-[#E53935] px-[16px] py-[6px] lg:left-[16px] lg:top-[16px]"
                    style={{ borderRadius: '33554400px' }}
                  >
                    <span
                      className="uppercase text-[#FFFFFF]"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 700,
                        fontSize: '12px',
                        lineHeight: '18px',
                        letterSpacing: '0.6px',
                      }}
                    >
                      {BADGES[index % BADGES.length]}
                    </span>
                  </div>
                  <WishlistToggle
                    productId={product.id}
                    className="absolute right-[12px] top-[12px] z-10"
                  />
                  <Link href={`/product/${product.slug}`} className="relative block h-full w-full">
                    <Image
                      src={getProductImageUrl(product)}
                      alt={product.name}
                      fill
                      sizes="262px"
                      className="object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                      style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
                    />
                  </Link>
                </div>

                {/* Text Block */}
                <Link
                  href={`/product/${product.slug}`}
                  className="flex flex-col lg:h-[96px] lg:w-[261.75px]"
                >
                  <p
                    className="uppercase text-[#717182]"
                    style={{
                      fontFamily: 'Arimo, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px',
                      lineHeight: '21px',
                      letterSpacing: '1px',
                    }}
                  >
                    {product.brand || '—'}
                  </p>
                  <h3
                    className="truncate text-[#000000] lg:mt-[5px]"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '20px',
                      lineHeight: '30px',
                    }}
                  >
                    {product.name}
                  </h3>
                  <div className="flex items-baseline lg:mt-[8px]">
                    <span
                      className="text-[#2E3192]"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 700,
                        fontSize: '22px',
                        lineHeight: '33px',
                      }}
                    >
                      KSH.{' '}
                      {Number(product.price_kes).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          // Products are fetched server-side now, so an empty result here means
          // genuinely no products exist — not "still loading" (there is no
          // loading phase any more). An animate-pulse skeleton would render
          // permanently rather than resolving, which is worse than an honest
          // empty state.
          <div
            className="flex flex-col items-center justify-center bg-[#FFFFFF] lg:h-[381.75px] lg:w-[1240px]"
            style={{ borderRadius: '32px', border: '1px solid #D4D4D4' }}
          >
            <h3
              className="text-[#000000]"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '24px' }}
            >
              Check back soon for new styles
            </h3>
          </div>
        )}

        {/* Production Level Divider Line (from Design) */}
        <div className="mt-10 h-[1px] w-full bg-[#EAEAEA] lg:mt-[80px]" />
      </div>
    </section>
  );
}
