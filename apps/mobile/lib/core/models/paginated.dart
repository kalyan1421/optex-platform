/// A page of results from a list endpoint.
///
/// The API is not perfectly uniform about envelope shape across modules, so the
/// parser accepts the common variants rather than forcing every caller to write
/// its own tolerant mapping.
class Paginated<T> {
  const Paginated({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
  });

  final List<T> items;
  final int total;
  final int page;
  final int pageSize;

  bool get hasMore => page * pageSize < total;

  factory Paginated.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) itemFromJson,
  ) {
    final dynamic rawItems = json['items'] ?? json['data'] ?? json['results'] ?? const [];
    final List<T> items = (rawItems as List<dynamic>)
        .whereType<Map<String, dynamic>>()
        .map(itemFromJson)
        .toList();

    return Paginated<T>(
      items: items,
      total: (json['total'] as num?)?.toInt() ?? items.length,
      page: (json['page'] as num?)?.toInt() ?? 1,
      pageSize: (json['pageSize'] as num?)?.toInt() ??
          (json['limit'] as num?)?.toInt() ??
          items.length,
    );
  }

  static Paginated<T> empty<T>() =>
      Paginated<T>(items: const [], total: 0, page: 1, pageSize: 20);
}
