import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/async_views.dart';
import '../../catalog_strings.dart';
import '../../domain/product_filters.dart';
import '../../state/product_list_controller.dart';
import 'filter_sheet.dart';
import 'product_card.dart';

/// A paginated product grid with filters, sort and every async state.
///
/// Shared by `/shop`, `/category/:slug` and `/search`, because they are the
/// same list reading different endpoints — and because three copies of
/// pagination is three places for the scroll position to be lost.
///
/// **Pagination appends.** Page two is added below page one rather than
/// replacing it, so the `ScrollController` keeps its offset and the items the
/// customer was looking at do not move. Returning from a product screen finds
/// the list exactly as it was, because the list's state lives in a provider
/// that outlives the route (see `browseListProvider`).
///
/// **Filtering is a round trip.** Every control here mutates the controller's
/// `ProductFilters` and re-queries from page one. Nothing is narrowed in the
/// client over the page that happens to be loaded.
class ProductListView extends ConsumerStatefulWidget {
  const ProductListView({
    super.key,
    required this.provider,
    required this.storageKey,
    this.showToolbar = true,
    this.lockedCategorySlug,
    this.header,
    this.emptyTitle = CatalogStrings.noProducts,
    this.emptyMessage = CatalogStrings.noProductsBody,
    this.unfilteredEmptyTitle = CatalogStrings.emptyCatalogue,
    this.unfilteredEmptyMessage = CatalogStrings.emptyCatalogueBody,
    this.emptyIcon = Icons.search_off_rounded,
  });

  /// One entry of [browseListProvider] or [searchListProvider].
  final NotifierProvider<ProductListController, ProductListState> provider;

  /// Distinguishes this list's scroll offset from any other's.
  final String storageKey;

  final bool showToolbar;

  /// Set on a category screen: the category is the screen, so it is not
  /// offered as a filter and "Clear all" does not remove it.
  final String? lockedCategorySlug;

  /// Rendered above the toolbar. Scrolls away with the content.
  final Widget? header;

  /// Shown when the customer's own filters produced nothing.
  final String emptyTitle;
  final String emptyMessage;

  /// Shown when there is nothing to show and no filter is to blame — an
  /// empty catalogue, an empty category, a search with no hits. A different
  /// message, because "try widening your search" is useless advice when the
  /// customer has not narrowed anything.
  final String unfilteredEmptyTitle;
  final String unfilteredEmptyMessage;

  final IconData emptyIcon;

  @override
  ConsumerState<ProductListView> createState() => _ProductListViewState();
}

class _ProductListViewState extends ConsumerState<ProductListView> {
  final ScrollController _scrollController = ScrollController();

