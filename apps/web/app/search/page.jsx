import Link from 'next/link';
import { publicApi } from '@/lib/api-server';
import SearchBox from '@/components/search/SearchBox';
import SearchResults from '@/components/search/SearchResults';

// ── Icons ──────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const GridIcon = () => (
  <svg
    className="h-5 w-5 text-[#2A3182]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
    />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

/**
 * /search — Server Component (SPEC-03 R2, Sprint 6).
 *
 * Was a `'use client'` page (wrapped in `<Suspense>` for `useSearchParams`)
 * that fetched results from the browser after mount. `?q=` is a URL search
 * param, which the App Router hands a Server Component directly via the
 * `searchParams` prop — no client hook, no Suspense boundary needed, and the
 * results are in the initial HTML for whatever the query was at request
 * time. `SearchBox` (the input/submit/clear) and `SearchResults` (facets,
 * sort, add-to-cart) are the only parts that still need a browser.
 */

export function generateMetadata({ searchParams }) {
  const q = searchParams?.q ?? '';
  return {
    title: q ? `Search: "${q}" | Optex Opticians` : 'Search Products | Optex Opticians',
  };
}

async function loadResults(q) {
  if (!q.trim()) return [];
  const api = publicApi({ revalidate: 60, tags: ['catalogue'] });
  try {
    const { items } = await api.catalog.searchProducts({ q: q.trim(), limit: 40 });
    return items;
  } catch (err) {
    console.error('[search] search fetch failed:', err);
    return [];
  }
}

export default async function SearchPage({ searchParams }) {
  const q = searchParams?.q ?? '';
  const hasQuery = q.trim().length > 0;
  const products = await loadResults(q);

  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-16 sm:pb-24">
      {/* Hero search banner */}
      <section className="bg-[#2A3182] py-12 sm:py-16">
        <div className="site-container">
          <div className="mb-4 flex items-center gap-3">
            <GridIcon />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
              Product Search
            </span>
          </div>
          <h1 className="mb-8 text-[32px] font-black leading-tight text-white sm:text-[42px]">
            {hasQuery ? (
              <>
                Find: <span className="text-[#E53935]">&quot;{q}&quot;</span>
              </>
            ) : (
              'Search Products'
            )}
          </h1>

          <SearchBox initialQuery={q} />
        </div>
      </section>

      {/* Results area */}
      <div className="site-container pt-10">
        {!hasQuery && (
          <div className="py-20 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-300 shadow-sm">
              <SearchIcon />
            </div>
            <h2 className="mb-3 text-[22px] font-black text-[#1a1a1a]">
              What are you looking for?
            </h2>
            <p className="mx-auto mb-8 max-w-sm text-[14px] font-medium text-gray-400">
              Type in the search box above to find frames, sunglasses, or brands from our
              collection.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-[#2A3182] px-6 py-3 text-[13px] font-bold text-white shadow-md shadow-[#2A3182]/20 transition-colors hover:bg-[#1e2461]"
            >
              Browse All Products
              <ArrowRightIcon />
            </Link>
          </div>
        )}

        {hasQuery && <SearchResults products={products} query={q} />}
      </div>
    </div>
  );
}
