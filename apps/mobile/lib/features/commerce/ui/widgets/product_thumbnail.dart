import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Square product image with a neutral placeholder.
///
/// A missing image is the normal case for a freshly-added SKU, so it renders
/// as a quiet placeholder rather than a broken-image glyph.
class ProductThumbnail extends StatelessWidget {
  const ProductThumbnail({super.key, this.imageUrl, this.size = 72});

  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Widget placeholder = Container(
      height: size,
      width: size,
      color: theme.colorScheme.surfaceContainerHighest,
      child: Icon(
        Icons.visibility_outlined,
        color: theme.colorScheme.outline,
        size: size * 0.35,
      ),
    );

    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: (imageUrl == null || imageUrl!.isEmpty)
          ? placeholder
          : CachedNetworkImage(
              imageUrl: imageUrl!,
              height: size,
              width: size,
              fit: BoxFit.cover,
              placeholder: (BuildContext context, String url) => placeholder,
              errorWidget: (BuildContext context, String url, Object error) =>
                  placeholder,
            ),
    );
  }
}
