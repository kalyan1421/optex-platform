/// Mirrors `WishlistItemView` (`apps/api/src/modules/wishlist/wishlist.service.ts`).
///
/// The endpoint joins enough product data to render the whole screen in one
/// call, so there is no per-item catalog round trip.
class WishlistItem {
  const WishlistItem({
    required this.productId,
    required this.addedAt,
    required this.product,
  });

  final String productId;
  final DateTime? addedAt;
  final WishlistProduct product;

  factory WishlistItem.fromJson(Map<String, dynamic> json) => WishlistItem(
    productId: json['productId'] as String,
    addedAt: DateTime.tryParse(json['addedAt'] as String? ?? ''),
    product: WishlistProduct.fromJson(
      (json['product'] as Map<String, dynamic>?) ?? const <String, dynamic>{},
    ),
  );
}

/// The product summary embedded in a wishlist row.
class WishlistProduct {
  const WishlistProduct({
    required this.id,
    required this.slug,
    required this.name,
    required this.priceKes,
    required this.isActive,
    this.brand,
    this.image,
  });

  final String id;
  final String slug;
  final String name;
  final String? brand;
  final num priceKes;
  final String? image;

  /// `false` means discontinued or deactivated, never deleted — a hard delete
  /// cascades the wishlist row away (migration 0017). So this is the only
  /// "unavailable" state the screen has to render, and it is never a hole.
  final bool isActive;

  factory WishlistProduct.fromJson(Map<String, dynamic> json) =>
      WishlistProduct(
        id: json['id'] as String? ?? '',
        slug: json['slug'] as String? ?? '',
        name: json['name'] as String? ?? 'Product',
        brand: json['brand'] as String?,
        priceKes: (json['priceKes'] as num?) ?? 0,
        image: json['image'] as String?,
        isActive: json['isActive'] as bool? ?? true,
      );
}
