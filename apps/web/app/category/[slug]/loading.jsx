import { CategoryHeroSkeleton, ProductGridSkeleton, Skeleton } from '@/components/ui/Skeleton';

/**
 * Streaming fallback for /category/[slug] (audit F-10).
 *
 * Reserves the full-bleed dark image hero and the breadcrumb rule above the
 * 4-up grid, so nothing below the fold moves when the category resolves.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <CategoryHeroSkeleton />

      <div className="page-container">
        <div className="flex items-center border-b border-gray-100 py-5">
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="py-8">
          <ProductGridSkeleton count={8} cols={4} />
        </div>
      </div>
    </div>
  );
}
