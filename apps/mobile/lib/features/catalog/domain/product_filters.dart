import '../catalog_strings.dart';

/// Sort orders accepted by `GET /products`.
///
/// Exactly the four values in `ProductSort` (`product-query.dto.ts`) — the
/// storefront additionally offers "Name: A–Z", which it implements by sorting
/// its own in-memory page. There is no API equivalent, so it is not offered
/// here rather than faked over a partial page.
enum ProductSortOption {
  newest('newest'),
  priceAsc('price_asc'),
  priceDesc('price_desc'),
  featured('featured');

  const ProductSortOption(this.apiValue);

  /// The literal the API's `IsEnum` validator expects.
  final String apiValue;

  String get label => switch (this) {
    ProductSortOption.newest => CatalogStrings.sortNewest,
    ProductSortOption.priceAsc => CatalogStrings.sortPriceAsc,
    ProductSortOption.priceDesc => CatalogStrings.sortPriceDesc,
    ProductSortOption.featured => CatalogStrings.sortFeatured,
  };
}

/// A selectable price range, expressed as the `minPrice` / `maxPrice` query
/// parameters the API actually supports.
///
/// Bands rather than a slider, matching the storefront — and bounds are
/// whole shillings with no overlap and no gap, which holds because
/// `price_kes` is only ever populated with whole KES amounts. The API's
/// comparisons are inclusive (`gte` / `lte`), so the labels state the real
/// bounds instead of the storefront's rounded "10,000 – 20,000".
class PriceBand {
  const PriceBand({required this.label, this.minPrice, this.maxPrice});

  final String label;
  final num? minPrice;
  final num? maxPrice;

  bool get isAny => minPrice == null && maxPrice == null;

  static const PriceBand any = PriceBand(label: CatalogStrings.priceAny);

  static const List<PriceBand> all = <PriceBand>[
    any,
    PriceBand(label: CatalogStrings.priceUnder10k, maxPrice: 9999),
    PriceBand(
      label: CatalogStrings.price10kTo20k,
      minPrice: 10000,
      maxPrice: 19999,
    ),
    PriceBand(
      label: CatalogStrings.price20kTo30k,
      minPrice: 20000,
      maxPrice: 29999,
    ),
    PriceBand(label: CatalogStrings.priceOver30k, minPrice: 30000),
  ];

  /// The band matching a min/max pair, so a restored filter set highlights
  /// the right row.
  static PriceBand resolve(num? min, num? max) => all.firstWhere(
    (PriceBand b) => b.minPrice == min && b.maxPrice == max,
    orElse: () => any,
  );
}

/// Every filter the app sends to `GET /products`.
///
/// One field per supported query parameter and nothing else — inventing a
/// parameter the DTO does not declare would be rejected by the API's
/// `ValidationPipe` with `forbidNonWhitelisted`, and silently ignored at
/// best. `gender` and `material` are included because the DTO declares them,
/// even though the Figma shop screen does not show them.
class ProductFilters {
  const ProductFilters({
    this.categorySlug,
    this.brand,
    this.shape,
    this.gender,
    this.material,
    this.minPrice,
    this.maxPrice,
    this.sort = ProductSortOption.newest,
  });

  /// A category slug (the API also accepts a UUID and resolves either).
  final String? categorySlug;
  final String? brand;
  final String? shape;
  final String? gender;
  final String? material;
  final num? minPrice;
  final num? maxPrice;
  final ProductSortOption sort;

  PriceBand get priceBand => PriceBand.resolve(minPrice, maxPrice);

  /// How many filters are narrowing the list. Sort is not a filter, and a
  /// category the screen has locked is counted by the caller, not here.
  int get activeCount => <Object?>[
    categorySlug,
    brand,
    shape,
    gender,
    material,
    minPrice ?? maxPrice,
  ].where((Object? v) => v != null).length;

  /// Query parameters for one page. Null values are dropped by `ApiClient`,
  /// so an unset filter is genuinely absent rather than an empty string —
  /// which the API would reject as present-but-invalid.
  Map<String, dynamic> toQuery({required int page, required int limit}) =>
      <String, dynamic>{
        'page': page,
        'limit': limit,
        'category': categorySlug,
        'brand': brand,
        'shape': shape,
        'gender': gender,
        'material': material,
        'minPrice': minPrice,
        'maxPrice': maxPrice,
        'sort': sort.apiValue,
      };

  ProductFilters copyWith({
    Object? categorySlug = _unset,
    Object? brand = _unset,
    Object? shape = _unset,
    Object? gender = _unset,
    Object? material = _unset,
    Object? minPrice = _unset,
    Object? maxPrice = _unset,
    ProductSortOption? sort,
  }) => ProductFilters(
    categorySlug: identical(categorySlug, _unset)
        ? this.categorySlug
        : categorySlug as String?,
    brand: identical(brand, _unset) ? this.brand : brand as String?,
    shape: identical(shape, _unset) ? this.shape : shape as String?,
    gender: identical(gender, _unset) ? this.gender : gender as String?,
    material: identical(material, _unset) ? this.material : material as String?,
    minPrice: identical(minPrice, _unset) ? this.minPrice : minPrice as num?,
    maxPrice: identical(maxPrice, _unset) ? this.maxPrice : maxPrice as num?,
    sort: sort ?? this.sort,
  );

  ProductFilters withPriceBand(PriceBand band) =>
      copyWith(minPrice: band.minPrice, maxPrice: band.maxPrice);

  /// Clears every filter but keeps the sort and any locked category.
  ProductFilters cleared({String? keepCategorySlug}) =>
      ProductFilters(categorySlug: keepCategorySlug, sort: sort);

  /// Sentinel that lets [copyWith] tell "not passed" from "passed null",
  /// which matters because clearing a filter IS passing null.
  static const Object _unset = Object();

  @override
  bool operator ==(Object other) =>
      other is ProductFilters &&
      other.categorySlug == categorySlug &&
      other.brand == brand &&
      other.shape == shape &&
      other.gender == gender &&
      other.material == material &&
      other.minPrice == minPrice &&
      other.maxPrice == maxPrice &&
      other.sort == sort;

  @override
  int get hashCode => Object.hash(
    categorySlug,
    brand,
    shape,
    gender,
    material,
    minPrice,
    maxPrice,
    sort,
  );
}
