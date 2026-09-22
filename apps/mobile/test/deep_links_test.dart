import 'package:flutter_test/flutter_test.dart';
import 'package:optex_mobile/core/router/deep_links.dart';

void main() {
  group('normalizeDeepLink', () {
    test('folds a non-empty authority back into the path', () {
      // The regression this exists for: `orders` is the authority here, so the
      // naive path is just "/abc-123" and every push tap dead-ends.
      expect(
        normalizeDeepLink(Uri.parse('optex://orders/abc-123')),
        '/orders/abc-123',
      );
    });

    test('leaves the three-slash form untouched', () {
      expect(
        normalizeDeepLink(Uri.parse('optex:///orders/abc-123')),
        '/orders/abc-123',
      );
    });

    test('handles a nested path under an authority', () {
      expect(
        normalizeDeepLink(Uri.parse('optex://orders/abc-123/tracking')),
        '/orders/abc-123/tracking',
      );
    });

    test('handles an authority with no path', () {
      expect(normalizeDeepLink(Uri.parse('optex://notifications')), '/notifications');
    });

    test('preserves the query string', () {
      expect(
        normalizeDeepLink(Uri.parse('optex://product/aviator?ref=push')),
        '/product/aviator?ref=push',
      );
    });

    test('collapses duplicate slashes and drops a trailing one', () {
      expect(normalizeDeepLink(Uri.parse('optex:////orders//abc/')), '/orders/abc');
    });
  });

  group('buildDeepLink', () {
    test('emits the unambiguous three-slash form', () {
      expect(buildDeepLink('/orders/abc'), 'optex:///orders/abc');
    });

    test('round-trips through the normaliser', () {
      expect(normalizeDeepLink(Uri.parse(buildDeepLink('/orders/abc'))), '/orders/abc');
    });
  });

  group('routeForDeepLink', () {
    test('ignores a foreign scheme', () {
      expect(routeForDeepLink('https://example.com/orders/abc'), isNull);
    });

    test('accepts a bare path, as Flutter delivers defaultRouteName', () {
      expect(routeForDeepLink('/orders/abc'), '/orders/abc');
    });

    test('returns null for the bare scheme root', () {
      expect(routeForDeepLink('optex://'), isNull);
    });

    test('returns null for junk', () {
      expect(routeForDeepLink(''), isNull);
      expect(routeForDeepLink(null), isNull);
    });
  });
}
