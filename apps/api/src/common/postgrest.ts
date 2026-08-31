/**
 * Helpers for building PostgREST filter strings safely.
 */

/**
 * Makes user input safe to interpolate into a PostgREST `or(...)` / `ilike`
 * filter string.
 *
 * Two separate concerns, both of which have to be handled:
 *   - `,` `.` `(` `)` are PostgREST's own filter DELIMITERS. Left unescaped, a
 *     term like `x,is_active.eq.false` injects an extra OR condition and
 *     changes which rows the query returns. Stripped to spaces.
 *   - `%` and `_` are `ilike` wildcards, escaped so a term containing them
 *     matches literally instead of turning the search into a match-everything.
 *
 * Lifted out of `branches.service.ts` (audit C-01): `products.service.ts` and
 * `branches.service.ts` had each grown their own copy of this, and
 * `customers.service.ts` had a third that stripped `,` `(` `)` but neither the
 * dot nor the wildcards. Three copies of a security-relevant escape is two too
 * many — they drift, and the weakest one is the one that matters.
 */
export function escapeForPostgrestFilter(value: string): string {
  return value.replace(/[(),.]/g, ' ').replace(/[%_]/g, (match) => `\\${match}`);
}
