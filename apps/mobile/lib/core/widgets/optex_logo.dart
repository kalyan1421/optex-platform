import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';

/// The OPTEX mark, from the same file the storefront serves.
///
/// Bundled rather than fetched so it renders on a cold start with no network
/// — it is the first thing on the login screen, which is exactly where the
/// connection is least likely to be ready.
///
/// The source is `apps/web/public/images/Logo.png`: a 448x372 raster whose
/// actual ink is 424x343. There is no vector original — `Logo.svg` in that
/// directory is a base64 PNG in an SVG wrapper — so this is upscaled, and a
/// true vector or a larger export would render more crisply at the sizes used
/// here and materially better on the app icon.
class OptexLogo extends StatelessWidget {
  const OptexLogo({super.key, this.height = 32, this.semanticLabel = 'OPTEX'});

  final double height;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final Widget mark = Image.asset(
      'assets/branding/logo.png',
      height: height,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
      semanticLabel: semanticLabel,
      // A missing asset must not take the screen down with it — the logo is
      // decoration, and the wordmark carries the same meaning.
      errorBuilder: (BuildContext context, Object error, StackTrace? stack) =>
          _Wordmark(height: height),
    );

    // The mark is navy-on-transparent, which all but disappears on the dark
    // surface. A white plate keeps brand colour rather than recolouring the
    // logo, which would misrepresent it.
    if (Theme.of(context).brightness == Brightness.dark) {
      return Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
        ),
        child: mark,
      );
    }
    return mark;
  }
}

class _Wordmark extends StatelessWidget {
  const _Wordmark({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Text(
      'OPTEX',
      style: theme.textTheme.titleLarge?.copyWith(
        fontSize: height * 0.6,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.5,
        color: theme.brightness == Brightness.dark
            ? Colors.white
            : theme.colorScheme.primary,
      ),
    );
  }
}
