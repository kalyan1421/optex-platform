/// A 4pt spacing scale. Feature code uses these rather than raw numbers so
/// density stays consistent across screens written by different people.
class AppSpacing {
  const AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;

  /// Minimum tap target. Below this, Material and HIG both consider a control
  /// inaccessible, and store review has been known to flag it.
  static const double minTapTarget = 48;
}
