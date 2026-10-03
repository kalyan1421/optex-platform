import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/paginated.dart';
import '../../../core/providers.dart';
import '../data/catalog_repository.dart';
import '../domain/category.dart';
import '../domain/product.dart';
import '../domain/promo_banner.dart';

/// The catalog slice's single dependency on core: the shared `ApiClient`.
final Provider<CatalogRepository> catalogRepositoryProvider =
    Provider<CatalogRepository>(
      (Ref ref) => CatalogRepository(ref.watch(apiClientProvider)),
    );

/// `GET /categories`. Cached for the session — categories change about as
/// often as the shop fascia does, and the home screen, the shop filter sheet
/// and the category screen all want the same list.
final FutureProvider<List<Category>> categoriesProvider =
    FutureProvider<List<Category>>(
      (Ref ref) => ref.watch(catalogRepositoryProvider).categories(),
    );

/// `GET /banners`.
final FutureProvider<List<PromoBanner>> activeBannersProvider =
    FutureProvider<List<PromoBanner>>(
      (Ref ref) => ref.watch(catalogRepositoryProvider).activeBanners(),
    );

/// Homepage "Featured Products" — the curated eight (migration `0041`).
final FutureProvider<List<Product>> featuredProductsProvider =
    FutureProvider<List<Product>>((Ref ref) async {
      final Paginated<Product> page = await ref
          .watch(catalogRepositoryProvider)
          .listProducts(featured: true, limit: 8);
      return page.items;
    });

/// Homepage "Trending Now" — the curated four. Same counts as the storefront
/// sections these mirror.
final FutureProvider<List<Product>> trendingProductsProvider =
    FutureProvider<List<Product>>((Ref ref) async {
      final Paginated<Product> page = await ref
          .watch(catalogRepositoryProvider)
          .listProducts(trending: true, limit: 4);
      return page.items;
    });

/// `GET /products/:slug`. Auto-disposed: one entry per product the user opens
/// would otherwise accumulate for the life of the session.
// NOTE: the `*ProviderFamily` types are not exported by `flutter_riverpod`
// (they are annotated `@publicInMisc`), so family providers are declared with
// an inferred type rather than an explicit annotation.
final productBySlugProvider = FutureProvider.family<Product, String>(
  (Ref ref, String slug) =>
      ref.watch(catalogRepositoryProvider).productBySlug(slug),
  isAutoDispose: true,
);

/// `GET /products/:id/related`. Keyed by product **id** — the route parses a
/// UUID and rejects a slug.
final relatedProductsProvider = FutureProvider.family<List<Product>, String>(
  (Ref ref, String productId) =>
      ref.watch(catalogRepositoryProvider).relatedProducts(productId),
  isAutoDispose: true,
);

/// `GET /categories/:slug`.
final categoryBySlugProvider = FutureProvider.family<Category, String>(
  (Ref ref, String slug) =>
      ref.watch(catalogRepositoryProvider).categoryBySlug(slug),
  isAutoDispose: true,
);

/// The distinct values offered by the filter sheet for brand, shape, gender
/// and material.
///
/// **There is no facets endpoint.** `apps/api` exposes no way to ask for the
/// distinct values of a column, so these are derived from a sample — one page
/// of the catalogue at the API's maximum `limit` of 100. The storefront does
/// the same thing and then also *filters* in the browser over those 100 rows;
/// this slice only borrows the option list. Selecting an option still sends
/// a query parameter and re-queries the server, so filtering is never applied
/// to a partial page. Categories are exempt: `GET /categories` is complete
/// and authoritative, so the category facet is too.
///
/// The consequence to be honest about: a brand that appears only on product
/// 101 will not be offered as a filter option until the catalogue is paged
/// through. See the slice report — this wants a `GET /products/facets`.
class CatalogFacets {
  const CatalogFacets({
    required this.brands,
    required this.shapes,
    required this.genders,
    required this.materials,
    required this.sampleSize,
    required this.catalogueTotal,
  });

  final List<String> brands;
  final List<String> shapes;
  final List<String> genders;
  final List<String> materials;

  /// How many products the options were derived from.
  final int sampleSize;

  /// How many active products exist in total.
  final int catalogueTotal;

  /// True when the sample did not cover the whole catalogue, and the option
  /// lists are therefore incomplete.
  bool get isPartial => catalogueTotal > sampleSize;

  static const CatalogFacets empty = CatalogFacets(
    brands: <String>[],
    shapes: <String>[],
    genders: <String>[],
    materials: <String>[],
    sampleSize: 0,
    catalogueTotal: 0,
  );
}

/// Maximum `limit` the API accepts (`ProductQueryDto`).
const int _facetSampleSize = 100;

final FutureProvider<CatalogFacets> catalogFacetsProvider =
    FutureProvider<CatalogFacets>((Ref ref) async {
      final Paginated<Product> page = await ref
          .watch(catalogRepositoryProvider)
          .listProducts(limit: _facetSampleSize);

      return CatalogFacets(
        brands: _distinct(page.items.map((Product p) => p.brand)),
        shapes: _distinct(page.items.map((Product p) => p.frameShape)),
        genders: _distinct(page.items.map((Product p) => p.gender)),
        materials: _distinct(page.items.map((Product p) => p.frameMaterial)),
        sampleSize: page.items.length,
        catalogueTotal: page.total,
      );
    });

/// Distinct, sorted values, grouped case-insensitively.
///
/// The catalogue is not clean — the seed alone carries both "Metal" and
/// "metal". Two rows that each filter out the other's products is a worse
/// answer than one row that filters neither perfectly, and the API's `eq`
/// comparison is case-sensitive, so the first spelling seen is the one sent.
List<String> _distinct(Iterable<String?> values) {
  final Map<String, String> seen = <String, String>{};
  for (final String? raw in values) {
    final String? value = raw?.trim();
    if (value == null || value.isEmpty) continue;
    seen.putIfAbsent(value.toLowerCase(), () => value);
  }
  final List<String> out = seen.values.toList();
  out.sort((String a, String b) => a.toLowerCase().compareTo(b.toLowerCase()));
  return out;
}
