import { ProductGridSkeleton, SearchHeroSkeleton, Skeleton } from '@/components/ui/Skeleton';

/**
 * Streaming fallback for /search (audit F-10).
 *
 * The search route's header is a solid brand-blue band, not the light hero the
 * shop uses — a shared skeleton made the page flash from blue to white and back
 * as results arrived.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-16 sm:pb-24">
      <SearchHeroSkeleton />

      <div className="site-container pt-10">
        <Skeleton className="mb-6 h-5 w-52" />
        <ProductGridSkeleton count={8} cols={4} label="Loading search results" />
      </div>
    </div>
  );
}
