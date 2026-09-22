import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../catalog_strings.dart';

/// A product photograph, or an honest stand-in for one.
///
/// Three states, because a catalogue image can fail in three ways: there is
/// no URL at all (an unuploaded seed row), the URL is still downloading, or
/// the download failed. None of them may render as a broken-image glyph or an
/// unbounded blank, so each gets a deliberate placeholder.
///
/// `BoxFit.contain` rather than `cover`: these are frames photographed on
/// white, and cropping a pair of glasses to fill a square is how you lose the
/// temples.
class ProductImage extends StatelessWidget {
  const ProductImage({
    super.key,
    required this.url,
    this.fit = BoxFit.contain,
    this.padding = AppSpacing.sm,
    this.showLabelOnError = false,
  });

  final String? url;
  final BoxFit fit;
  final double padding;

  /// Whether the failure state spells out why it is empty. On a small grid
  /// tile the icon alone is clearer; on a full-bleed gallery it is not.
  final bool showLabelOnError;

  @override
  Widget build(BuildContext context) {
    final String? source = url;
    if (source == null || source.isEmpty) {
      return _Fallback(showLabel: showLabelOnError, icon: Icons.visibility_outlined);
    }

    return CachedNetworkImage(
      imageUrl: source,
      fit: fit,
      // Keeps the crossfade from flashing white over the placeholder.
      fadeInDuration: const Duration(milliseconds: 180),
      fadeOutDuration: const Duration(milliseconds: 120),
      imageBuilder: (BuildContext context, ImageProvider<Object> image) => Padding(
        padding: EdgeInsets.all(padding),
        child: Image(image: image, fit: fit),
      ),
      placeholder: (BuildContext context, String _) => const _Skeleton(),
      errorWidget: (BuildContext context, String url, Object error) =>
          _Fallback(showLabel: showLabelOnError, icon: Icons.image_not_supported_outlined),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    return ColoredBox(
      color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
      child: const Center(
        child: SizedBox(
          width: AppSpacing.lg,
          height: AppSpacing.lg,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.showLabel, required this.icon});

  final bool showLabel;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool isDark = theme.brightness == Brightness.dark;
    return ColoredBox(
      color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: AppSpacing.xl, color: theme.colorScheme.outline),
            if (showLabel) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              Text(
                CatalogStrings.imageUnavailable,
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
