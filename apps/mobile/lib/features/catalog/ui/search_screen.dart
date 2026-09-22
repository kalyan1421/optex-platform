import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../catalog_strings.dart';
import '../state/product_list_controller.dart';
import 'widgets/product_list_view.dart';

/// `/search` — full-text search over active products.
///
/// The input is debounced by [_debounceDelay] before a term is committed.
/// That is the difference between one request per settled phrase and one per
/// keystroke; on the 3G connections SPEC-11 budgets for (search p75 under
/// 800ms) the second would queue requests faster than they return and the
/// results would visibly lag the box.
///
/// Three states, and the first of them is not "nothing": an untouched search
/// screen says what it is for rather than showing a blank page.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, this.initialQuery});

  /// `/search?q=<term>`, so a link can open results directly.
  final String? initialQuery;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  static const Duration _debounceDelay = Duration(milliseconds: 350);

  late final TextEditingController _input =
      TextEditingController(text: widget.initialQuery?.trim() ?? '');

  Timer? _debounce;

  /// The term actually queried, as opposed to what is currently typed.
  late String _committed = widget.initialQuery?.trim() ?? '';

  @override
  void dispose() {
    _debounce?.cancel();
    _input.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(_debounceDelay, () {
      if (!mounted) return;
      final String next = value.trim();
      if (next == _committed) return;
      setState(() => _committed = next);
    });
  }

  void _submit(String value) {
    _debounce?.cancel();
    final String next = value.trim();
    if (next == _committed) return;
    setState(() => _committed = next);
  }

  void _clear() {
    _debounce?.cancel();
    _input.clear();
    setState(() => _committed = '');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _input,
          autofocus: widget.initialQuery == null,
          textInputAction: TextInputAction.search,
          // The API rejects anything longer (F-19 capped `q` at 120), so the
          // field stops before the request does.
          maxLength: 120,
          decoration: InputDecoration(
            hintText: CatalogStrings.searchHint,
            counterText: '',
            prefixIcon: const Icon(Icons.search_rounded),
            suffixIcon: _input.text.isEmpty
                ? null
                : IconButton(
                    onPressed: _clear,
                    icon: const Icon(Icons.close_rounded),
                    tooltip: CatalogStrings.searchClear,
                  ),
          ),
          onChanged: (String value) {
            // Rebuilds for the clear button; the query itself is debounced.
            setState(() {});
            _onChanged(value);
          },
          onSubmitted: _submit,
        ),
      ),
      body: _committed.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: AppEmptyState(
                title: CatalogStrings.searchPrompt,
                message: CatalogStrings.searchPromptBody,
                icon: Icons.search_rounded,
              ),
            )
          : ProductListView(
              // Keyed by the term so a new search is a new list rather than
              // the previous one mutating under the customer.
              key: ValueKey<String>(_committed),
              provider: searchListProvider(ProductListId.search(_committed)),
              storageKey: 'search:$_committed',
              showToolbar: false,
              emptyTitle: CatalogStrings.searchNoResults,
              emptyMessage: CatalogStrings.searchNoResultsBody(_committed),
              unfilteredEmptyTitle: CatalogStrings.searchNoResults,
              unfilteredEmptyMessage: CatalogStrings.searchNoResultsBody(_committed),
              emptyIcon: Icons.search_off_rounded,
            ),
    );
  }
}
