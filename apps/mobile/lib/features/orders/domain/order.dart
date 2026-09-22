/// Order models, hand-written from `apps/api/src/modules/orders/dto/order-views.ts`.
///
/// Every `fromJson` is deliberately tolerant: a missing or wrongly-typed field
/// degrades to a sensible zero rather than throwing, because a single unexpected
/// null in one line item should not blank an entire order history screen.
library;

/// The product summary joined onto an order line (`OrderItemView.product`).
class OrderItemProduct {
  const OrderItemProduct({
    required this.id,
    required this.slug,
    required this.name,
    this.brand,
    this.image,
  });

  final String id;
  final String slug;
  final String name;
  final String? brand;
  final String? image;

  factory OrderItemProduct.fromJson(Map<String, dynamic> json) => OrderItemProduct(
        id: json['id'] as String? ?? '',
        slug: json['slug'] as String? ?? '',
        name: json['name'] as String? ?? 'Product',
        brand: json['brand'] as String?,
        image: json['image'] as String?,
      );
}

/// A single line on an order (`OrderItemView`).
///
/// `lineTotalKes` is the server's figure, not `unitPrice * quantity` computed
/// here — AGENTS.md rule 6.
class OrderItem {
  const OrderItem({
    required this.id,
    required this.productId,
    required this.quantity,
    required this.unitPriceKes,
    required this.lineTotalKes,
    this.lensOption,
    this.product,
  });

  final String id;
  final String productId;
  final int quantity;
  final num unitPriceKes;
  final num lineTotalKes;

  /// Free-form lens configuration the API stores as jsonb. Rendered as
  /// key/value pairs because SPEC-07's option schema has not landed yet.
  final Map<String, dynamic>? lensOption;
  final OrderItemProduct? product;

  String get displayName => product?.name ?? 'Item no longer available';

  factory OrderItem.fromJson(Map<String, dynamic> json) => OrderItem(
        id: json['id'] as String? ?? '',
        productId: json['productId'] as String? ?? '',
        quantity: (json['quantity'] as num?)?.toInt() ?? 0,
        unitPriceKes: (json['unitPriceKes'] as num?) ?? 0,
        lineTotalKes: (json['lineTotalKes'] as num?) ?? 0,
        lensOption: json['lensOption'] is Map<String, dynamic>
            ? json['lensOption'] as Map<String, dynamic>
            : null,
        product: json['product'] is Map<String, dynamic>
            ? OrderItemProduct.fromJson(json['product'] as Map<String, dynamic>)
            : null,
      );
}

/// The `shipping` jsonb column, written verbatim from `ShippingAddressDto`.
///
/// Note the real key names: `address`, `city`, `county`, `postal` — NOT
/// `line1`/`line2`, which is what `apps/web`'s tracking page reads (and why its
/// address block renders half-empty).
class ShippingDetails {
  const ShippingDetails({
    this.name,
    this.phone,
    this.address,
    this.city,
    this.county,
    this.postal,
  });

  final String? name;
  final String? phone;
  final String? address;
  final String? city;
  final String? county;
  final String? postal;

  bool get isEmpty =>
      <String?>[name, phone, address, city, county, postal]
          .every((String? v) => v == null || v.trim().isEmpty);

  /// Address lines, blanks dropped, ready to render one per row.
  List<String> get addressLines => <String?>[address, city, county, postal]
      .where((String? v) => v != null && v.trim().isNotEmpty)
      .map((String? v) => v!.trim())
      .toList();

  static ShippingDetails? fromJson(Object? raw) {
    if (raw is! Map) return null;
    String? str(String key) {
      final Object? v = raw[key];
      return v is String && v.trim().isNotEmpty ? v.trim() : null;
    }

    final ShippingDetails details = ShippingDetails(
      name: str('name'),
      phone: str('phone'),
      address: str('address'),
      city: str('city'),
      county: str('county'),
      postal: str('postal'),
    );
    return details.isEmpty ? null : details;
  }
}

/// Compact order row from `GET /orders` (`OrderSummaryView`).
class OrderSummary {
  const OrderSummary({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.totalKes,
    required this.discountKes,
    required this.itemCount,
    this.paymentMethod,
    this.createdAt,
  });

  final String id;
  final String orderNumber;

  /// Raw `order_status` enum value. Never interpreted into a timeline position
  /// here — that is the tracking endpoint's job (SPEC-11 P0-5).
  final String status;
  final String paymentStatus;
  final String? paymentMethod;
  final num totalKes;
  final num discountKes;
  final int itemCount;
  final DateTime? createdAt;

  bool get isCancelled => status == 'cancelled';

  factory OrderSummary.fromJson(Map<String, dynamic> json) => OrderSummary(
        id: json['id'] as String? ?? '',
        orderNumber: json['orderNumber'] as String? ?? '',
        status: json['status'] as String? ?? 'unknown',
        paymentStatus: json['paymentStatus'] as String? ?? 'unknown',
        paymentMethod: json['paymentMethod'] as String?,
        totalKes: (json['totalKes'] as num?) ?? 0,
        discountKes: (json['discountKes'] as num?) ?? 0,
        itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
        createdAt: parseDate(json['createdAt']),
      );

  static DateTime? parseDate(Object? raw) =>
      raw is String ? DateTime.tryParse(raw)?.toLocal() : null;
}

/// Full order from `GET /orders/:id` (`OrderDetailView`).
class OrderDetail extends OrderSummary {
  const OrderDetail({
    required super.id,
    required super.orderNumber,
    required super.status,
    required super.paymentStatus,
    required super.totalKes,
    required super.discountKes,
    required super.itemCount,
    required this.subtotalKes,
    required this.vatKes,
    required this.shippingKes,
    required this.items,
    super.paymentMethod,
    super.createdAt,
    this.promoCode,
    this.shipping,
    this.notes,
  });

  final num subtotalKes;
  final num vatKes;
  final num shippingKes;
  final String? promoCode;
  final ShippingDetails? shipping;
  final String? notes;
  final List<OrderItem> items;

  factory OrderDetail.fromJson(Map<String, dynamic> json) {
    final List<OrderItem> items = (json['items'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(OrderItem.fromJson)
        .toList();

    return OrderDetail(
      id: json['id'] as String? ?? '',
      orderNumber: json['orderNumber'] as String? ?? '',
      status: json['status'] as String? ?? 'unknown',
      paymentStatus: json['paymentStatus'] as String? ?? 'unknown',
      paymentMethod: json['paymentMethod'] as String?,
      totalKes: (json['totalKes'] as num?) ?? 0,
      discountKes: (json['discountKes'] as num?) ?? 0,
      itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
      createdAt: OrderSummary.parseDate(json['createdAt']),
      subtotalKes: (json['subtotalKes'] as num?) ?? 0,
      vatKes: (json['vatKes'] as num?) ?? 0,
      shippingKes: (json['shippingKes'] as num?) ?? 0,
      promoCode: json['promoCode'] as String?,
      shipping: ShippingDetails.fromJson(json['shipping']),
      notes: json['notes'] as String?,
      items: items,
    );
  }
}
