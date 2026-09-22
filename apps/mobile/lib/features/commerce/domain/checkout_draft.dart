/// Delivery vs. branch pickup (`CheckoutDeliveryOption`).
///
/// The fee is the server's: `place_order` charges a flat KES 300 for delivery
/// and nothing for pickup. It is not mirrored here, because a second copy of a
/// price is a second thing to be wrong.
enum DeliveryOption {
  delivery('delivery', 'Deliver to me'),
  pickup('pickup', 'Collect from a branch');

  const DeliveryOption(this.wire, this.label);

  /// The exact string `CheckoutDto` expects.
  final String wire;
  final String label;
}

/// How the order will be paid for.
///
/// **Cash on delivery is deliberately absent.** The API withdrew it
/// (`CheckoutPaymentMethod` in `apps/api/src/modules/orders/dto/checkout.dto.ts`
/// lists only `mpesa` and `pesapal`, and `OrdersService.checkout` repeats the
/// rejection as a backstop), so offering it in the app would produce a 400 at
/// the last step of a filled-in checkout. The Postgres enum still carries `cod`
/// for historical orders, which is why the order-reading side of this slice
/// tolerates it — see [PaymentMethodOption.labelForWire].
enum PaymentMethodOption {
  mpesa(
    'mpesa',
    'M-Pesa',
    'Approve the prompt on your phone — you never leave the app.',
  ),
  pesapal(
    'pesapal',
    'Card, bank or mobile money',
    'Pay through Pesapal in a secure window.',
  );

  const PaymentMethodOption(this.wire, this.label, this.description);

  /// The exact string `CheckoutDto` expects.
  final String wire;
  final String label;
  final String description;

  /// Display name for a method read back off an order, including `cod`, which
  /// can no longer be chosen but still exists on orders placed before it was
  /// withdrawn.
  static String labelForWire(String? wire) {
    switch (wire) {
      case 'mpesa':
        return 'M-Pesa';
      case 'pesapal':
        return 'Card / bank (Pesapal)';
      case 'cod':
        return 'Cash on delivery';
      default:
        return 'Not set';
    }
  }
}

/// A delivery address in the exact shape `ShippingAddressDto` validates.
class ShippingAddress {
  const ShippingAddress({
    required this.name,
    required this.phone,
    required this.address,
    required this.city,
    required this.county,
    this.postal,
  });

  final String name;
  final String phone;
  final String address;
  final String city;
  final String county;
  final String? postal;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'name': name,
    'phone': phone,
    'address': address,
    'city': city,
    'county': county,
    if (postal != null && postal!.trim().isNotEmpty) 'postal': postal!.trim(),
  };

  /// Reads `deliveryOption` out of an order's `shipping` jsonb.
  ///
  /// `place_order` writes it there alongside the address, which makes it a
  /// fact about the order rather than something to infer from the shipping fee
  /// being zero — an inference that would quietly break the day anyone runs a
  /// free-delivery promotion.
  static DeliveryOption? deliveryFromJson(dynamic raw) {
    if (raw is! Map) return null;
    final Object? value = raw['deliveryOption'];
    for (final DeliveryOption option in DeliveryOption.values) {
      if (option.wire == value) return option;
    }
    return null;
  }

  /// Reads the `shipping` jsonb back off an order. Tolerant: the column also
  /// carries `deliveryOption`, and pickup orders store a branch's address.
  static ShippingAddress? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final Map<String, dynamic> json = <String, dynamic>{};
    raw.forEach((dynamic k, dynamic v) => json[k.toString()] = v);
    final String name = json['name'] as String? ?? '';
    final String address = json['address'] as String? ?? '';
    if (name.isEmpty && address.isEmpty) return null;
    return ShippingAddress(
      name: name,
      phone: json['phone'] as String? ?? '',
      address: address,
      city: json['city'] as String? ?? '',
      county: json['county'] as String? ?? '',
      postal: json['postal'] as String?,
    );
  }

  /// Single-line rendering for summaries.
  String get oneLine => <String>[
    address,
    city,
    county,
    postal ?? '',
  ].map((String s) => s.trim()).where((String s) => s.isNotEmpty).join(', ');
}

/// A saved address (`GET /addresses`).
///
/// The addresses endpoint returns raw rows, so this one model is snake_case
/// where the rest of the API is camelCase. Its fields deliberately match
/// [ShippingAddress] so a saved row drops straight into a checkout payload.
class SavedAddress {
  const SavedAddress({
    required this.id,
    required this.shipping,
    required this.isDefault,
    this.label,
  });

  final String id;
  final ShippingAddress shipping;
  final bool isDefault;
  final String? label;

  String get title =>
      (label != null && label!.trim().isNotEmpty) ? label! : shipping.name;

  factory SavedAddress.fromJson(Map<String, dynamic> json) => SavedAddress(
    id: json['id'] as String? ?? '',
    label: json['label'] as String?,
    isDefault: json['is_default'] as bool? ?? false,
    shipping: ShippingAddress(
      name: json['name'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      address: json['address'] as String? ?? '',
      city: json['city'] as String? ?? '',
      county: json['county'] as String? ?? '',
      postal: json['postal'] as String?,
    ),
  );
}

/// A branch a customer can collect from (`GET /branches`).
///
/// Only the fields checkout needs. The branch-locator slice (SPEC-11 P0-7)
/// owns the full model; duplicating three fields here is cheaper than a
/// cross-slice dependency on a feature that may not have landed yet.
class PickupBranch {
  const PickupBranch({
    required this.id,
    required this.name,
    this.address,
    this.phone,
  });

  final String id;
  final String name;
  final String? address;
  final String? phone;

  factory PickupBranch.fromJson(Map<String, dynamic> json) => PickupBranch(
    id: json['id'] as String? ?? '',
    name: json['name'] as String? ?? 'Optex branch',
    address: json['address'] as String?,
    phone: json['phone'] as String?,
  );

  /// Builds the shipping payload for a pickup order.
  ///
  /// `ShippingAddressDto` is required for both delivery options, so a pickup
  /// order still records who is collecting and where from. `branches` has no
  /// city/county columns — only a name and one free-text address — so the
  /// branch name fills those required fields and the street detail goes in
  /// `address`, which is where fulfilment reads it. This mirrors the web
  /// checkout exactly; the two must agree or the same order looks different
  /// depending on where it was placed.
  ShippingAddress toShipping({required String name, required String phone}) =>
      ShippingAddress(
        name: name,
        phone: phone,
        address: (address != null && address!.trim().isNotEmpty)
            ? 'Collect at Optex ${this.name} — ${address!.trim()}'
            : 'Collect at Optex ${this.name}',
        city: this.name,
        county: this.name,
      );
}
