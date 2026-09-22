import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/async_views.dart';
import '../../catalog_strings.dart';
import '../../domain/category.dart';
import '../../domain/product_filters.dart';
import '../../state/catalog_providers.dart';

/// Opens the filter sheet and resolves with the chosen filters, or null when
/// the user backed out.
///
/// [lockedCategorySlug] is set on a category landing screen: that screen's
/// whole identity is the category, so it is not offered as something to
/// change.
Future<ProductFilters?> showProductFilterSheet(
  BuildContext context, {
  required ProductFilters initial,
  String? lockedCategorySlug,
}) {
  return showModalBottomSheet<ProductFilters>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (BuildContext context) => _FilterSheet(
      initial: initial,
      lockedCategorySlug: lockedCategorySlug,
    ),
  );
}

class _FilterSheet extends ConsumerStatefulWidget {
  const _FilterSheet({required this.initial, this.lockedCategorySlug});

  final ProductFilters initial;
  final String? lockedCategorySlug;

  @override
  ConsumerState<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<_FilterSheet> {
  late ProductFilters _draft = widget.initial;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final AsyncValue<List<Category>> categories = ref.watch(categoriesProvider);
    final AsyncValue<CatalogFacets> facets = ref.watch(catalogFacetsProvider);

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (BuildContext context, ScrollController scrollController) => Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    CatalogStrings.filters,
                    style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(
                    () => _draft = _draft.cleared(keepCategorySlug: widget.lockedCategorySlug),
                  ),
                  child: const Text(CatalogStrings.clearAll),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.lg,
              ),
              children: <Widget>[
                if (widget.lockedCategorySlug == null)
                  _CategoryFacet(
                    categories: categories,
                    selectedSlug: _draft.categorySlug,
                    onSelected: (String? slug) =>
                        setState(() => _draft = _draft.copyWith(categorySlug: slug)),
                    onRetry: () => ref.invalidate(categoriesProvider),
                  ),
                _FacetBlock<PriceBand>(
                  title: CatalogStrings.filterPrice,
                  options: PriceBand.all,
                  labelOf: (PriceBand b) => b.label,
                  isSelected: (PriceBand b) => _draft.priceBand.label == b.label,
                  onSelected: (PriceBand b) =>
                      setState(() => _draft = _draft.withPriceBand(b)),
                ),
                ..._stringFacets(facets),
                const SizedBox(height: AppSpacing.md),
                Text(
                  CatalogStrings.facetSampleNote,
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(_draft),
                child: const Text(CatalogStrings.apply),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// The four facets that have no authoritative source — see
  /// [CatalogFacets]. A facet with nothing in it is omitted rather than shown
  /// empty, matching the storefront's "`All` plus one value filters nothing"
  /// rule.
  List<Widget> _stringFacets(AsyncValue<CatalogFacets> facets) {
    return facets.when(
      loading: () => const <Widget>[
        SizedBox(height: 96, child: AppLoading()),
      ],
      error: (Object error, StackTrace _) => <Widget>[
        SizedBox(
          height: 140,
          child: AppErrorView(
            error: error,
            onRetry: () => ref.invalidate(catalogFacetsProvider),
          ),
        ),
      ],
      data: (CatalogFacets data) => <Widget>[
        if (data.brands.isNotEmpty)
          _FacetBlock<String>(
            title: CatalogStrings.filterBrand,
            options: <String>[...data.brands],
            labelOf: (String v) => v,
            isSelected: (String v) => _draft.brand == v,
            onSelected: (String v) => setState(
              () => _draft = _draft.copyWith(brand: _draft.brand == v ? null : v),
            ),
            onCleared: () => setState(() => _draft = _draft.copyWith(brand: null)),
            isAny: _draft.brand == null,
          ),
        if (data.shapes.isNotEmpty)
          _FacetBlock<String>(
            title: CatalogStrings.filterShape,
            options: <String>[...data.shapes],
            labelOf: (String v) => v,
            isSelected: (String v) => _draft.shape == v,
            onSelected: (String v) => setState(
              () => _draft = _draft.copyWith(shape: _draft.shape == v ? null : v),
            ),
            onCleared: () => setState(() => _draft = _draft.copyWith(shape: null)),
            isAny: _draft.shape == null,
          ),
        if (data.genders.isNotEmpty)
          _FacetBlock<String>(
            title: CatalogStrings.filterGender,
            options: <String>[...data.genders],
            labelOf: (String v) => v,
            isSelected: (String v) => _draft.gender == v,
            onSelected: (String v) => setState(
              () => _draft = _draft.copyWith(gender: _draft.gender == v ? null : v),
            ),
            onCleared: () => setState(() => _draft = _draft.copyWith(gender: null)),
            isAny: _draft.gender == null,
          ),
        if (data.materials.isNotEmpty)
          _FacetBlock<String>(
            title: CatalogStrings.filterMaterial,
            options: <String>[...data.materials],
            labelOf: (String v) => v,
            isSelected: (String v) => _draft.material == v,
            onSelected: (String v) => setState(
              () => _draft = _draft.copyWith(material: _draft.material == v ? null : v),
            ),
            onCleared: () => setState(() => _draft = _draft.copyWith(material: null)),
            isAny: _draft.material == null,
          ),
      ],
    );
  }
}

class _CategoryFacet extends StatelessWidget {
  const _CategoryFacet({
    required this.categories,
    required this.selectedSlug,
    required this.onSelected,
    required this.onRetry,
  });

  final AsyncValue<List<Category>> categories;
  final String? selectedSlug;
  final ValueChanged<String?> onSelected;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return categories.when(
      loading: () => const SizedBox(height: 96, child: AppLoading()),
      error: (Object error, StackTrace _) =>
          SizedBox(height: 140, child: AppErrorView(error: error, onRetry: onRetry)),
      data: (List<Category> data) {
        if (data.isEmpty) return const SizedBox.shrink();
        return _FacetBlock<Category>(
          title: CatalogStrings.filterCategory,
          options: data,
          labelOf: (Category c) => c.name,
          isSelected: (Category c) => selectedSlug == c.slug,
          onSelected: (Category c) => onSelected(selectedSlug == c.slug ? null : c.slug),
          onCleared: () => onSelected(null),
          isAny: selectedSlug == null,
        );
      },
    );
  }
}

/// One facet: a title and a wrap of single-select chips.
///
/// When [onCleared] is supplied the block leads with an "Any" chip, so
/// clearing one facet does not mean hunting for the selected chip to tap it
/// off again.
class _FacetBlock<T> extends StatelessWidget {
  const _FacetBlock({
    required this.title,
    required this.options,
    required this.labelOf,
    required this.isSelected,
    required this.onSelected,
    this.onCleared,
    this.isAny = false,
  });

  final String title;
  final List<T> options;
  final String Function(T) labelOf;
  final bool Function(T) isSelected;
  final ValueChanged<T> onSelected;
  final VoidCallback? onCleared;
  final bool isAny;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(title, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: <Widget>[
              if (onCleared != null)
                ChoiceChip(
                  label: const Text(CatalogStrings.filterAny),
                  selected: isAny,
                  onSelected: (_) => onCleared!(),
                ),
              for (final T option in options)
                ChoiceChip(
                  label: Text(labelOf(option)),
                  selected: isSelected(option),
                  onSelected: (_) => onSelected(option),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
