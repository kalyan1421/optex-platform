import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/widgets/optex_logo.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../catalog_strings.dart';
import '../domain/category.dart';
import '../domain/product.dart';
import '../domain/promo_banner.dart';
import '../state/catalog_providers.dart';
import 'widgets/async_section.dart';
import 'widgets/banner_carousel.dart';
import 'widgets/category_shortcuts.dart';
import 'widgets/product_rail.dart';
import 'widgets/section_header.dart';

/// The home screen — hero banners, category shortcuts, and the two curated
/// product sections.
///
/// Each section owns its own request and its own three states. One failing
/// section leaves the rest of the page usable, which is the whole reason they
/// are not fetched together: a banner outage must not take the catalogue down
/// with it, exactly as `Hero.jsx` catches its own error on the storefront.
///
/// The storefront's third section, "Featured Collection" (a 100-product fetch
/// tabbed by category), is not reproduced. It is a client-side tab filter over
/// a partial catalogue — the pattern this slice was told not to repeat — and
/// the category shortcuts plus the shop filters serve the same intent
/// correctly. See the slice report.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(activeBannersProvider);
    ref.invalidate(categoriesProvider);
    ref.invalidate(trendingProductsProvider);
    ref.invalidate(featuredProductsProvider);
    await Future.wait<void>(<Future<void>>[
      _settle(ref.read(activeBannersProvider.future)),
      _settle(ref.read(categoriesProvider.future)),
      _settle(ref.read(trendingProductsProvider.future)),
      _settle(ref.read(featuredProductsProvider.future)),
    ]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const OptexLogo(height: 30),
        actions: <Widget>[
          IconButton(
            onPressed: () => context.push(Routes.search),
            icon: const Icon(Icons.search_rounded),
            tooltip: CatalogStrings.searchTitle,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _refresh(ref),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: AppSpacing.xl),
          children: <Widget>[
            const _HeroSection(),
            SectionHeader(
              title: CatalogStrings.shopByCategory,
              onSeeAll: () => context.push(Routes.shop),
            ),
            const _CategorySection(),
            SectionHeader(
              title: CatalogStrings.trendingNow,
              subtitle: CatalogStrings.trendingSubtitle,
              onSeeAll: () => context.push(Routes.shop),
            ),
            const _CuratedRail(section: _CuratedSection.trending),
            SectionHeader(
              title: CatalogStrings.featuredProducts,
              subtitle: CatalogStrings.featuredSubtitle,
              onSeeAll: () => context.push(Routes.shop),
            ),
            const _CuratedRail(section: _CuratedSection.featured),
          ],
        ),
      ),
    );
  }
}

/// Waits for a section's request and swallows its failure.
///
/// The section that owns the request renders its own error; the pull-to-
/// refresh spinner only needs to know when everything has settled, and one
/// failed section must not cut the other three short.
Future<void> _settle(Future<Object?> future) async {
  try {
    await future;
  } on Object {
    return;
  }
}

class _HeroSection extends ConsumerWidget {
  const _HeroSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<PromoBanner>> banners = ref.watch(
      activeBannersProvider,
    );

    return banners.when(
      loading: () => const SizedBox(height: heroHeight, child: AppLoading()),
      // A failed banner request still gets a hero — the page has to open with
      // something — plus one quiet line offering to try again.
      error: (Object error, StackTrace _) => Column(
        children: <Widget>[
          const HeroFallback(),
          InlineSectionError(
            error: error,
            onRetry: () => ref.invalidate(activeBannersProvider),
          ),
        ],
      ),
      data: (List<PromoBanner> data) =>
          data.isEmpty ? const HeroFallback() : BannerCarousel(banners: data),
    );
  }
}

class _CategorySection extends ConsumerWidget {
  const _CategorySection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncSection<List<Category>>(
      value: ref.watch(categoriesProvider),
      height: 64,
      stateHeight: 220,
      isEmpty: (List<Category> data) => data.isEmpty,
      empty: const AppEmptyState(
        title: CatalogStrings.noCategories,
        message: CatalogStrings.noCategoriesBody,
        icon: Icons.category_outlined,
      ),
      onRetry: () => ref.invalidate(categoriesProvider),
      builder: (BuildContext context, List<Category> data) =>
          CategoryShortcuts(categories: data),
    );
  }
}

enum _CuratedSection { trending, featured }

class _CuratedRail extends ConsumerWidget {
  const _CuratedRail({required this.section});

  final _CuratedSection section;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final FutureProvider<List<Product>> provider = switch (section) {
      _CuratedSection.trending => trendingProductsProvider,
      _CuratedSection.featured => featuredProductsProvider,
    };

    return AsyncSection<List<Product>>(
      value: ref.watch(provider),
      height: productRailHeight,
      isEmpty: (List<Product> data) => data.isEmpty,
      // Reached only when the whole catalogue is empty: the curation flags
      // are an override, not a filter, so an uncurated catalogue falls back
      // to newest-first server-side rather than returning nothing.
      empty: const AppEmptyState(
        title: CatalogStrings.emptyCatalogue,
        message: CatalogStrings.emptyCatalogueBody,
        icon: Icons.inventory_2_outlined,
      ),
      onRetry: () => ref.invalidate(provider),
      builder: (BuildContext context, List<Product> data) =>
          ProductRail(products: data),
    );
  }
}
