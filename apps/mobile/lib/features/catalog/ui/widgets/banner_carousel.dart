import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../catalog_strings.dart';
import '../../domain/promo_banner.dart';
import 'product_image.dart';

/// Height of the home hero, banner or fallback. Both share it so the page
/// does not jump when the banner request resolves.
const double heroHeight = 280;

/// The hero carousel, driven by `GET /banners`.
///
/// Auto-advances like the storefront's, pauses while the user is dragging,
/// and stops entirely when the platform reports that animations are disabled.
class BannerCarousel extends StatefulWidget {
  const BannerCarousel({super.key, required this.banners});

  final List<PromoBanner> banners;

  @override
  State<BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<BannerCarousel> {
  static const Duration _interval = Duration(seconds: 5);

  final PageController _controller = PageController();
  Timer? _timer;
  int _index = 0;
  bool _paused = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _restartTimer();
  }

  @override
  void didUpdateWidget(covariant BannerCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.banners.length != widget.banners.length) _restartTimer();
  }

  void _restartTimer() {
    _timer?.cancel();
    final bool animationsOff = MediaQuery.disableAnimationsOf(context);
    if (widget.banners.length <= 1 || animationsOff) return;
    _timer = Timer.periodic(_interval, (_) => _advance());
  }

  void _advance() {
    if (_paused || !mounted || !_controller.hasClients) return;
    final int next = (_index + 1) % widget.banners.length;
    _controller.animateToPage(
      next,
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeInOut,
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: heroHeight,
      child: Listener(
        onPointerDown: (_) => _paused = true,
        onPointerUp: (_) => _paused = false,
        onPointerCancel: (_) => _paused = false,
        child: Stack(
          children: <Widget>[
            PageView.builder(
              controller: _controller,
              itemCount: widget.banners.length,
              onPageChanged: (int i) => setState(() => _index = i),
              itemBuilder: (BuildContext context, int i) => _BannerSlide(banner: widget.banners[i]),
            ),
            if (widget.banners.length > 1)
              Positioned(
                left: 0,
                right: 0,
                bottom: AppSpacing.md,
                child: _Dots(count: widget.banners.length, active: _index),
              ),
          ],
        ),
      ),
    );
  }
}

class _BannerSlide extends StatelessWidget {
  const _BannerSlide({required this.banner});

  final PromoBanner banner;

  void _open(BuildContext context) {
    final String? target = banner.targetUrl?.trim();
    if (target == null || target.isEmpty) return;

    // A server-supplied in-app path. Unknown paths land on the router's own
    // "Page not found" screen, which is the correct outcome for a banner that
    // points somewhere the app has not built yet.
    if (target.startsWith('/')) {
      context.push(target);
      return;
    }

    final Uri? uri = Uri.tryParse(target);
    if (uri == null) return;
    if (uri.scheme != 'http' && uri.scheme != 'https') return;
    unawaited(launchUrl(uri, mode: LaunchMode.externalApplication));
  }

  @override
  Widget build(BuildContext context) {
    final List<String> lines = banner.headlineLines;

    return GestureDetector(
      onTap: () => _open(context),
      child: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          ProductImage(url: banner.imageUrl, fit: BoxFit.cover, padding: 0),
          // A scrim, because banner artwork is arbitrary and white headline
          // text over a pale photo is unreadable.
          if (lines.isNotEmpty)
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomLeft,
                  end: Alignment.topRight,
                  colors: <Color>[
                    AppColors.brandDark.withValues(alpha: 0.72),
                    AppColors.brandDark.withValues(alpha: 0.12),
                  ],
                ),
              ),
            ),
          if (lines.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.xl,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  for (final String line in lines)
                    Text(
                      line,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.active});

  final int count;
  final int active;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: <Widget>[
        for (int i = 0; i < count; i++)
          Container(
            width: i == active ? 18 : 6,
            height: 6,
            margin: const EdgeInsets.symmetric(horizontal: 3),
            decoration: BoxDecoration(
              color: i == active ? Colors.white : Colors.white.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
      ],
    );
  }
}

/// What the home screen shows when there are no active banners.
///
/// The storefront does the same thing — `Hero.jsx` renders a static hero when
/// `listActiveBanners()` comes back empty — and it is the right call: an
/// `AppEmptyState` reading "no promotions" at the top of a shopping app tells
/// the customer nothing they wanted to know. This is the empty state; it just
/// happens to be a useful one.
class HeroFallback extends StatelessWidget {
  const HeroFallback({super.key});

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return SizedBox(
      height: heroHeight,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: <Color>[AppColors.brandBlue, AppColors.brandDark],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                CatalogStrings.heroHeadline,
                style: theme.textTheme.headlineSmall
                    ?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                CatalogStrings.heroSubtitle,
                style: theme.textTheme.bodyMedium
                    ?.copyWith(color: Colors.white.withValues(alpha: 0.88)),
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: () => context.push(Routes.shop),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.brandBlue,
                  minimumSize: const Size(0, AppSpacing.minTapTarget),
                ),
                child: const Text(CatalogStrings.heroCta),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
