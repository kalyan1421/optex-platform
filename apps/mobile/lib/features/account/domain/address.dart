/// Mirrors `AddressRow` (`apps/api/src/modules/addresses/addresses.service.ts`).
///
/// The field names match `ShippingAddressDto` exactly — `name`, `phone`,
/// `address`, `city`, `county`, `postal` — so a saved row maps onto the
/// checkout payload with no translation. Responses are snake_case; request
/// bodies use `isDefault` (camelCase) and nothing else differs.
class Address {
  const Address({
    required this.id,
    required this.customerId,
    required this.name,
    required this.phone,
    required this.address,
    required this.city,
    required this.county,
    required this.isDefault,
    this.label,
    this.postal,
  });

  final String id;
  final String customerId;
  final String? label;
  final String name;
  final String phone;
  final String address;
  final String city;
  final String county;
  final String? postal;
  final bool isDefault;

  /// The address as one block of text, for a card body or a map query.
  String get formatted {
    final List<String> parts = <String>[
      address,
      city,
      county,
      if (postal != null && postal!.trim().isNotEmpty) postal!.trim(),
    ].map((String p) => p.trim()).where((String p) => p.isNotEmpty).toList();
    return parts.join(', ');
  }

  /// What to head the card with. A label is optional server-side, so fall back
  /// to the recipient rather than rendering a blank line.
  String get title {
    final String? l = label?.trim();
    return (l != null && l.isNotEmpty) ? l : name;
  }

  factory Address.fromJson(Map<String, dynamic> json) => Address(
        id: json['id'] as String,
        customerId: json['customer_id'] as String? ?? '',
        label: json['label'] as String?,
        name: json['name'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        address: json['address'] as String? ?? '',
        city: json['city'] as String? ?? '',
        county: json['county'] as String? ?? '',
        postal: json['postal'] as String?,
        isDefault: json['is_default'] as bool? ?? false,
      );
}

/// Body for `POST /addresses` and `PATCH /addresses/:id`.
///
/// The API runs `ValidationPipe` with `forbidNonWhitelisted: true`, so
/// [toJson] emits only the declared keys — an extra field is a 400, not a
/// silently-stripped no-op.
class AddressInput {
  const AddressInput({
    required this.name,
    required this.phone,
    required this.address,
    required this.city,
    required this.county,
    this.label,
    this.postal,
    this.isDefault = false,
  });

  final String? label;
  final String name;
  final String phone;
  final String address;
  final String city;
  final String county;
  final String? postal;
  final bool isDefault;

  /// Optional text fields are sent as explicit nulls when blank so that
  /// clearing a label or postal code on an edit actually clears it —
  /// `@IsOptional()` skips validation on null and the service writes it
  /// through, whereas omitting the key leaves the old value in place.
  Map<String, dynamic> toJson() => <String, dynamic>{
        'label': _orNull(label),
        'name': name.trim(),
        'phone': phone.trim(),
        'address': address.trim(),
        'city': city.trim(),
        'county': county.trim(),
        'postal': _orNull(postal),
        'isDefault': isDefault,
      };

  static String? _orNull(String? value) {
    final String? v = value?.trim();
    return (v == null || v.isEmpty) ? null : v;
  }

  factory AddressInput.from(Address a) => AddressInput(
        label: a.label,
        name: a.name,
        phone: a.phone,
        address: a.address,
        city: a.city,
        county: a.county,
        postal: a.postal,
        isDefault: a.isDefault,
      );
}
