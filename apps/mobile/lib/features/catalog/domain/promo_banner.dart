import 'catalog_image.dart';
import 'json.dart';

/// An active hero banner, as returned by `GET /banners`.
///
/// The endpoint already filters to `is_active` rows inside their start/end
/// window and orders by `sort_order`, so the client neither filters nor sorts.
class PromoBanner {
  const PromoBanner({
    required this.id,
    required this.imageUrl,
    required this.targetUrl,
    required this.headline,
    required this.sortOrder,
  });

  final String id;

  /// Already absolute and already anon-key-stamped by the API, or null when
  /// the stored value is not a URL we can load.
  final String? imageUrl;

  /// Where tapping the banner should go. Server data, so it may be an in-app
  /// path (`/shop`) or an external link.
  final String? targetUrl;
  final String? headline;
  final int sortOrder;

  factory PromoBanner.fromJson(Map<String, dynamic> json) => PromoBanner(
    id: asString(json['id']),
    imageUrl: resolveBannerImageUrl(asStringOrNull(json['image_url'])),
    targetUrl: asStringOrNull(json['target_url']),
    headline: asStringOrNull(json['headline']),
    sortOrder: asInt(json['sort_order']),
  );

  /// Headlines are authored with a literal `\n` escape for the web carousel,
  /// which splits on it to stack lines. Rendered the same way here.
  List<String> get headlineLines => (headline ?? '')
      .split(r'\n')
      .map((String l) => l.trim())
      .where((String l) => l.isNotEmpty)
      .toList();
}
