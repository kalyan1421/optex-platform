import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/money.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/wishlist_item.dart';
import '../state/wishlist_providers.dart';

/// Saved products (P1-1).
///
/// There is no "move to cart" here. The cart lives in another feature slice
/// that is being built in parallel, and reaching across slices to call it
/// would couple the two; tapping a card opens the PDP, which owns add-to-cart
/// already. Flagged in the report rather than stubbed.
class WishlistScreen extends ConsumerWidget {
  const WishlistScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<WishlistItem>> wishlist = ref.watch(wishlistProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Wishlist')),
      body: wishlist.when(
        loading: () => const AppLoading(label: 'Loading your saved frames…'),
        error: (Object error, StackTrace _) => AppErrorView(
          error: error,
          onRetry: () => ref.read(wishlistProvider.notifier).refresh(),
        ),
        data: (List<WishlistItem> items) {
          if (items.isEmpty) {
            return AppEmptyState(
              title: 'Nothing saved yet',
              message: 'Tap the heart on any pair of frames to keep it here '
                  'for later.',
              icon: Icons.favorite_border_rounded,
              action: FilledButton.icon(
                onPressed: () => context.go(Routes.shop),
                icon: const Icon(Icons.search_rounded),
                label: const Text('Browse frames'),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(wishlistProvider.notifier).refresh(),
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
              itemBuilder: (BuildContext context, int index) =>
                  _WishlistCard(item: items[index]),
            ),
          );
        },
      ),
    );
  }
}

class _WishlistCard extends ConsumerWidget {
  const _WishlistCard({required this.item});

  final WishlistItem item;

  Future<void> _remove(BuildContext context, WidgetRef ref) async {
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(wishlistProvider.notifier).remove(item.productId);
      messenger.showSnackBar(
        SnackBar(
          content: Text('${item.product.name} removed'),
          action: SnackBarAction(
            label: 'Undo',
            // Safe to fire and forget: `POST /wishlist/:id` is idempotent, so
            // an undo that arrives twice (or after a manual re-save) is a
            // no-op rather than a duplicate row.
            onPressed: () => ref.read(wishlistProvider.notifier).add(item.productId),
          ),
        ),
      );
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final WishlistProduct product = item.product;
    final bool unavailable = !product.isActive;

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: product.slug.isEmpty
            ? null
            : () => context.push(Routes.productOf(product.slug)),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.sm + AppSpacing.xs),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _Thumbnail(url: product.image, dimmed: unavailable),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    if (product.brand != null && product.brand!.isNotEmpty)
                      Text(
                        product.brand!.toUpperCase(),
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.outline,
                          letterSpacing: 0.8,
                        ),
                      ),
                    Text(
                      product.name,
                      style: theme.textTheme.bodyLarge
                          ?.copyWith(fontWeight: FontWeight.w600),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      formatKes(product.priceKes),
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: unavailable
                            ? theme.colorScheme.outline
                            : theme.colorScheme.primary,
                      ),
                    ),
                    if (unavailable) ...<Widget>[
                      const SizedBox(height: AppSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.error.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'No longer available',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.error,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              IconButton(
                onPressed: () => _remove(context, ref),
                icon: const Icon(Icons.favorite_rounded),
                color: theme.colorScheme.secondary,
                tooltip: 'Remove from wishlist',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Thumbnail extends StatelessWidget {
  const _Thumbnail({required this.url, required this.dimmed});

  final String? url;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    final Widget placeholder = Container(
      height: 84,
      width: 84,
      color: theme.colorScheme.surfaceContainerHighest,
      alignment: Alignment.center,
      child: Icon(Icons.visibility_outlined, color: theme.colorScheme.outline),
    );

    final Widget image = (url == null || url!.isEmpty)
        ? placeholder
        : CachedNetworkImage(
            imageUrl: url!,
            height: 84,
            width: 84,
            fit: BoxFit.contain,
            placeholder: (BuildContext context, String _) => placeholder,
            errorWidget: (BuildContext context, String _, Object _) => placeholder,
          );

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Opacity(opacity: dimmed ? 0.5 : 1, child: image),
    );
  }
}
