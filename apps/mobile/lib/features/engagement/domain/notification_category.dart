/// The notification categories the API recognises.
///
/// Exactly `['order', 'appointment', 'offer']` — the list is closed server-side
/// by `@IsIn(NOTIFICATION_CATEGORIES)` in
/// `apps/api/src/modules/customer-notifications/dto/notification-query.dto.ts`,
/// so a fourth value is a contract change rather than something the client can
/// invent.
enum NotificationCategory {
  order('order', 'Orders'),
  appointment('appointment', 'Appointments'),
  offer('offer', 'Offers');

  const NotificationCategory(this.wire, this.label);

  /// The value the API sends and accepts as `?category=`.
  final String wire;

  /// Human label for filter chips and settings rows.
  final String label;

  /// Returns null rather than throwing for an unknown value.
  ///
  /// A notification whose category the client does not recognise is still shown
  /// — losing a delivery because the server grew a category is a worse failure
  /// than rendering it with a generic icon.
  static NotificationCategory? tryParse(String? value) {
    if (value == null) return null;
    for (final NotificationCategory category in NotificationCategory.values) {
      if (category.wire == value) return category;
    }
    return null;
  }
}
