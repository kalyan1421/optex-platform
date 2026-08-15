import { Skeleton } from '@/components/ui/Skeleton';

/**
 * PDP streaming fallback (audit F-10).
 *
 * Mirrors the real two-column layout — gallery left, buy panel right — so the
 * page does not jump when the product arrives. The PDP fetches the product, its
 * reviews and related items, and previously showed nothing until all three
 * resolved.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading product"
      className="mx-auto max-w-[1280px] px-4 py-10 lg:px-8"
    >
      <div className="flex flex-col gap-10 lg:flex-row">
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="flex gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-20 rounded-lg" />
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>
      <span className="sr-only">Loading product…</span>
    </div>
  );
}