  /// How close to the bottom the next page starts loading. Roughly two rows,
  /// which on a mid-range Android over 3G is about the time one request takes.
  static const double _loadMoreThreshold = 600;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    // Deferred by a microtask so the controller's first state write lands
    // after this widget's first build rather than during it.
    Future<void>.microtask(() {
      if (!mounted) return;
      unawaited(ref.read(widget.provider.notifier).ensureLoaded());
    });
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final ScrollPosition position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - _loadMoreThreshold) {
      unawaited(ref.read(widget.provider.notifier).loadMore());
    }
  }

  Future<void> _openFilters(ProductFilters current) async {
    final ProductFilters? next = await showProductFilterSheet(
      context,
      initial: current,
      lockedCategorySlug: widget.lockedCategorySlug,
    );
    if (next == null || !mounted) return;
    ref.read(widget.provider.notifier).applyFilters(next);
    _jumpToTop();
  }

  void _setSort(ProductSortOption sort) {
    ref.read(widget.provider.notifier).setSort(sort);
    _jumpToTop();
  }

  /// A new result set starts at the top. Keeping the old offset would land
  /// the customer in the middle of products they have not seen.
  void _jumpToTop() {
    if (_scrollController.hasClients) _scrollController.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) {
    final ProductListState state = ref.watch(widget.provider);

    return RefreshIndicator(
      onRefresh: () => ref.read(widget.provider.notifier).refresh(),
      child: CustomScrollView(
        key: PageStorageKey<String>(widget.storageKey),
        controller: _scrollController,
        // Keeps pull-to-refresh and the error/empty states reachable even
        // when the content is shorter than the viewport.
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: <Widget>[
          if (widget.header != null) SliverToBoxAdapter(child: widget.header),
          if (widget.showToolbar)
            SliverToBoxAdapter(
              child: _Toolbar(
                state: state,
                lockedCategorySlug: widget.lockedCategorySlug,
                onOpenFilters: () => _openFilters(state.filters),
                onSort: _setSort,
              ),
            ),
          ..._body(state),
        ],
      ),
    );
  }

  List<Widget> _body(ProductListState state) {
    if (state.isLoadingFirstPage) {
      return const <Widget>[
        SliverFillRemaining(hasScrollBody: false, child: AppLoading()),
      ];
    }

    if (state.error != null) {
      return <Widget>[
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppErrorView(
            error: state.error!,
            onRetry: () => ref.read(widget.provider.notifier).refresh(),
          ),
        ),
      ];
    }

    if (state.isEmpty) {
      // A category the screen locked is not a filter the customer applied, so
      // clearing it is not advice worth offering.
      final bool filtered =
          state.filters.activeCount - (widget.lockedCategorySlug != null ? 1 : 0) > 0;
      return <Widget>[
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppEmptyState(
            title: filtered ? widget.emptyTitle : widget.unfilteredEmptyTitle,
            message: filtered ? widget.emptyMessage : widget.unfilteredEmptyMessage,
            icon: widget.emptyIcon,
            action: filtered
                ? OutlinedButton(
                    onPressed: () {
                      ref.read(widget.provider.notifier).clearFilters();
                      _jumpToTop();
                    },
                    child: const Text(CatalogStrings.clearAll),
                  )
                : null,
          ),
        ),
      ];
    }

    return <Widget>[
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        sliver: SliverGrid(
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 240,
            mainAxisSpacing: AppSpacing.sm + AppSpacing.xs,
            crossAxisSpacing: AppSpacing.sm + AppSpacing.xs,
            childAspectRatio: 0.58,
          ),
          delegate: SliverChildBuilderDelegate(
            (BuildContext context, int index) => ProductCard(product: state.items[index]),
            childCount: state.items.length,
          ),
        ),
      ),
      SliverToBoxAdapter(
        child: _Footer(
          state: state,
          onRetry: () => unawaited(ref.read(widget.provider.notifier).retryLoadMore()),
        ),
      ),
    ];
  }
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.state,
    required this.lockedCategorySlug,
    required this.onOpenFilters,
    required this.onSort,
  });

  final ProductListState state;
  final String? lockedCategorySlug;
  final VoidCallback onOpenFilters;
  final ValueChanged<ProductSortOption> onSort;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    // A category the screen has locked is not something the customer chose,
    // so it is not counted as an active filter.
    final int activeFilters =
        state.filters.activeCount - (lockedCategorySlug != null ? 1 : 0);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              OutlinedButton.icon(
                onPressed: onOpenFilters,
                // The themed default is `Size.fromHeight`, i.e. infinite
                // width — fine for a stacked form, fatal inside a Row.
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, AppSpacing.minTapTarget),
                ),
                icon: const Icon(Icons.tune_rounded, size: 18),
                label: Text(
                  activeFilters > 0
                      ? '${CatalogStrings.filters} ($activeFilters)'
                      : CatalogStrings.filters,
                ),
              ),
              const Spacer(),
              PopupMenuButton<ProductSortOption>(
                initialValue: state.filters.sort,
                onSelected: onSort,
                tooltip: CatalogStrings.sortBy,
                itemBuilder: (BuildContext context) => <PopupMenuEntry<ProductSortOption>>[
                  for (final ProductSortOption option in ProductSortOption.values)
                    PopupMenuItem<ProductSortOption>(
                      value: option,
                      child: Text(option.label),
                    ),
                ],
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.sm + AppSpacing.xs,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Flexible(
                        child: Text(
                          state.filters.sort.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                      const Icon(Icons.expand_more_rounded, size: 18),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (state.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                CatalogStrings.showingCount(state.items.length, state.total),
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
              ),
            ),
        ],
      ),
    );
  }
}

/// What sits under the last row: a spinner, a retry for the page that failed,
/// or an end-of-list marker. Never nothing — an infinite list that simply
/// stops is indistinguishable from one that broke.
class _Footer extends StatelessWidget {
  const _Footer({required this.state, required this.onRetry});

  final ProductListState state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    if (state.isLoadingMore) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Center(
          child: SizedBox(
            width: AppSpacing.lg,
            height: AppSpacing.lg,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    if (state.loadMoreError != null) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          children: <Widget>[
            Text(
              state.loadMoreError!.message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              onPressed: onRetry,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, AppSpacing.minTapTarget),
              ),
              child: const Text(CatalogStrings.retry),
            ),
          ],
        ),
      );
    }

    if (state.hasMore) return const SizedBox(height: AppSpacing.lg);

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Center(
        child: Text(
          CatalogStrings.endOfList,
          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
        ),
      ),
    );
  }
}
