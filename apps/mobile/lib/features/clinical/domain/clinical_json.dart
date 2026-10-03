/// Tolerant JSON coercion shared by every clinical model.
///
/// The API returns these rows straight from PostgREST, and Postgres `numeric`
/// columns do not always arrive as JSON numbers — `prescriptions.e2e-spec.ts`
/// itself asserts with `Number(res.body.sphere_od)` rather than comparing the
/// raw value, which is the tell. Parsing defensively here means a `"-1.25"`
/// cannot silently become null and blank out a prescription on screen.
library;

/// A `num` or numeric `String` as a double, or null for anything else.
double? asDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value.trim());
  return null;
}

/// A `num` or numeric `String` as an int, truncating a fractional double.
int? asInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) {
    final String text = value.trim();
    return int.tryParse(text) ?? double.tryParse(text)?.toInt();
  }
  return null;
}

/// A non-empty trimmed string, or null. Empty strings become null so callers
/// can use a single `?? fallback` rather than also testing for blankness.
String? asText(dynamic value) {
  if (value == null) return null;
  final String text = value.toString().trim();
  return text.isEmpty ? null : text;
}

/// An ISO-8601 timestamp as a UTC [DateTime], or null when unparseable.
///
/// Always normalised to UTC: the API stores `timestamptz` and serialises with
/// a `Z`, and leaving a parsed value in device-local time is how a Nairobi
/// slot ends up rendering an hour out on a phone set to another zone.
DateTime? asUtcTime(dynamic value) {
  final String? text = asText(value);
  if (text == null) return null;
  return DateTime.tryParse(text)?.toUtc();
}

/// A JSON array as a list of strings, dropping blanks. Never null — the
/// `eye_records.conditions` column is `not null default '{}'`.
List<String> asTextList(dynamic value) {
  if (value is! List) return const <String>[];
  return value
      .map((dynamic item) => asText(item))
      .whereType<String>()
      .toList(growable: false);
}

/// Parses a decimal form cell.
///
/// Returns `ok: false` for text that is present but unreadable, so the UI can
/// say so rather than silently discarding a typo in a clinical value — the
/// difference between "you left this blank" and "we ignored what you wrote".
/// A blank cell is `ok: true` with a null value, because blank is a valid,
/// expected answer on both the intake form and the upload measurements.
({bool ok, double? value}) parseDecimalCell(String raw, {int decimals = 2}) {
  final String text = raw.trim();
  if (text.isEmpty) return (ok: true, value: null);
  final double? parsed = double.tryParse(text);
  if (parsed == null) return (ok: false, value: null);
  // Rounded to the column's precision so a value the customer typed at three
  // decimals cannot be rejected by `@IsNumber({ maxDecimalPlaces: 2 })`.
  return (ok: true, value: double.parse(parsed.toStringAsFixed(decimals)));
}

/// Parses an integer form cell (axis), with the same present-but-unreadable
/// rule as [parseDecimalCell].
({bool ok, int? value}) parseIntCell(String raw) {
  final String text = raw.trim();
  if (text.isEmpty) return (ok: true, value: null);
  final int? parsed = int.tryParse(text);
  if (parsed == null) return (ok: false, value: null);
  return (ok: true, value: parsed);
}
