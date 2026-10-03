import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:sqflite/sqflite.dart';

/// One cached document plus how old it is.
class CachedDocument {
  const CachedDocument({
    required this.key,
    required this.value,
    required this.storedAt,
  });

  final String key;
  final Map<String, dynamic> value;
  final DateTime storedAt;

  Duration get age => DateTime.now().difference(storedAt);
}

/// A JSON key/value store on `sqflite`, with a max-age on every read.
///
/// SPEC-11 P0-12. Deliberately small and slice-agnostic: a string key, a JSON
/// map, a timestamp. Catalog pages, PDPs and the orders list are all shaped
/// like that, so the other slices can adopt this without inheriting anything
/// specific to notifications. The integrator may promote it to `lib/core` —
/// nothing in here imports from `features/engagement`.
///
/// Two rules it exists to enforce, both from P0-12:
///
/// 1. **Read-only.** There is no write queue and no mutation replay. An offline
///    write would need conflict resolution the API has no contract for, and a
///    cart or an order that silently re-plays hours later is worse than a
///    disabled button with a reason on it.
/// 2. **Max-age is the caller's, and it is mandatory.** [read] takes `maxAge`
///    with no default, so nobody can reach for a cached price without having
///    decided how stale is too stale. An entry past its age is treated as
///    absent and deleted.
class OfflineCache {
  OfflineCache({this.databaseName = 'optex_offline_cache.db'});

  final String databaseName;

  static const String _table = 'cached_documents';
  static const String _colKey = 'cache_key';
  static const String _colPayload = 'payload';
  static const String _colStoredAt = 'stored_at';

  Database? _db;
  Future<Database?>? _opening;
  bool _degraded = false;

  /// In-memory stand-in used when sqflite is unavailable (a unit-test host, a
  /// platform without the plugin). The cache still behaves correctly; it just
  /// does not survive a restart. Failing to open a cache must never fail a
  /// feature whose whole point is resilience.
  final Map<String, CachedDocument> _memory = <String, CachedDocument>{};

  /// True when reads and writes are being served from memory because the
  /// on-disk store could not be opened.
  bool get isDegraded => _degraded;

  Future<Database?> _database() async => _db ??= await (_opening ??= _open());

  Future<Database?> _open() async {
    try {
      final String directory = await getDatabasesPath();
      // Joined by hand rather than via `package:path`, which is not a direct
      // dependency of this app (and `depend_on_referenced_packages` would
      // rightly complain about importing it).
      final String separator = directory.endsWith('/') ? '' : '/';
      return await openDatabase(
        '$directory$separator$databaseName',
        version: 1,
        onCreate: (Database db, int version) async {
          await db.execute(
            'CREATE TABLE $_table ('
            '$_colKey TEXT PRIMARY KEY, '
            '$_colPayload TEXT NOT NULL, '
            '$_colStoredAt INTEGER NOT NULL)',
          );
        },
      );
    } catch (error) {
      _degraded = true;
      developer.log(
        'Offline cache falling back to memory: $error',
        name: 'optex.engagement',
      );
      return null;
    }
  }

  /// Returns the entry for [key] when it exists and is younger than [maxAge].
  ///
  /// An expired entry is deleted on the way out, so the store does not grow
  /// a tail of documents nobody will ever read.
  Future<CachedDocument?> read(String key, {required Duration maxAge}) async {
    final CachedDocument? entry = await _readRaw(key);
    if (entry == null) return null;
    if (entry.age > maxAge) {
      await invalidate(key);
      return null;
    }
    return entry;
  }

  /// Reads without applying a max-age.
  ///
  /// Only for callers that have to show *something* and will label it — the
  /// notification feed's offline fallback does this and says "showing saved
  /// copy". Never use it for a price or a total.
  Future<CachedDocument?> readStale(String key) => _readRaw(key);

  Future<CachedDocument?> _readRaw(String key) async {
    final Database? db = await _database();
    if (db == null) return _memory[key];

    try {
      final List<Map<String, Object?>> rows = await db.query(
        _table,
        columns: <String>[_colPayload, _colStoredAt],
        where: '$_colKey = ?',
        whereArgs: <Object?>[key],
        limit: 1,
      );
      if (rows.isEmpty) return null;

      final Object? payload = jsonDecode(rows.first[_colPayload]! as String);
      if (payload is! Map<String, dynamic>) return null;

      return CachedDocument(
        key: key,
        value: payload,
        storedAt: DateTime.fromMillisecondsSinceEpoch(
          rows.first[_colStoredAt]! as int,
        ),
      );
    } catch (error) {
      developer.log(
        'Offline cache read failed for $key: $error',
        name: 'optex.engagement',
      );
      return null;
    }
  }

  Future<void> write(String key, Map<String, dynamic> value) async {
    final DateTime now = DateTime.now();
    final Database? db = await _database();
    if (db == null) {
      _memory[key] = CachedDocument(key: key, value: value, storedAt: now);
      return;
    }

    try {
      await db.insert(_table, <String, Object?>{
        _colKey: key,
        _colPayload: jsonEncode(value),
        _colStoredAt: now.millisecondsSinceEpoch,
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    } catch (error) {
      developer.log(
        'Offline cache write failed for $key: $error',
        name: 'optex.engagement',
      );
    }
  }

  Future<void> invalidate(String key) async {
    final Database? db = await _database();
    if (db == null) {
      _memory.remove(key);
      return;
    }
    try {
      await db.delete(_table, where: '$_colKey = ?', whereArgs: <Object?>[key]);
    } catch (_) {
      // Nothing useful to do; a stale row will fail its max-age anyway.
    }
  }

  /// Drops every entry whose key starts with [prefix] — e.g. `notifications:`
  /// after a mark-all-read, so the next read does not resurrect unread badges.
  Future<void> invalidatePrefix(String prefix) async {
    final Database? db = await _database();
    if (db == null) {
      _memory.removeWhere((String key, _) => key.startsWith(prefix));
      return;
    }
    try {
      await db.delete(
        _table,
        where: '$_colKey LIKE ?',
        whereArgs: <Object?>['$prefix%'],
      );
    } catch (_) {
      // See above.
    }
  }

  /// Empties the cache. Called on reconnect (P0-12: "cache invalidates on
  /// reconnect") and on sign-out, since cached documents are per-customer.
  Future<void> clear() async {
    _memory.clear();
    final Database? db = await _database();
    if (db == null) return;
    try {
      await db.delete(_table);
    } catch (_) {
      // See above.
    }
  }

  /// Housekeeping: removes everything older than [maxAge]. Returns how many
  /// rows went.
  Future<int> purgeExpired(Duration maxAge) async {
    final int cutoff = DateTime.now().subtract(maxAge).millisecondsSinceEpoch;

    final Database? db = await _database();
    if (db == null) {
      final int before = _memory.length;
      _memory.removeWhere(
        (_, CachedDocument doc) => doc.storedAt.millisecondsSinceEpoch < cutoff,
      );
      return before - _memory.length;
    }

    try {
      return await db.delete(
        _table,
        where: '$_colStoredAt < ?',
        whereArgs: <Object?>[cutoff],
      );
    } catch (_) {
      return 0;
    }
  }

  Future<void> close() async {
    final Database? db = _db;
    _db = null;
    _opening = null;
    try {
      await db?.close();
    } catch (_) {
      // Closing a database that is already gone is not an error worth raising.
    }
  }
}
