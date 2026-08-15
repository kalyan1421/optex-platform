/**
 * Compact star rating for product listings (audit F-11).
 *
 * Ratings used to render on the product page and nowhere else — absent from the
 * shop grid, search results, category pages and the home carousels, i.e. every
 * listing a customer actually browses. That was not a UI oversight so much as a
 * data one: `products` carried no aggregate, so stars on a 24-item grid would
 * have meant 24 extra round-trips. Migration 0024 denormalises `rating_avg` and
 * `rating_count`, which is what makes this component cheap enough to use.
 *
 * Renders NOTHING when a product has no approved reviews. An empty row of grey
 * stars reads as "rated badly" rather than "not yet rated", which is worse than
 * showing no rating at all — and most of a new catalogue is unrated.
 *
 * Accessibility: the stars are decorative (`aria-hidden`) with the real value in
 * a visually-hidden sentence, so a screen reader hears "Rated 4.5 out of 5 from
 * 12 reviews" rather than ten separate star characters.
 */
export default function StarRating({ rating, count, size = 'sm', className = '' }) {
  const value = Number(rating);
  if (!Number.isFinite(value) || !count) return null;

  const rounded = Math.round(value * 2) / 2; // nearest half star
  const textSize = size === 'lg' ? 'text-[16px]' : 'text-[13px]';
  const starSize = size === 'lg' ? 'text-[18px]' : 'text-[14px]';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span aria-hidden="true" className={`inline-flex leading-none ${starSize}`}>
        {[1, 2, 3, 4, 5].map((star) => {
          // Half stars are drawn by clipping a filled star over an empty one —
          // no icon set needed, and it scales with the font size.
          const fill = Math.max(0, Math.min(1, rounded - (star - 1)));
          return (
            <span key={star} className="relative inline-block">
              <span className="text-gray-300">★</span>
              {fill > 0 && (
                <span
                  className="absolute left-0 top-0 overflow-hidden text-[#E53935]"
                  style={{ width: `${fill * 100}%` }}
                >
                  ★
                </span>
              )}
            </span>
          );
        })}
      </span>
      <span className={`font-medium text-gray-500 ${textSize}`} aria-hidden="true">
        {value.toFixed(1)} ({count})
      </span>
      <span className="sr-only">
        Rated {value.toFixed(1)} out of 5 from {count} review{count === 1 ? '' : 's'}
      </span>
    </span>
  );
}
