import '../../../core/models/paginated.dart';
import '../../../core/network/api_client.dart';
import '../domain/category.dart';
import '../domain/json.dart';
import '../domain/product.dart';
import '../domain/product_filters.dart';
import '../domain/promo_banner.dart';

/// Every catalog read, and nothing else.
///
/// Paths are relative to the configured `/api` base. All of these endpoints
/// are `@Public()` in `catalog.module.ts` / `promotions.controller.ts`, so
/// they pass `auth: false` — a signed-out shopper browses the whole catalogue
/// (SPEC-11 story 20), and sending a bearer token we may not have would only
/// invite a refresh round-trip for nothing.
class CatalogRepository {
  const CatalogRepository(this._api);

  final ApiClient _api;

  /// Default page size. The API's own default is 24 and its ceiling is 100
  /// (`ProductQueryDto`); 20 is four screens of the two-column phone grid,
  /// which is a better fit for a scroll-and-append list.
  static const int defaultPageSize = 20;

  /// The API caps `q` at 120 characters (F-19) and rejects anything longer
  /// with a 400. Clamping here turns a validation error into a truncated
  /// search, which is what the user meant anyway.
  static const int maxSearchLength = 120;

  /// `GET /products`.
  ///
  /// [featured] and [trending] are the migration-0041 curation flags. They
  /// are an override rather than a filter: when nothing is pinned the API
  /// returns the newest-first list instead of an empty page, so a home
  /// section never renders blank on an uncurated catalogue.
  Future<Paginated<Product>> listProducts({
    ProductFilters filters = const ProductFilters(),
    int page = 1,
    int limit = defaultPageSize,
    bool featured = false,
    bool trending = false,
  }) async {
    final Map<String, dynamic> query = filters.toQuery(page: page, limit: limit);
    if (featured) query['featured'] = true;
    if (trending) query['trending'] = true;

    final Map<String, dynamic> json = await _api.get<Map<String, dynamic>>(
      '/products',
      query: query,
      auth: false,
    );
    return Paginated<Product>.fromJson(json, Product.fromJson);
  }

  /// `GET /products/search`.
  Future<Paginated<Product>> searchProducts({
    required String term,
    int page = 1,
    int limit = defaultPageSize,
  }) async {
    final String trimmed = term.trim();
    final String q =
        trimmed.length > maxSearchLength ? trimmed.substring(0, maxSearchLength) : trimmed;

    final Map<String, dynamic> json = await _api.get<Map<String, dynamic>>(
      '/products/search',
      query: <String, dynamic>{'q': q, 'page': page, 'limit': limit},
      auth: false,
    );
    return Paginated<Product>.fromJson(json, Product.fromJson);
  }

  /// `GET /products/:slug`. 404s for a missing or deactivated product.
  Future<Product> productBySlug(String slug) async {
    final Map<String, dynamic> json = await _api.get<Map<String, dynamic>>(
      '/products/$slug',
      auth: false,
    );
    return Product.fromJson(json);
  }

  /// `GET /products/:id/related` — up to 8 products in the same category.
  ///
  /// Takes the product **id**, not the slug: the route is guarded by a
  /// `ParseUUIDPipe` and a slug earns a 400.
  Future<List<Product>> relatedProducts(String productId) async {
    final List<dynamic> json = await _api.get<List<dynamic>>(
      '/products/$productId/related',
      auth: false,
    );
    return asObjectList(json).map(Product.fromJson).toList(growable: false);
  }

  /// `GET /categories`, already ordered by `sort_order`.
  Future<List<Category>> categories() async {
    final List<dynamic> json = await _api.get<List<dynamic>>('/categories', auth: false);
    return asObjectList(json).map(Category.fromJson).toList(growable: false);
  }

  /// `GET /categories/:slug`.
  Future<Category> categoryBySlug(String slug) async {
    final Map<String, dynamic> json = await _api.get<Map<String, dynamic>>(
      '/categories/$slug',
      auth: false,
    );
    return Category.fromJson(json);
  }

  /// `GET /banners` — active banners inside their date window, sorted.
  Future<List<PromoBanner>> activeBanners() async {
    final List<dynamic> json = await _api.get<List<dynamic>>('/banners', auth: false);
    return asObjectList(json).map(PromoBanner.fromJson).toList(growable: false);
  }
}
