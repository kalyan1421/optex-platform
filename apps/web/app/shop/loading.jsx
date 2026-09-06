import {
  FilterSidebarSkeleton,
  ProductGridSkeleton,
  ShopHeroSkeleton,
  Skeleton,
} from '@/components/ui/Skeleton';

/**
 * Streaming fallback for /shop (audit F-10).
 *
 * Mirrors the real route: tinted hero band, then the `max-w-[1240px]` two-column
 * body — the 250px filter rail beside the results column, whose header row
 * carries the result count and sort control above a 3-up card grid.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <ShopHeroSkeleton />

      <div className="mx-auto mb-12 w-full max-w-[1240px] px-6 lg:mb-[100px] lg:mt-[40px] lg:px-[16px]">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-[40px]">
          <FilterSidebarSkeleton />

          <section className="mt-10 flex flex-col lg:mt-0 lg:w-[918px] lg:gap-[24px]">
            <div className="mb-6 flex items-center justify-between lg:mb-0 lg:h-[36px]">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-9 w-44 rounded-full" />
            </div>
            <ProductGridSkeleton count={6} cols={3} />
          </section>
        </div>
      </div>
    </div>
  );
}
