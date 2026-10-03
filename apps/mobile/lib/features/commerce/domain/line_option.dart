/// A per-line product configuration — `cart_items.lens_option` /
/// `order_items.lens_option` in the schema, `lensOption` at the API boundary.
///
/// The column is free-form `jsonb` and the lens & coating configurator
/// (SPEC-07) has no schema yet, so this deliberately models the blob rather
/// than a fixed set of fields. Two things follow from that, and both are
/// SPEC-11 P2-1 requirements:
///
///   * Lines are keyed by product **and** option — the API already treats two
///     different `lens_option` values on the same product as separate cart
///     lines (`CartService.addItem` compares the serialised JSON), so the app
///     must never collapse them.
///   * Money is never derived from the product's list price. [priceKes] reads
///     an option surcharge if the server ever sends one, and every figure the
///     UI actually renders comes from the server's own line/cart totals.
///
/// Until SPEC-07 lands nothing in the app constructs one of these; the type
/// exists so that when it does, the cart, checkout and order screens need new
/// *copy*, not new *shapes*.
class LineOption {
  const LineOption({required this.values});

  /// The raw option object, passed through to the API untouched.
  final Map<String, dynamic> values;

  /// Parses the API's `lensOption`, which is `unknown | null`.
  ///
  /// Anything that is not a non-empty object — `null`, `{}`, a stray string —
  /// becomes `null`, so callers only have to handle "configured" or "not".
  static LineOption? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final Map<String, dynamic> values = <String, dynamic>{};
    raw.forEach((dynamic key, dynamic value) {
      values[key.toString()] = value;
    });
    return values.isEmpty ? null : LineOption(values: values);
  }

  Map<String, dynamic> toJson() => values;

  /// A per-unit surcharge for this configuration, when the server supplies one.
  ///
  /// Null today for every line, because no pricing exists server-side yet. It
  /// is read (rather than assumed to be zero) so the day it appears the cart
  /// shows it instead of silently under-reporting what a line costs.
  num? get priceKes {
    final dynamic raw =
        values['priceKes'] ?? values['price_kes'] ?? values['surchargeKes'];
    return raw is num ? raw : null;
  }

  /// Label/value pairs for display, with keys prettified from camelCase or
  /// snake_case. Nested structures are rendered compactly rather than dropped,
  /// so an unfamiliar option shape still shows the customer *something*.
  List<({String label, String value})> get entries {
    final List<({String label, String value})> out =
        <({String label, String value})>[];
    values.forEach((String key, dynamic value) {
      if (key == 'priceKes' || key == 'price_kes' || key == 'surchargeKes') {
        return;
      }
      final String text = _stringify(value);
      if (text.isEmpty) return;
      out.add((label: _prettify(key), value: text));
    });
    return out;
  }

  /// One-line summary, for tight spaces like an order-history row.
  String get summary =>
      entries.map((({String label, String value}) e) => e.value).join(' · ');

  static String _prettify(String key) {
    final String spaced = key
        .replaceAll('_', ' ')
        .replaceAllMapped(
          RegExp('([a-z0-9])([A-Z])'),
          (Match m) => '${m[1]} ${m[2]}',
        )
        .trim();
    if (spaced.isEmpty) return key;
    return spaced[0].toUpperCase() + spaced.substring(1).toLowerCase();
  }

  static String _stringify(dynamic value) {
    if (value == null) return '';
    if (value is String) return value.trim();
    if (value is num || value is bool) return value.toString();
    if (value is List) {
      return value.map(_stringify).where((String s) => s.isNotEmpty).join(', ');
    }
    if (value is Map) {
      return value.values
          .map(_stringify)
          .where((String s) => s.isNotEmpty)
          .join(', ');
    }
    return value.toString();
  }
}
