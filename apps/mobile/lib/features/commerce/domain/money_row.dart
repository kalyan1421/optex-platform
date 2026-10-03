/// One line in a money breakdown, exactly as the server computed it.
///
/// Totals are never recomputed on the client (AGENTS.md §6), so the summary
/// widgets render a *list* of these rather than a fixed subtotal/VAT/total
/// triple. When the server grows a new adjustment — store credit, loyalty,
/// a lens-option surcharge (SPEC-11 P2-1/P2-5) — it becomes one more row and
/// no layout changes.
class MoneyRow {
  const MoneyRow({
    required this.label,
    required this.amountKes,
    this.emphasis = MoneyRowEmphasis.normal,
    this.note,
  });

  final String label;
  final num amountKes;
  final MoneyRowEmphasis emphasis;

  /// Secondary text, e.g. the promo code behind a discount.
  final String? note;
}

/// How prominently a [MoneyRow] renders. Purely presentational.
enum MoneyRowEmphasis {
  /// Ordinary line — subtotal, VAT, shipping.
  normal,

  /// A deduction. Rendered in the success colour with a leading minus.
  credit,

  /// The amount actually payable.
  total,
}
