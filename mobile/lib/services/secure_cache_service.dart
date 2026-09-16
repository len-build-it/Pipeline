import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class SecureStorageAdapter {
  Future<String?> read({required String key});
  Future<void> write({required String key, required String value});
  Future<void> delete({required String key});
  Future<Map<String, String>> readAll();
  Future<void> deleteAll();
}

class FlutterSecureStorageAdapter implements SecureStorageAdapter {
  final FlutterSecureStorage _storage;

  FlutterSecureStorageAdapter([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage(
          aOptions: AndroidOptions(
            encryptedSharedPreferences: true,
          ),
        );

  @override
  Future<String?> read({required String key}) => _storage.read(key: key);

  @override
  Future<void> write({required String key, required String value}) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete({required String key}) => _storage.delete(key: key);

  @override
  Future<Map<String, String>> readAll() => _storage.readAll();

  @override
  Future<void> deleteAll() => _storage.deleteAll();
}

class InMemoryStorageAdapter implements SecureStorageAdapter {
  final Map<String, String> _data = {};

  @override
  Future<String?> read({required String key}) async => _data[key];

  @override
  Future<void> write({required String key, required String value}) async {
    _data[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    _data.remove(key);
  }

  @override
  Future<Map<String, String>> readAll() async => Map.from(_data);

  @override
  Future<void> deleteAll() async {
    _data.clear();
  }
}

class CachedSnapshot {
  final String key;
  final String accountId;
  final String scope;
  final String destination;
  final String filterKey;
  final DateTime timestamp;
  final DateTime expiresAt;
  final dynamic payload;

  CachedSnapshot({
    required this.key,
    required this.accountId,
    required this.scope,
    required this.destination,
    required this.filterKey,
    required this.timestamp,
    required this.expiresAt,
    required this.payload,
  });

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  Duration get age => DateTime.now().difference(timestamp);

  String get formattedAge {
    final diff = age;
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Map<String, dynamic> toJson() => {
    'key': key,
    'accountId': accountId,
    'scope': scope,
    'destination': destination,
    'filterKey': filterKey,
    'timestamp': timestamp.toIso8601String(),
    'expiresAt': expiresAt.toIso8601String(),
    'payload': payload,
  };

  factory CachedSnapshot.fromJson(Map<String, dynamic> json) {
    return CachedSnapshot(
      key: json['key'] as String,
      accountId: json['accountId'] as String,
      scope: json['scope'] as String,
      destination: json['destination'] as String,
      filterKey: json['filterKey'] as String? ?? '',
      timestamp: DateTime.parse(json['timestamp'] as String),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      payload: json['payload'],
    );
  }
}

class SecureCacheService {
  static const int maxCacheBytesPerAccount = 512 * 1024; // 512 KiB per account
  static const int maxRecordsPerSnapshot = 25; // first 25 records
  static const Duration defaultExpiry = Duration(hours: 24); // 24 hours max

  final SecureStorageAdapter storage;

  SecureCacheService({SecureStorageAdapter? storageAdapter})
      : storage = storageAdapter ?? FlutterSecureStorageAdapter();

  static String buildCacheKey({
    required String accountId,
    required String scope,
    required String destination,
    String filterKey = '',
  }) {
    return 'cache:$accountId:$scope:$destination:$filterKey';
  }

  static String _indexKey(String accountId) => 'cache_index:$accountId';

  Future<void> saveSnapshot({
    required String accountId,
    required String scope,
    required String destination,
    String filterKey = '',
    required dynamic rawPayload,
    DateTime? sessionExpiry,
  }) async {
    if (accountId.isEmpty) return;

    // Sanitize and bound payload to at most 25 records
    final boundedPayload = _sanitizeAndBoundPayload(destination, rawPayload);

    final now = DateTime.now();
    final maxExpiry = now.add(defaultExpiry);
    final effectiveExpiry = (sessionExpiry != null && sessionExpiry.isBefore(maxExpiry))
        ? sessionExpiry
        : maxExpiry;

    final key = buildCacheKey(
      accountId: accountId,
      scope: scope,
      destination: destination,
      filterKey: filterKey,
    );

    final snapshot = CachedSnapshot(
      key: key,
      accountId: accountId,
      scope: scope,
      destination: destination,
      filterKey: filterKey,
      timestamp: now,
      expiresAt: effectiveExpiry,
      payload: boundedPayload,
    );

    final serialized = jsonEncode(snapshot.toJson());
    final newBytes = utf8.encode(serialized).length;

    // Manage index and enforce 512 KiB capacity eviction
    final indexList = await _loadIndex(accountId);

    // Remove old entry for this key if exists
    indexList.removeWhere((item) => item['key'] == key);

    // Evict oldest if byte cap exceeded
    int currentBytes = indexList.fold(0, (sum, item) => sum + (item['size'] as int? ?? 0));
    while (currentBytes + newBytes > maxCacheBytesPerAccount && indexList.isNotEmpty) {
      final oldest = indexList.removeAt(0); // oldest is first
      await storage.delete(key: oldest['key'] as String);
      currentBytes -= (oldest['size'] as int? ?? 0);
    }

    // Write new snapshot
    await storage.write(key: key, value: serialized);

    // Update index
    indexList.add({
      'key': key,
      'scope': scope,
      'destination': destination,
      'timestamp': now.toIso8601String(),
      'size': newBytes,
    });
    await _saveIndex(accountId, indexList);
  }

  Future<CachedSnapshot?> getSnapshot({
    required String accountId,
    required String scope,
    required String destination,
    String filterKey = '',
  }) async {
    if (accountId.isEmpty) return null;

    final key = buildCacheKey(
      accountId: accountId,
      scope: scope,
      destination: destination,
      filterKey: filterKey,
    );

    try {
      final raw = await storage.read(key: key);
      if (raw == null || raw.isEmpty) return null;

      final Map<String, dynamic> data = jsonDecode(raw) as Map<String, dynamic>;
      final snapshot = CachedSnapshot.fromJson(data);

      // Verify scope isolation (REQ-007: never show different scope)
      if (snapshot.scope != scope || snapshot.accountId != accountId) {
        return null;
      }

      // Check expiry (24-hour limit)
      if (snapshot.isExpired) {
        await storage.delete(key: key);
        final indexList = await _loadIndex(accountId);
        indexList.removeWhere((item) => item['key'] == key);
        await _saveIndex(accountId, indexList);
        return null;
      }

      return snapshot;
    } catch (_) {
      // Storage corruption handling (REQ-007): safely delete corrupted item
      try {
        await storage.delete(key: key);
      } catch (_) {}
      return null;
    }
  }

  Future<void> clearScope({
    required String accountId,
    required String scope,
  }) async {
    if (accountId.isEmpty) return;

    final indexList = await _loadIndex(accountId);
    final remaining = <Map<String, dynamic>>[];

    for (final item in indexList) {
      if (item['scope'] == scope) {
        await storage.delete(key: item['key'] as String);
      } else {
        remaining.add(item);
      }
    }

    await _saveIndex(accountId, remaining);
  }

  Future<void> clearAccount(String accountId) async {
    if (accountId.isEmpty) return;

    final indexList = await _loadIndex(accountId);
    for (final item in indexList) {
      await storage.delete(key: item['key'] as String);
    }
    await storage.delete(key: _indexKey(accountId));
  }

  Future<void> clearAll() async {
    await storage.deleteAll();
  }

  Future<List<Map<String, dynamic>>> _loadIndex(String accountId) async {
    try {
      final raw = await storage.read(key: _indexKey(accountId));
      if (raw == null || raw.isEmpty) return [];
      final list = jsonDecode(raw) as List<dynamic>;
      return list.cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  Future<void> _saveIndex(String accountId, List<Map<String, dynamic>> index) async {
    try {
      await storage.write(key: _indexKey(accountId), value: jsonEncode(index));
    } catch (_) {}
  }

  dynamic _sanitizeAndBoundPayload(String destination, dynamic payload) {
    if (payload is List) {
      // Limit to first 25 records
      final limited = payload.take(maxRecordsPerSnapshot).toList();
      return limited.map((item) {
        if (item is Map<String, dynamic>) {
          final copy = Map<String, dynamic>.from(item);
          // Omit notes, drafts, comment bodies, and activity payloads (per FEAT-005)
          copy.remove('notes');
          copy.remove('comments');
          copy.remove('activity_events');
          return copy;
        }
        return item;
      }).toList();
    } else if (payload is Map<String, dynamic>) {
      final copy = Map<String, dynamic>.from(payload);
      copy.remove('notes');
      copy.remove('comments');
      copy.remove('activity_events');
      if (copy['actionableTasks'] is List) {
        copy['actionableTasks'] = (copy['actionableTasks'] as List).take(maxRecordsPerSnapshot).toList();
      }
      if (copy['recentAnnouncements'] is List) {
        copy['recentAnnouncements'] = (copy['recentAnnouncements'] as List).take(maxRecordsPerSnapshot).toList();
      }
      return copy;
    }
    return payload;
  }
}
