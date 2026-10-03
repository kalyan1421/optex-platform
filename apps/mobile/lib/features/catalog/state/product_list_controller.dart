import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/paginated.dart';
import '../../../core/network/api_exception.dart';
import '../data/catalog_repository.dart';
import '../domain/product.dart';
import '../domain/product_filters.dart';
import 'catalog_providers.dart';

/// Which endpoint a list is reading from.
enum ProductListSource { catalogue, search }

/// Identifies one independent product list — its own filters, its own pages,
/// its own scroll position.
///
/// Filters deliberately are **not** part of the identity. They live in the
/// list's state instead, so changing a filter reloads the same list rather
/// than spawning a new provider entry per filter combination.
class ProductListId {
  const ProductListId._(this.source, this.value);

  /// The main `/shop` list.
  const ProductListId.shop() : this._(ProductListSource.catalogue, null);

  /// A category landing list, permanently scoped to one category slug.
  const ProductListId.category(String slug)
    : this._(ProductListSource.catalogue, slug);

  /// One search term's results.
  const ProductListId.search(String term)
    : this._(ProductListSource.search, term);

  final ProductListSource source;
  final String? value;

  /// The category this list can never filter away from, if any.
  String? get lockedCategorySlug =>
      source == ProductListSource.catalogue ? value : null;

  String get searchTerm =>
      source == ProductListSource.search ? (value ?? '') : '';

  @override
  bool operator ==(Object other) =>
      other is ProductListId && other.source == source && other.value == value;

  @override
  int get hashCode => Object.hash(source, value);
}

/// Everything one product list knows about itself.
class ProductListState {
  const ProductListState({
    required this.filters,
    this.items = const <Product>[],
    this.page = 0,
    this.total = 0,
    this.hasMore = false,
    this.isLoadingFirstPage = true,
    this.isLoadingMore = false,
    this.error,
    this.loadMoreError,
  });

  final ProductFilters filters;
  final List<Product> items;

  /// The last page successfully loaded. 0 before the first load.
  final int page;

  /// How many products match, across every page.
  final int total;
  final bool hasMore;
  final bool isLoadingFirstPage;
  final bool isLoadingMore;

  /// A failure that left the list with nothing to show. Rendered full-screen.
  final ApiException? error;

  /// A failure loading page N+1 while pages 1..N are on screen. Rendered as a
  /// footer with its own retry, because blowing the loaded list away to show
  /// an error would punish the user for scrolling.
  final ApiException? loadMoreError;

  bool get isEmpty => items.isEmpty && !isLoadingFirstPage && error == null;

  ProductListState copyWith({
    ProductFilters? filters,
    List<Product>? items,
    int? page,
    int? total,
    bool? hasMore,
    bool? isLoadingFirstPage,
    bool? isLoadingMore,
    Object? error = _unset,
    Object? loadMoreError = _unset,
  }) => ProductListState(
    filters: filters ?? this.filters,
    items: items ?? this.items,
    page: page ?? this.page,
    total: total ?? this.total,
    hasMore: hasMore ?? this.hasMore,
    isLoadingFirstPage: isLoadingFirstPage ?? this.isLoadingFirstPage,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    error: identical(error, _unset) ? this.error : error as ApiException?,
    loadMoreError: identical(loadMoreError, _unset)
        ? this.loadMoreError
        : loadMoreError as ApiException?,
  );

  static const Object _unset = Object();
}

/// Pagination, filtering and sorting for one product list.
///
/// Appending pages rather than replacing them is what preserves scroll
/// position: the widget's `ScrollController` keeps its offset because the
/// items above it never move. Every filter and every sort is a round trip —
/// nothing is narrowed client-side over a page that is only part of the
/// result set, which is the trap the storefront's 100-row `/shop` falls into.
class ProductListController extends Notifier<ProductListState> {
  ProductListController(this.id);

  final ProductListId id;

  bool _started = false;

  /// Guards against an out-of-order response overwriting a newer one — a real
  /// risk when a user taps two filters quickly on a slow connection.
  int _requestToken = 0;

  CatalogRepository get _repo => ref.read(catalogRepositoryProvider);

  @override
  ProductListState build() => ProductListState(
    filters: ProductFilters(categorySlug: id.lockedCategorySlug),
  );

