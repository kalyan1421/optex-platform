/// Every user-visible string in the catalog slice.
///
/// SPEC-11's M1 exit criteria call for externalised strings — English only
/// ships, but no literals buried in widgets, so adding a locale later is a
/// translation file rather than a refactor. There is no `flutter_localizations`
/// or ARB pipeline in `pubspec.yaml` (which this slice may not edit), so this
/// is a plain constants class: the right shape, one dependency short of being
/// a real localisation. Swapping it for generated `AppLocalizations` later is
/// a mechanical find-and-replace.
class CatalogStrings {
  const CatalogStrings._();

  // ── Screens ──────────────────────────────────────────────────────────────
  static const String homeTitle = 'OPTEX';
  static const String shopTitle = 'Shop';
  static const String searchTitle = 'Search';
  static const String productTitle = 'Product';

  // ── Home ─────────────────────────────────────────────────────────────────
  static const String heroHeadline = 'See Better.\nLook Better.';
  static const String heroSubtitle =
      'Premium eyewear, eye tests and expert care across Kenya.';
  static const String heroCta = 'Shop the collection';
  static const String shopByCategory = 'Shop by category';
  static const String trendingNow = 'Trending now';
  static const String trendingSubtitle = 'Our most popular designs this season.';
  static const String featuredProducts = 'Featured products';
  static const String featuredSubtitle = 'A handpicked selection of premium eyewear.';
  static const String seeAll = 'See all';
  static const String noCategories = 'No categories yet';
  static const String noCategoriesBody =
      'Categories will appear here once the catalogue is set up.';
  static const String bannersUnavailable = 'Promotions could not be loaded.';

  // ── Shop / lists ─────────────────────────────────────────────────────────
  static const String filters = 'Filters';
  static const String sortBy = 'Sort';
  static const String clearAll = 'Clear all';
  static const String apply = 'Apply';
  static const String noProducts = 'No frames match these filters';
  static const String noProductsBody =
      'Try widening your search — removing the price band usually helps most.';
  static const String emptyCatalogue = 'Our collection is being updated';
  static const String emptyCategory = 'Nothing in this category yet';
  static const String emptyCategoryBody =
      'New frames are added regularly — check back soon.';
  static const String emptyCatalogueBody = 'Please check back shortly.';
  static const String endOfList = 'That is everything.';
  static const String loadMoreFailed = 'Could not load more products.';
  static const String retry = 'Try again';

  static String showingCount(int shown, int total) =>
      total > shown ? 'Showing $shown of $total' : (total == 1 ? '1 product' : '$total products');

  // ── Filters ──────────────────────────────────────────────────────────────
  static const String filterCategory = 'Category';
  static const String filterBrand = 'Brand';
  static const String filterShape = 'Frame shape';
  static const String filterGender = 'Gender';
  static const String filterMaterial = 'Material';
  static const String filterPrice = 'Price';
  static const String filterAny = 'Any';
  static const String facetSampleNote =
      'Brand, shape, gender and material options come from a sample of the catalogue; '
      'filtering itself runs on the server.';

  static const String priceAny = 'Any price';
  static const String priceUnder10k = 'Under KSh 10,000';
  static const String price10kTo20k = 'KSh 10,000 – 19,999';
  static const String price20kTo30k = 'KSh 20,000 – 29,999';
  static const String priceOver30k = 'KSh 30,000 and above';

  static const String sortNewest = 'Newest';
  static const String sortPriceAsc = 'Price: low to high';
  static const String sortPriceDesc = 'Price: high to low';
  static const String sortFeatured = 'Featured';

  // ── Search ───────────────────────────────────────────────────────────────
  static const String searchHint = 'Search frames, brands, styles';
  static const String searchPrompt = 'What are you looking for?';
  static const String searchPromptBody =
      'Search by product name or brand — results update as you type.';
  static const String searchNoResults = 'Nothing matched that';
  static String searchNoResultsBody(String term) =>
      'We could not find anything for “$term”. Try a shorter or more general term.';
  static const String searchClear = 'Clear search';

  // ── Product detail ───────────────────────────────────────────────────────
  static const String addToCart = 'Add to cart';
  static const String outOfStock = 'Out of stock';
  static const String outOfStockNotice = 'Currently out of stock.';
  static const String unavailableNotice = 'This product is no longer available.';
  static const String stockUnknownNotice = 'Availability is confirmed at checkout.';
  static String lowStockNotice(int remaining) => 'Only $remaining left in stock.';
  static const String inStockNotice = 'In stock.';
  static const String decreaseQuantity = 'Decrease quantity';
  static const String increaseQuantity = 'Increase quantity';
  static const String description = 'Description';
  static const String noDescription = 'No description has been added for this product yet.';
  static const String details = 'Details';
  static const String detailBrand = 'Brand';
  static const String detailShape = 'Shape';
  static const String detailMaterial = 'Material';
  static const String detailGender = 'Gender';
  static const String detailSku = 'SKU';
  static const String relatedProducts = 'You may also like';
  static const String relatedUnavailable = 'Related products could not be loaded.';
  static const String noRelated = 'Nothing related yet';
  static const String noRelatedBody = 'This is the only product in its category right now.';
  static const String noReviewsYet = 'No reviews yet';
  static String reviewCount(int count) => count == 1 ? '1 review' : '$count reviews';
  static const String productNotFound = 'Product not found';
  static const String productNotFoundBody =
      'This product may have been removed from the catalogue.';
  static const String backToShop = 'Back to shop';
  static const String imageUnavailable = 'Image unavailable';

  // ── Category ─────────────────────────────────────────────────────────────
  static const String categoryNotFound = 'Category not found';

  // ── Commerce hand-off ────────────────────────────────────────────────────
  static const String cartNotWired =
      'Add to cart is not connected yet — the commerce module is still being built.';
}
