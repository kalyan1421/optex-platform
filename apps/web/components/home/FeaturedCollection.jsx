import Link from 'next/link';
import { publicApi } from '@/lib/api-server';
import FeaturedCollectionTabs from '@/components/home/FeaturedCollectionTabs';

/**
 * Featured Collection home section — Server Component (SPEC-03 R2, Sprint 6).
 *
 * Products and categories now fetch server-side; only the tab-switching and
 * the grid it drives need a browser, split into `FeaturedCollectionTabs`.
 */
export default async function FeaturedCollection() {
  const api = publicApi({ revalidate: 60, tags: ['catalogue'] });
  const [{ items: products }, categories] = await Promise.all([
    api.catalog.listProducts({ limit: 100 }).catch((err) => {
      console.error('[home] FeaturedCollection products fetch failed:', err);
      return { items: [] };
    }),
    api.catalog.listCategories().catch((err) => {
      console.error('[home] FeaturedCollection categories fetch failed:', err);
      return [];
    }),
  ]);

  return (
    <section className="flex w-full flex-col items-center bg-[#FFFFFF] lg:px-[100px] lg:pb-[80px] lg:pt-[80px]">
      <div className="flex flex-col items-center lg:w-[1240px] lg:gap-[40px]">
        {/* Header Section */}
        <div
          data-aos="fade-up"
          className="flex w-full flex-row items-center justify-between lg:h-[60px] lg:w-[1240px]"
        >
          <h2
            className="capitalize text-[#000000]"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '40px',
              lineHeight: '60px',
              letterSpacing: '-0.4px',
            }}
          >
            Featured Collection
          </h2>
          <Link
            href="/shop"
            className="flex items-center gap-[4px] transition-opacity hover:opacity-80 lg:h-[24px] lg:w-[168.46px]"
          >
            <span
              className="whitespace-nowrap capitalize text-[#2E3192] underline decoration-solid"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                lineHeight: '24px',
              }}
            >
              View Full Catalog
            </span>
            <div className="flex h-[20px] w-[20px] items-center justify-center text-[#2E3192] lg:h-[20px] lg:w-[20px]">
              <svg
                className="h-full w-full"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.16699 10H15.8337"
                  stroke="currentColor"
                  strokeWidth="1.66667"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 4.16675L15.8333 10.0001L10 15.8334"
                  stroke="currentColor"
                  strokeWidth="1.66667"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </Link>
        </div>

        <FeaturedCollectionTabs products={products} categories={categories} />
      </div>
    </section>
  );
}
