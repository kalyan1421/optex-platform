/**
 * Safe serialization for JSON-LD embedded in a `<script>` tag.
 *
 * WHY THIS EXISTS (frontend audit F-02). Every JSON-LD block on this site is
 * injected with `dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}`.
 * `JSON.stringify` escapes what JSON needs escaped — quotes, backslashes,
 * control characters — but `<` and `>` are ordinary characters to it. Inside
 * an HTML `<script>` element they are not: the parser ends the script at the
 * first literal `</script`, whatever the surrounding JSON syntax says. So a
 * product whose name contained
 *
 *     </script><img src=x onerror=...>
 *
 * would close the tag and have the rest parsed as markup. The values reaching
 * these blocks (product name, description, brand, sku; branch name and
 * address) are all database content, and `products.write` is Super Admin only
 * today — so this is a sink rather than an open door. It is still the wrong
 * way to build the string, and the CSP cannot catch it: `script-src` carries
 * `'unsafe-inline'` on both apps.
 *
 * The escapes below are all valid JSON string escapes, so a parser reads back
 * exactly the same values — this changes the bytes, never the data.
 *
 *   `<` `>`  — cannot start or end a tag.
 *   `&`      — cannot start an HTML entity that resolves into one.
 *   U+2028 / U+2029 — legal inside a JSON string but line terminators to a
 *                     JavaScript parser, which truncates the script.
 */
export function serializeJsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
