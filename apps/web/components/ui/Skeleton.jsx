/**
 * Loading placeholders for the Server Component routes (audit F-10).
 *
 * These shapes deliberately mirror the real layouts they stand in for. A
 * skeleton whose proportions do not match causes exactly the layout shift it
 * was meant to prevent — which is what the first version did: /shop, /search
 * and /category all rendered one generic 4-column grid in a `max-w-[1280px]`
 * wrapper, while the real pages are a 3-column grid beside a filter sidebar
 * under a tinted hero, a dark-blue search header, and a 4-column grid under a
 * full-bleed image hero respectively. Each route now gets its own shell.
 *
 * `aria-hidden` throughout: a screen reader should hear the route's real
 * content when it arrives, not a description of grey boxes. The announcement is
 * handled once, by the wrapper's `aria-busy`.
 */

/** One grey block. `className` sets its size. */
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

/**
 * A product card placeholder matching the real catalogue card: a square image
 * panel on a `#F5F5F5` ground, then brand / title / price / description lines,
 * inside the same `rounded-[32px]` hairline border.
 */
export function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex w-full flex-col overflow-hidden rounded-[32px] border-[0.8px] border-[#D4D4D4] bg-white"
    >
      <Skeleton className="aspect-square w-full rounded-none bg-gray-100" />
      <div className="flex flex-col gap-2 px-5 py-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-6 w-28" />
      </div>
    </div>
  );
}

/**
 * A grid of card placeholders. `cols` takes the real grid's lg column count so
 * each route's fallback reserves the same track width its content will use.
 */
export function ProductGridSkeleton({ count = 6, cols = 3, label = 'Loading products' }) {
  const lg = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }[cols] ?? 'lg:grid-cols-3';
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${lg} lg:gap-[24px]`}
    >
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** The /shop filter rail: a stack of collapsible facet groups. */
export function FilterSidebarSkeleton({ groups = 5 }) {
  return (
    <aside aria-hidden="true" className="hidden shrink-0 flex-col gap-8 lg:flex lg:w-[250px]">
      {Array.from({ length: groups }, (_, g) => (
        <div key={g} className="flex flex-col gap-3">
          <div className="border-b-[0.8px] border-[#0000001A] pb-2">
            <Skeleton className="h-5 w-32" />
          </div>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-[4px]" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}

/** Page heading placeholder — title plus a line of supporting text. */
export function PageHeaderSkeleton() {
  return (
    <div aria-hidden="true" className="mb-8 flex flex-col gap-3">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}

/**
 * The /shop banner: a light tinted band with a centred title and subtitle,
 * matching the real section's `lg:h-[314px]`.
 */
export function ShopHeroSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="flex w-full flex-col items-center justify-center bg-[#F4F4F6] px-6 py-12 sm:py-16 lg:h-[314px] lg:py-0"
    >
      <Skeleton className="h-[56px] w-[320px] max-w-full bg-gray-300" />
      <Skeleton className="mt-4 h-4 w-[560px] max-w-full" />
      <Skeleton className="mt-2 h-4 w-[420px] max-w-full" />
    </section>
  );
}

/** The /category banner: a full-bleed dark image hero with eyebrow + title. */
export function CategoryHeroSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="flex h-[300px] flex-col items-center justify-center bg-[#1A1A2E] px-4 sm:h-[340px] lg:h-[380px]"
    >
      <Skeleton className="h-3 w-24 bg-white/20" />
      <Skeleton className="mt-4 h-[48px] w-[380px] max-w-full bg-white/25" />
      <Skeleton className="mt-4 h-4 w-[220px] bg-white/15" />
    </section>
  );
}

/** The /search banner: the solid brand-blue band with eyebrow + query line. */
export function SearchHeroSkeleton() {
  return (
    <section aria-hidden="true" className="bg-[#2A3182] py-12 sm:py-16">
      <div className="site-container">
        <Skeleton className="h-3 w-28 bg-white/20" />
        <Skeleton className="mt-4 h-[42px] w-[460px] max-w-full bg-white/25" />
      </div>
    </section>
  );
}
