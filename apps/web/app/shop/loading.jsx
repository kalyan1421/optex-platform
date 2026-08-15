import { PageHeaderSkeleton, ProductGridSkeleton } from '@/components/ui/Skeleton';

/**
 * Streaming fallback (audit F-10).
 *
 * This route is a Server Component that fetches through the API. Without a
 * `loading.jsx` Next has nothing to stream, so the browser sat on a blank
 * document until the slowest fetch resolved. With one, the chrome and this
 * skeleton paint immediately and the products swap in when they arrive.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 lg:px-8">
      <PageHeaderSkeleton />
      <ProductGridSkeleton count={8} />
    </div>
  );
}