  /// Loads the first page exactly once. Safe to call from every `initState`.
  Future<void> ensureLoaded() async {
    if (_started) return;
    _started = true;
    await _fetch(page: 1, replace: true);
  }

  /// Re-reads page 1 and drops everything after it. Used for pull-to-refresh
  /// and for the full-screen error's retry.
  Future<void> refresh() {
    _started = true;
    return _fetch(page: 1, replace: true);
  }

  /// Appends the next page. A no-op while a load is in flight or at the end.
  Future<void> loadMore() {
    final ProductListState current = state;
    if (current.isLoadingFirstPage ||
        current.isLoadingMore ||
        !current.hasMore) {
      return Future<void>.value();
    }
    return _fetch(page: current.page + 1, replace: false);
  }

  /// Retries only the page that failed, keeping what is already on screen.
  Future<void> retryLoadMore() {
    if (state.isLoadingMore) return Future<void>.value();
    return _fetch(page: state.page + 1, replace: false);
  }

  void applyFilters(ProductFilters next) {
    if (next == state.filters) return;
    state = state.copyWith(filters: next);
    _started = true;
    unawaited(_fetch(page: 1, replace: true));
  }

  void setSort(ProductSortOption sort) =>
      applyFilters(state.filters.copyWith(sort: sort));

  /// Narrows (or widens) the list to one category. Used by `/shop?category=`
  /// so a deep link or a banner can open the shop pre-filtered.
  void setCategory(String? slug) =>
      applyFilters(state.filters.copyWith(categorySlug: slug));

  void clearFilters() => applyFilters(
    state.filters.cleared(keepCategorySlug: id.lockedCategorySlug),
  );

  Future<void> _fetch({required int page, required bool replace}) async {
    final int token = ++_requestToken;

    if (id.source == ProductListSource.search && id.searchTerm.trim().isEmpty) {
      state = state.copyWith(
        items: const <Product>[],
        page: 0,
        total: 0,
        hasMore: false,
        isLoadingFirstPage: false,
        isLoadingMore: false,
        error: null,
        loadMoreError: null,
      );
      return;
    }

    state = replace
        ? state.copyWith(
            isLoadingFirstPage: true,
            error: null,
            loadMoreError: null,
          )
        : state.copyWith(isLoadingMore: true, loadMoreError: null);

    try {
      final Paginated<Product> result = switch (id.source) {
        ProductListSource.search => await _repo.searchProducts(
          term: id.searchTerm,
          page: page,
        ),
        ProductListSource.catalogue => await _repo.listProducts(
          filters: state.filters,
          page: page,
        ),
      };

      // A stale response, or a provider disposed while the request was in
      // flight. Writing state in either case is wrong (and throws in the
      // second), so drop it.
      if (!ref.mounted || token != _requestToken) return;

      final List<Product> items = replace
          ? result.items
          : <Product>[...state.items, ...result.items];

      state = state.copyWith(
        items: items,
        page: result.page,
        total: result.total,
        hasMore: result.items.isNotEmpty && items.length < result.total,
        isLoadingFirstPage: false,
        isLoadingMore: false,
        error: null,
        loadMoreError: null,
      );
    } on ApiException catch (e) {
      if (!ref.mounted || token != _requestToken) return;
      state = replace
          ? state.copyWith(
              items: const <Product>[],
              isLoadingFirstPage: false,
              isLoadingMore: false,
              error: e,
            )
          : state.copyWith(isLoadingMore: false, loadMoreError: e);
    }
  }
}

/// Browse lists — `/shop` and each category landing page.
///
/// Not auto-disposed, on purpose: the whole point is that returning from a
/// product detail screen finds the same products, the same filters and the
/// same scroll offset. The key space is bounded (one shop list plus one per
/// category), so holding them is cheap.
// NOTE: `NotifierProviderFamily` is not exported by `flutter_riverpod`, so the
// type here is inferred rather than annotated.
final browseListProvider =
    NotifierProvider.family<
      ProductListController,
      ProductListState,
      ProductListId
    >(ProductListController.new);

/// Search results, one list per term.
///
/// Auto-disposed, equally on purpose: a debounced search box produces a new
/// key for every term a user settles on, and keeping all of them alive for
/// the session would be a slow leak.
final searchListProvider =
    NotifierProvider.family<
      ProductListController,
      ProductListState,
      ProductListId
    >(ProductListController.new, isAutoDispose: true);
