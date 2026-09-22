import 'catalog_image.dart';
import 'json.dart';

/// A catalogue product, as returned by `GET /products`, `/products/search`,
/// `/products/:slug` and `/products/:id/related`.
///
/// Column names mirror `packages/api-client/src/types.ts`'s `Product`, which
/// in turn mirrors `select('*')` on the `products` table.
class Product {
  const Product({
    required this.id,
    required this.sku,
    required this.slug,
    required this.name,
    required this.categoryId,
    required this.brand,
    required this.frameMaterial,
    required this.frameShape,
    required this.gender,
    required this.description,
    required this.priceKes,
    required this.images,
    required this.tryOnImageUrl,
    required this.isActive,
    required this.isFeatured,
    required this.isTrending,
    required this.ratingAvg,
    required this.ratingCount,
    required this.availableStock,
  });

  final String id;
  final String sku;
  final String slug;
  final String name;
  final String? categoryId;
  final String? brand;
  final String? frameMaterial;
  final String? frameShape;
  final String? gender;
  final String? description;
  final num priceKes;
  final List<String> images;
  final String? tryOnImageUrl;
  final bool isActive;

  /// Homepage curation (migration `0041`).
  final bool isFeatured;
  final bool isTrending;

  /// Mean of approved review ratings (migration `0024`), or null when there
  /// are none. Never rendered as "0 stars" — no reviews is not a bad score.
  final double? ratingAvg;
  final int ratingCount;

  /// Stock summed across every branch, or **null when unknown**.
  ///
  /// `ProductsService.withAvailability` sets null when the catalogue has no
  /// `inventory` rows for the product at all, precisely so a pending
  /// inventory import does not mislabel everything out of stock. Null is
  /// therefore "we don't know", not "zero" — see [isOutOfStock].
  ///
  /// **Absent entirely on `GET /products/:id/related`**, which does not go
  /// through `withAvailability`. Related cards consequently show no stock
  /// state; see the slice report.
  final int? availableStock;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
    id: asString(json['id']),
    sku: asString(json['sku']),
    slug: asString(json['slug']),
    name: asString(json['name'], fallback: 'Untitled'),
    categoryId: asStringOrNull(json['category_id']),
    brand: asStringOrNull(json['brand']),
    frameMaterial: asStringOrNull(json['frame_material']),
    frameShape: asStringOrNull(json['frame_shape']),
    gender: asStringOrNull(json['gender']),
    description: asStringOrNull(json['description']),
    priceKes: asNum(json['price_kes']),
    images: asStringList(json['images']),
    tryOnImageUrl: asStringOrNull(json['try_on_image_url']),
    isActive: asBool(json['is_active'], fallback: true),
    isFeatured: asBool(json['is_featured']),
    isTrending: asBool(json['is_trending']),
    ratingAvg: asDoubleOrNull(json['rating_avg']),
    ratingCount: asInt(json['rating_count']),
    availableStock: asIntOrNull(json['available_stock']),
  );

  /// The first displayable gallery image, or null when there is none.
  String? get primaryImageUrl => galleryUrls.isEmpty ? null : galleryUrls.first;

  /// Every gallery image that actually resolves to a loadable URL.
  List<String> get galleryUrls => images
      .map(resolveProductImageUrl)
      .whereType<String>()
      .toList(growable: false);

  /// True only when stock is known AND exhausted. An unknown stock level is
  /// never presented as unavailable.
  bool get isOutOfStock => availableStock != null && availableStock! <= 0;

  /// True when stock is known, positive and scarce enough to say so.
  bool get isLowStock =>
      availableStock != null &&
      availableStock! > 0 &&
      availableStock! <= lowStockThreshold;

  /// Whether the app should offer add-to-cart at all. The server re-checks
  /// this at checkout (`0020_checkout_stock_enforcement.sql`); this is only
  /// about not offering a button that is guaranteed to fail.
  bool get isPurchasable => isActive && !isOutOfStock;

  /// Matches the storefront's "Only N left" threshold.
  static const int lowStockThreshold = 5;
}
