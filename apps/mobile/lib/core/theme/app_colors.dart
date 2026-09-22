import 'package:flutter/material.dart';

/// Brand tokens, lifted from `packages/config/tailwind.preset.js` so the app and
/// the storefront cannot drift apart.
///
/// NOTE: the blue is `#2E3192`, which is what the Tailwind preset actually ships
/// and what its comment marks as matching the Figma swatch. `CLAUDE.md` quotes
/// `#2A3182`; that value appears nowhere in the code and is wrong.
class AppColors {
  const AppColors._();

  static const Color brandBlue = Color(0xFF2E3192);
  static const Color brandRed = Color(0xFFE53935);
  static const Color brandDark = Color(0xFF1A1A2E);

  // Light
  static const Color lightBackground = Color(0xFFFFFFFF);
  static const Color lightSurface = Color(0xFFF7F7FA);
  static const Color lightBorder = Color(0xFFE4E4EC);
  static const Color lightMuted = Color(0xFF6B6B80);

  // Dark
  static const Color darkBackground = Color(0xFF121220);
  static const Color darkSurface = Color(0xFF1E1E32);
  static const Color darkBorder = Color(0xFF2E2E48);
  static const Color darkMuted = Color(0xFFA0A0B8);

  // Status — used by order timelines, stock badges and payment states.
  static const Color success = Color(0xFF2E7D32);
  static const Color warning = Color(0xFFED6C02);
  static const Color danger = brandRed;
  static const Color info = Color(0xFF0288D1);
}
