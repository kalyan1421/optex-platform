import ShopBrowser from '@/components/shop/ShopBrowser';
import { publicApi } from '@/lib/api-server';

/**
 * /shop — Server Component (Wave 4).
 *
 * Was a `'use client'` page that shipped an empty grid and fetched the
 * catalogue from Supabase after hydration. A crawler saw no products, and a
 * visitor saw skeletons until the round-trip finished. Now the catalogue is
 * fetched on the server through the API and rendered into the initial HTML;
 * `ShopBrowser` takes over only the parts that need a browser.
 *
 * The read goes through `publicApi`, which sends no cookies — so Next caches
 * the response and this page is served from cache rather than re-fetched per
 * visitor. That caching is the actual deliverable of the render rewrite.
 */

export const metadata = {
  title: 'Shop Eyewear — Frames, Sunglasses & Lenses | Optex Opticians',
  description:
    'Browse premium eyewear at Optex Opticians Kenya. Prescription frames, sunglasses and contact lenses, with free delivery and 12 branches countrywide.',
  alternates: { canonical: '/shop' },
  openGraph: {
    title: 'Shop Eyewear | Optex Opticians',
    description:
      'Browse premium eyewear at Optex Opticians Kenya — prescription frames, sunglasses and contact lenses.',
    url: '/shop',
    type: 'website',
  },
};

/**
 * Fetch the catalogue and the category list together.
 *
 * `limit: 100` matches what the client page requested before, and is the
 * ceiling on this approach: faceting and counting still happen in the browser
 * over the whole set, because the counts beside each facet have to be computed
 * across all products, not just the current page. The API already accepts
 * category/brand/shape/gender/material/price/sort, so moving faceting to the
 * server is the natural follow-up once the real catalogue lands — tracked in
 * TASKS.md C3.
 */
async function loadCatalogue() {
  const api = publicApi({ revalidate: 60, tags: ['catalogue'] });
  try {
    const [products, categories] = await Promise.all([
      api.catalog.listProducts({ limit: 100 }),
      api.catalog.listCategories(),
    ]);
    return {
      products: products?.items ?? [],
      categories: [
        { name: 'All', id: null },
        ...(categories ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      ],
    };
  } catch (err) {
    // A catalogue outage should degrade to the empty state, not a 500 on the
    // storefront's most-linked page.
    console.error('[shop] catalogue fetch failed:', err);
    return { products: [], categories: [] };
  }
}

export default async function Page() {
  const { products, categories } = await loadCatalogue();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Banner Section — static, so it stays on the server. */}
      <section className="relative flex w-full flex-col items-center overflow-hidden lg:h-[314px] lg:px-[139.6px] lg:pt-[80px]">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/shop-banner-cropped.jpg)' }}
        />
        {/* Overlay (#F9F9F9 at 50% opacity) */}
        <div className="absolute inset-0 z-0 bg-[#F9F9F980]" />

        <div className="relative z-10 flex flex-col items-center lg:h-[154px] lg:w-[1160.8px]">
          <h1
            className="flex items-center justify-center whitespace-nowrap text-center text-[#000000] lg:mt-[2.4px] lg:h-[84px] lg:w-[410px]"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '56px',
              lineHeight: '84px',
            }}
          >
            Our Collection
          </h1>
          <p
            className="flex items-center justify-center text-center text-[#000000] lg:mt-[14px] lg:h-[54px] lg:w-[700px]"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '27px',
            }}
          >
            Browse through our extensive range of premium eyewear, from classic frames to modern
            sunglasses.
          </p>
        </div>
      </section>

      <ShopBrowser products={products} categories={categories} />
    </div>
  );
}
