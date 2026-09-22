import 'json.dart';

/// A product category, as returned by `GET /categories` and
/// `GET /categories/:slug`.
class Category {
  const Category({
    required this.id,
    required this.slug,
    required this.name,
    required this.sortOrder,
  });

  final String id;
  final String slug;
  final String name;
  final int sortOrder;

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: asString(json['id']),
        slug: asString(json['slug']),
        name: asString(json['name'], fallback: 'Category'),
        sortOrder: asInt(json['sort_order']),
      );
}
