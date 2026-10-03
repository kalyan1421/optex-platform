/// Tolerant JSON readers shared by every catalog model.
///
/// The API types catalogue rows loosely (`Record<string, unknown>` in
/// `products.service.ts`), and PostgREST will happily hand back a numeric
/// column as either `int` or `double` depending on the row. Parsing through
/// these readers means one bad column degrades to a default instead of
/// throwing a `TypeError` deep inside a list builder, where the failure would
/// surface as a blank screen rather than an error state.
library;

/// Reads a string, treating an absent, null or non-string value as null.
String? asStringOrNull(Object? value) {
  if (value is String) {
    final String trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
  return null;
}

/// Reads a string, falling back to [fallback] when the value is unusable.
String asString(Object? value, {String fallback = ''}) =>
    asStringOrNull(value) ?? fallback;

/// Reads any JSON number (int or double) as a [num].
num? asNumOrNull(Object? value) {
  if (value is num) return value;
  if (value is String) return num.tryParse(value);
  return null;
}

/// Reads a number, falling back to [fallback].
num asNum(Object? value, {num fallback = 0}) => asNumOrNull(value) ?? fallback;

/// Reads an integer, tolerating a double or a numeric string.
int? asIntOrNull(Object? value) => asNumOrNull(value)?.toInt();

/// Reads an integer, falling back to [fallback].
int asInt(Object? value, {int fallback = 0}) => asIntOrNull(value) ?? fallback;

/// Reads a double, tolerating an int or a numeric string.
double? asDoubleOrNull(Object? value) => asNumOrNull(value)?.toDouble();

/// Reads a boolean, tolerating the `'true'` / `'false'` strings PostgREST
/// sometimes produces for generated columns.
bool asBool(Object? value, {bool fallback = false}) {
  if (value is bool) return value;
  if (value is String) return value.toLowerCase() == 'true';
  return fallback;
}

/// Reads a list of strings, dropping anything that is not a usable string.
List<String> asStringList(Object? value) {
  if (value is! List) return const <String>[];
  return value.map(asStringOrNull).whereType<String>().toList(growable: false);
}

/// Reads a list of JSON objects out of a decoded response body.
List<Map<String, dynamic>> asObjectList(Object? value) {
  if (value is! List) return const <Map<String, dynamic>>[];
  return value.whereType<Map<String, dynamic>>().toList(growable: false);
}
