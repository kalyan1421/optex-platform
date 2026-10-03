import 'checkout_draft.dart';
import 'line_option.dart';
import 'money_row.dart';

/// One line on a placed order (`OrderItemView`).
///
/// Unlike a cart line, this one carries the server's own [unitPriceKes]: the
/// price is snapshotted into `order_items` at checkout, so it is a fact about
/// the order rather than a lookup against the current catalogue.
class OrderLine {
  const OrderLine({
    required this.id,
    required this.productId,
    required this.quantity,
    required this.unitPriceKes,
    required this.lineTotalKes,
    this.name,
    this.brand,
    this.slug,
    this.imageUrl,
    this.option,
  });

  final String id;
  final String productId;
  final int quantity;
  final num unitPriceKes;
  final num lineTotalKes;

  /// Null when the product row was deleted after the order was placed — the
  /// order line survives, so the UI falls back to a neutral label.
  final String? name;
  final String? brand;
  final String? slug;
  final String? imageUrl;
  final LineOption? option;

  String get displayName => name ?? 'Item no longer in the catalogue';

  factory OrderLine.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? product =
        json['product'] as Map<String, dynamic>?;
    return OrderLine(
      id: json['id'] as String? ?? '',
      productId: json['productId'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      unitPriceKes: json['unitPriceKes'] as num? ?? 0,
      lineTotalKes: json['lineTotalKes'] as num? ?? 0,
      name: product?['name'] as String?,
      brand: product?['brand'] as String?,
      slug: product?['slug'] as String?,
      imageUrl: product?['image'] as String?,
      option: LineOption.fromJson(json['lensOption']),
    );
  }
}

/// A placed order (`OrderDetailView`).
class Order {
  const Order({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.totalKes,
    required this.subtotalKes,
    required this.discountKes,
    required this.vatKes,
    required this.shippingKes,
    required this.itemCount,
    required this.lines,
    this.paymentMethod,
    this.promoCode,
    this.shipping,
    this.notes,
    this.createdAt,
    this.delivery,
  });

  final String id;
  final String orderNumber;

  /// `order_status`: pending_payment | received | processing | dispatched |
  /// delivered | cancelled. Rendered, never inferred from.
  final String status;

  /// `payment_status`: pending | paid | failed | refunded.
  final String paymentStatus;

  final num totalKes;
  final num subtotalKes;
  final num discountKes;
  final num vatKes;
  final num shippingKes;
  final int itemCount;
  final List<OrderLine> lines;
  final String? paymentMethod;
  final String? promoCode;
  final ShippingAddress? shipping;
  final String? notes;
  final DateTime? createdAt;

  /// The delivery option `place_order` recorded on the order, when it is
  /// legible. Null for orders placed before the field existed.
  final DeliveryOption? delivery;

  bool get isPaid => paymentStatus == 'paid';
  bool get isCancelled => status == 'cancelled';

  /// True while the server will still accept a payment for this order.
  ///
  /// Mirrors `PaymentsService.assertPayable` exactly: unpaid **and** still
  /// `pending_payment`. Anything else and both `mpesa/stk-push` and
  /// `pesapal/initiate` throw a 409, so the UI must stop offering to pay.
  bool get awaitsPayment => !isPaid && status == 'pending_payment';

  /// True when the customer is collecting rather than having it delivered.
  ///
  /// Read from the option the server recorded; the zero-fee fallback is only
  /// for orders that predate it.
  bool get isPickup =>
      delivery == DeliveryOption.pickup ||
      (delivery == null && shippingKes == 0);

  List<MoneyRow> get summaryRows => <MoneyRow>[
    MoneyRow(label: 'Subtotal', amountKes: subtotalKes),
    if (discountKes > 0)
      MoneyRow(
        label: 'Discount',
        amountKes: discountKes,
        emphasis: MoneyRowEmphasis.credit,
        note: promoCode,
      ),
    MoneyRow(label: 'VAT (16%)', amountKes: vatKes),
    MoneyRow(
      label: isPickup ? 'Branch pickup' : 'Delivery',
      amountKes: shippingKes,
    ),
    MoneyRow(
      label: 'Total',
      amountKes: totalKes,
      emphasis: MoneyRowEmphasis.total,
    ),
  ];

  factory Order.fromJson(Map<String, dynamic> json) => Order(
    id: json['id'] as String? ?? '',
    orderNumber: json['orderNumber'] as String? ?? '',
    status: json['status'] as String? ?? 'pending_payment',
    paymentStatus: json['paymentStatus'] as String? ?? 'pending',
    paymentMethod: json['paymentMethod'] as String?,
    totalKes: json['totalKes'] as num? ?? 0,
    subtotalKes: json['subtotalKes'] as num? ?? 0,
    discountKes: json['discountKes'] as num? ?? 0,
    vatKes: json['vatKes'] as num? ?? 0,
    shippingKes: json['shippingKes'] as num? ?? 0,
    itemCount:
        (json['itemCount'] as num?)?.toInt() ??
        (json['items'] as List<dynamic>? ?? const <dynamic>[]).length,
    promoCode: json['promoCode'] as String?,
    notes: json['notes'] as String?,
    shipping: ShippingAddress.fromJson(json['shipping']),
    delivery: ShippingAddress.deliveryFromJson(json['shipping']),
    createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
    lines: (json['items'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(OrderLine.fromJson)
        .toList(),
  );
}

/// What checkout says to do next (`PaymentInstruction`).
class PaymentInstruction {
  const PaymentInstruction({
    required this.method,
    required this.requiresPayment,
    required this.status,
    required this.orderId,
    required this.amountKes,
    required this.message,
  });

  final String method;
  final bool requiresPayment;

  /// `confirmed` | `pending_payment`.
  final String status;
  final String orderId;
  final num amountKes;

  /// Server-written and customer-safe.
  final String message;

  factory PaymentInstruction.fromJson(Map<String, dynamic> json) =>
      PaymentInstruction(
        method: json['method'] as String? ?? '',
        requiresPayment: json['requiresPayment'] as bool? ?? true,
        status: json['status'] as String? ?? 'pending_payment',
        orderId: json['orderId'] as String? ?? '',
        amountKes: json['amountKes'] as num? ?? 0,
        message: json['message'] as String? ?? '',
      );
}

/// The full `POST /checkout` response (`CheckoutResultView`).
class CheckoutResult {
  const CheckoutResult({required this.order, required this.payment});

  final Order order;
  final PaymentInstruction payment;

  factory CheckoutResult.fromJson(Map<String, dynamic> json) => CheckoutResult(
    order: Order.fromJson(
      (json['order'] as Map<String, dynamic>?) ?? const <String, dynamic>{},
    ),
    payment: PaymentInstruction.fromJson(
      (json['payment'] as Map<String, dynamic>?) ?? const <String, dynamic>{},
    ),
  );
}
