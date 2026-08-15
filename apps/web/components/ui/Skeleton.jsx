/**
 * Loading placeholders for the Server Component routes (audit F-10).
 *
 * The storefront had no `loading.jsx` anywhere, which forfeits streaming: a
 * page blocked on its slowest API fetch and showed nothing at all until every
 * one resolved. On a Kenyan mobile connection that is the difference customers
 * notice first — and the fix is a file per route, not a rewrite.
 *
 * These shapes deliberately mirror the real layouts they stand in for. A
 * skeleton whose proportions do not match causes exactly the layout shift it
 * was meant to prevent.
 *
 * `aria-hidden` throughout: a screen reader should hear the route's real
 * content when it arrives, not a description of grey boxes. The announcement is
 * handled once, by the wrapper's `aria-busy`.
 */

/** One grey block. `className` sets its size. */
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

/** A product card placeholder: square image, then two lines of text. */
export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}

/** A responsive grid of card placeholders, matching the shop/category grids. */
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading products"
      className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4"
    >
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading products…</span>
    </div>
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
