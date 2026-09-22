import '../../../core/env/app_env.dart';

/// Storage bucket holding product gallery images (migration `0003`).
const String _productImagesBucket = 'product-images';

/// Resolves a raw `products.images[]` entry to something loadable.
///
/// Mirrors `apps/web/lib/product-image.js`, with two deliberate differences.
///
/// 1. **Seed paths resolve to null.** The web maps `/seed/<name>.png` onto a
///    file in `public/`, because those rows point at objects that were never
///    uploaded to the bucket. The app bundles no such assets (`pubspec.yaml`
///    ships no `assets:` section and is not ours to edit), so the honest
///    answer is "no image" and the placeholder renders. Against seeded
///    local data, every product therefore shows a placeholder.
/// 2. **Storage URLs carry `apikey`.** The local Supabase Kong gateway
///    demands the anon key even for a public object. `promotions.service.ts`
///    already does exactly this for banner URLs before returning them
///    (`makeStorageUrlBrowserReadable`); the products endpoints do not, so
///    the client has to. The key is public by design and hosted Supabase
///    ignores the extra parameter.
///
/// Returns null when there is nothing displayable, which every call site
/// renders as a placeholder rather than a broken image.
String? resolveProductImageUrl(String? raw) {
  final String? path = raw?.trim();
  if (path == null || path.isEmpty) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/seed/')) return null;

  final String base = AppEnv.supabaseUrl.replaceAll(RegExp(r'/+$'), '');
  if (base.isEmpty) return null;

  final String suffix = path.startsWith('/') ? path : '/$path';
  final String url = '$base/storage/v1/object/public/$_productImagesBucket$suffix';
  return _withAnonKey(url);
}

/// Resolves a `promo_banners.image_url`.
///
/// The API hands these back already absolute and already browser-readable, so
/// anything that is not an absolute URL is a hand-entered value we cannot
/// resolve — null, and the hero falls back.
String? resolveBannerImageUrl(String? raw) {
  final String? url = raw?.trim();
  if (url == null || url.isEmpty) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return null;
}

String _withAnonKey(String url) {
  final String key = AppEnv.supabaseAnonKey;
  if (key.isEmpty) return url;
  final String separator = url.contains('?') ? '&' : '?';
  return '$url${separator}apikey=$key';
}
