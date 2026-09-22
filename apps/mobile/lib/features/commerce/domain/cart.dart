import 'line_option.dart';
import 'money_row.dart';

/// The product summary the cart endpoint joins onto every line.
class CartProduct {
  const CartProduct({
    required this.id,
    required this.slug,
    required this.name,
    this.brand,
    this.imageUrl,
    this.listPriceKes,
  });

  final String id;
  final String slug;
  final String name;
  final String? brand;
  final String? imageUrl;

  /// The product's catalogue price. Shown as context ("KSh 4,500 each") and
  /// **never** used to compute a line or cart total — see [CartLine].
  final num? listPriceKes;

  factory CartProduct.fromJson(Map<String, dynamic> json) => CartProduct(
    id: json['id'] as String? ?? '',
    slug: json['slug'] as String? ?? '',
    name: json['name'] as String? ?? 'Unnamed product',
    brand: json['brand'] as String?,
    imageUrl: json['image'] as String?,
    listPriceKes: json['priceKes'] as num?,
  );
}

/// One line in the cart (`CartItemView`).
///
/// [lineTotalKes] is the server's figure and is the only money this line
/// renders as its price. [unitPriceKes] is read from the line when the API
/// sends one and otherwise falls back to the product's list price — a fallback,
/// not an assumption, because once SPEC-07's option pricing lands a line's unit
/// price stops equalling `product.price` (SPEC-11 P2-1).
class CartLine {
  const CartLine({
    required this.id,
    required this.productId,
    required this.quantity,
    required this.product,
    required this.lineTotalKes,
    this.unitPriceKes,
    this.option,
  });

  final String id;
  final String productId;
  final int quantity;
  final CartProduct product;
  final num lineTotalKes;
  final num? unitPriceKes;
  final LineOption? option;

  bool get isConfigured => option != null;

  factory CartLine.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> product =
        (json['product'] as Map<String, dynamic>?) ?? const <String, dynamic>{};
    return CartLine(
      id: json['id'] as String? ?? '',
      productId: json['productId'] as String? ?? product['id'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      product: CartProduct.fromJson(product),
      lineTotalKes: json['lineTotalKes'] as num? ?? 0,
      // `unitPriceKes` is not in today's CartItemView; it is read first so the
      // app picks it up the moment the API starts sending it.
      unitPriceKes: json['unitPriceKes'] as num? ?? product['priceKes'] as num?,
      option: LineOption.fromJson(json['lensOption']),
    );
  }
}

/// The promo applied to the cart (`AppliedPromoView`).
class AppliedPromo {
  const AppliedPromo({
    required this.code,
    required this.discountType,
    required this.value,
    required this.discountKes,
  });

  final String code;

  /// `percent` or `fixed`, straight from the server.
  final String discountType;
  final num value;
  final num discountKes;

  /// e.g. "10% off" / "KSh 500 off" — label only; the money shown is
  /// [discountKes], which the server computed.
  bool get isPercent => discountType == 'percent';

  factory AppliedPromo.fromJson(Map<String, dynamic> json) => AppliedPromo(
    code: json['code'] as String? ?? '',
    discountType: json['discountType'] as String? ?? 'fixed',
    value: json['value'] as num? ?? 0,
    discountKes: json['discountKes'] as num? ?? 0,
  );
}

/// The fully-computed cart every `/cart` endpoint returns (`CartView`).
///
/// Every figure here is the server's. Nothing in this class derives one amount
/// from another, which is what keeps the app and `place_order` agreeing about
/// what the customer owes.
class Cart {
  const Cart({
    required this.cartId,
    required this.lines,
    required this.itemCount,
    required this.subtotalKes,
    required this.discountKes,
    required this.vatKes,
    required this.totalKes,
    this.promo,
  });

  final String cartId;
  final List<CartLine> lines;
  final int itemCount;
  final num subtotalKes;
  final num discountKes;
  final num vatKes;
  final num totalKes;
  final AppliedPromo? promo;

  bool get isEmpty => lines.isEmpty;

  /// The money breakdown, in render order.
  ///
  /// Shipping is absent on purpose: the cart endpoint does not charge it. It is
  /// added by `place_order` from the delivery option (flat KES 300 delivery,
  /// free for branch pickup), so the cart's total is genuinely not the amount
  /// the customer will pay — the checkout screen shows the order's own totals
  /// once the order exists.
  List<MoneyRow> get summaryRows => <MoneyRow>[
    MoneyRow(label: 'Subtotal', amountKes: subtotalKes),
    if (discountKes > 0)
      MoneyRow(
        label: 'Discount',
        amountKes: discountKes,
        emphasis: MoneyRowEmphasis.credit,
        note: promo?.code,
      ),
    MoneyRow(label: 'VAT (16%)', amountKes: vatKes),
    MoneyRow(
      label: 'Total',
      amountKes: totalKes,
      emphasis: MoneyRowEmphasis.total,
    ),
  ];

  factory Cart.fromJson(Map<String, dynamic> json) => Cart(
    cartId: json['cartId'] as String? ?? '',
    lines: (json['items'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(CartLine.fromJson)
        .toList(),
    itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
    subtotalKes: json['subtotalKes'] as num? ?? 0,
    discountKes: json['discountKes'] as num? ?? 0,
    vatKes: json['vatKes'] as num? ?? 0,
    totalKes: json['totalKes'] as num? ?? 0,
    promo: json['promo'] == null
        ? null
        : AppliedPromo.fromJson(json['promo'] as Map<String, dynamic>),
  );
}
