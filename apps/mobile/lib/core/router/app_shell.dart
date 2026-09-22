import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/commerce/state/cart_providers.dart';
import '../theme/app_spacing.dart';

/// The five-tab shell every primary screen sits inside.
///
/// Five rather than four: Care groups appointments, prescriptions and the
/// eye-care intake, which are the reason an optician's app differs from a
/// generic eyewear store. Under a four-tab scheme they land two taps deep
/// inside Account, and SPEC-11's G2 (200 prescription uploads in 90 days,
/// against a baseline of zero) does not survive being buried.
///
/// Search is not a tab — it lives in the Home app bar. Notifications are not a
/// tab either: a badge-bearing tab for a notification feed is an engagement
/// pattern, not a navigation one.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});

  /// Provided by `StatefulShellRoute.indexedStack`. Each branch keeps its own
  /// Navigator, which is what preserves per-tab back stacks and scroll
  /// position — so drilling into a product inside Shop leaves Home untouched.
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int cartCount = ref.watch(cartItemCountProvider);

    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (int index) => _onTap(context, index),
        // Always visible. Icon-only tabs assume a vocabulary a first-time
        // customer has not learned yet, and they are worse for screen readers.
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        height: 68,
        destinations: <NavigationDestination>[
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view_rounded),
            label: 'Shop',
          ),
          const NavigationDestination(
            icon: Icon(Icons.remove_red_eye_outlined),
            selectedIcon: Icon(Icons.remove_red_eye_rounded),
            label: 'Care',
          ),
          NavigationDestination(
            // The badge appears only when there is something in the cart. An
            // empty cart shows the tab with no badge rather than hiding it:
            // hiding would shift every tab's position and break the muscle
            // memory the bar exists to build.
            icon: _CartIcon(count: cartCount, selected: false),
            selectedIcon: _CartIcon(count: cartCount, selected: true),
            label: 'Cart',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Account',
          ),
        ],
      ),
    );
  }

  /// Tapping the tab you are already on pops that branch back to its root —
  /// the behaviour every major app has trained people to expect, and the only
  /// way out of a deep stack without repeated back presses.
  void _onTap(BuildContext context, int index) =>
      shell.goBranch(index, initialLocation: index == shell.currentIndex);
}

class _CartIcon extends StatelessWidget {
  const _CartIcon({required this.count, required this.selected});

  final int count;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final Icon icon = Icon(
      selected ? Icons.shopping_bag_rounded : Icons.shopping_bag_outlined,
    );
    if (count <= 0) return icon;

    return Badge(
      // Capped so a large cart cannot widen the badge past the tab.
      label: Text(count > 99 ? '99+' : '$count'),
      // Spelled out for screen readers: "4" alone announces nothing useful.
      child: Semantics(
        label: 'Cart, $count ${count == 1 ? 'item' : 'items'}',
        child: icon,
      ),
    );
  }
}

/// Minimum height the shell reserves, for screens that need to inset content
/// above the bar (a sticky checkout footer, for instance).
const double kAppShellBarHeight = 68 + AppSpacing.sm;
