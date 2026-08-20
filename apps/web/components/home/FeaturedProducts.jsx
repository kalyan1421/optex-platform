import Link from 'next/link';
import { publicApi } from '@/lib/api-server';
import FeaturedProductsGrid from '@/components/home/FeaturedProductsGrid';

/**
 * Featured Products home section — Server Component (SPEC-03 R2, Sprint 6).
 *
 * Products now fetch server-side; only the wishlist toggle and Add to Cart
 * grid need a browser, split into `FeaturedProductsGrid`.
 */
export default async function FeaturedProducts() {
  const api = publicApi({ revalidate: 60, tags: ['catalogue'] });
  const { items: products } = await api.catalog.listProducts({ limit: 8 }).catch((err) => {
    console.error('[home] FeaturedProducts fetch failed:', err);
    return { items: [] };
  });

  return (
    <section className="flex w-full flex-col items-center bg-[#FFFFFF] px-6 lg:px-[100px] lg:pb-[80px] lg:pt-[80px]">
      <div className="flex flex-col lg:w-[1240px] lg:gap-[51px]">
        {/* Header Row */}
        <div
          data-aos="fade-up"
          className="flex flex-col justify-between lg:h-[92px] lg:w-[1240px] lg:flex-row lg:items-end"
        >
          <div className="flex flex-col lg:h-[92px] lg:w-[426.5px] lg:gap-[8px]">
            <h2
              className="capitalize text-[#000000]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: 'clamp(26px, 5vw, 40px)',
                lineHeight: 1.5,
                letterSpacing: '-0.4px',
              }}
            >
              Featured Products
            </h2>
            <p
              className="text-[#717182] lg:whitespace-nowrap"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '24px',
              }}
            >
              Discover our handpicked collection of premium eyewear.
            </p>
          </div>
          <div className="mt-4 flex justify-start lg:mt-0 lg:justify-end lg:pb-[4px]">
            <Link
              href="/shop"
              className="flex items-center transition-opacity hover:opacity-80 lg:h-[24px] lg:w-[96.95px]"
            >
              <span
                className="text-center capitalize text-[#2E3192] underline"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  lineHeight: '24px',
                  letterSpacing: '-0.16px',
                }}
              >
                See More
              </span>
              <div className="flex items-center justify-center text-[#2E3192] lg:h-[24px] lg:w-[24px]">
                <svg
                  width="6"
                  height="12"
                  viewBox="0 0 6 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-1"
                >
                  <polyline points="1 11 5 6 1 1"></polyline>
                </svg>
              </div>
            </Link>
          </div>
        </div>

        <FeaturedProductsGrid products={products} />
      </div>
    </section>
  );
}
