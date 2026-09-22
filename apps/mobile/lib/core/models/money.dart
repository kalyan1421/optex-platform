import 'package:intl/intl.dart';

/// Kenyan shilling formatting.
///
/// Mirrors `formatKes` in `packages/ui` — including its NaN/null tolerance,
/// which exists because a half-loaded price rendering as "KSh NaN" is worse
/// than rendering as "KSh 0".
String formatKes(num? amount, {bool withDecimals = false}) {
  final num value = (amount == null || (amount is double && amount.isNaN)) ? 0 : amount;
  final NumberFormat f = NumberFormat.currency(
    locale: 'en_KE',
    symbol: 'KSh ',
    decimalDigits: withDecimals ? 2 : 0,
  );
  return f.format(value);
}
