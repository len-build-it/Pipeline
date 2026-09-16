import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/services/secure_cache_service.dart';

void main() {
  group('SecureCacheService & Snapshot Bounding (FEAT-005/REQ-002, REQ-007)', () {
    late InMemoryStorageAdapter storage;
    late SecureCacheService cache;

    setUp(() {
      storage = InMemoryStorageAdapter();
      cache = SecureCacheService(storageAdapter: storage);
    });

    test('Saves and retrieves valid snapshot within 24 hours', () async {
      await cache.saveSnapshot(
        accountId: 'usr-1',
        scope: 'org-1',
        destination: 'tasks',
        rawPayload: [
          {'id': 'tsk-1', 'title': 'Task 1', 'notes': 'secret private note', 'comments': ['c1']},
        ],
      );

      final snapshot = await cache.getSnapshot(
        accountId: 'usr-1',
        scope: 'org-1',
        destination: 'tasks',
      );

      expect(snapshot, isNotNull);
      expect(snapshot!.accountId, equals('usr-1'));
      expect(snapshot.scope, equals('org-1'));
      expect(snapshot.destination, equals('tasks'));
      expect(snapshot.isExpired, isFalse);

      // Verify notes and comments are stripped per FEAT-005 spec
      final list = snapshot.payload as List;
      expect(list.length, equals(1));
      expect(list[0]['id'], equals('tsk-1'));
      expect(list[0].containsKey('notes'), isFalse);
      expect(list[0].containsKey('comments'), isFalse);
    });

    test('Caps snapshot records at 25 items', () async {
      final bigList = List.generate(
        40,
        (i) => {'id': 'tsk-$i', 'title': 'Task $i'},
      );

      await cache.saveSnapshot(
        accountId: 'usr-1',
        scope: 'org-1',
        destination: 'tasks',
        rawPayload: bigList,
      );

      final snapshot = await cache.getSnapshot(
        accountId: 'usr-1',
        scope: 'org-1',
        destination: 'tasks',
      );

      expect(snapshot, isNotNull);
      final list = snapshot!.payload as List;
      expect(list.length, equals(25)); // capped at 25
      expect(list[0]['id'], equals('tsk-0'));
      expect(list[24]['id'], equals('tsk-24'));
    });

    test('Account and scope isolation: cannot read another account or scope cache (REQ-007)', () async {
      await cache.saveSnapshot(
        accountId: 'usr-1',
        scope: 'org-1',
        destination: 'members',
        rawPayload: [{'id': 'mem-1'}],
      );

      // Different account cannot read usr-1's snapshot
      final otherAccountSnap = await cache.getSnapshot(
        accountId: 'usr-2',
        scope: 'org-1',
        destination: 'members',
      );
      expect(otherAccountSnap, isNull);

      // Different scope cannot read org-1's snapshot
      final otherScopeSnap = await cache.getSnapshot(
        accountId: 'usr-1',
        scope: 'org-2',
        destination: 'members',
      );
      expect(otherScopeSnap, isNull);
    });

    test('Snapshot expires after 24 hours (REQ-007)', () async {
      final key = SecureCacheService.buildCacheKey(
        accountId: 'usr-1',
        scope: 'org-1',
        destination: 'overview',
      );

      // Manually store expired snapshot (25 hours ago)
      final expiredSnapshot = CachedSnapshot(
        key: key,
        accountId: 'usr-1',
        scope: 'org-1',
        destination: 'overview',
        filterKey: '',
        timestamp: DateTime.now().subtract(const Duration(hours: 25)),
        expiresAt: DateTime.now().subtract(const Duration(hours: 1)),
        payload: {'tasks': []},
      );

      await storage.write(key: key, value: jsonEncode(expiredSnapshot.toJson()));

      final retrieved = await cache.getSnapshot(
        accountId: 'usr-1',
        scope: 'org-1',
        destination: 'overview',
      );

      expect(retrieved, isNull);
      // Verify expired item is cleaned from storage
      final rawAfter = await storage.read(key: key);
      expect(rawAfter, isNull);
    });

    test('Respects session expiry if sooner than 24 hours', () async {
      await cache.saveSnapshot(
        accountId: 'usr-1',
        scope: 'org-1',
        destination: 'tasks',
        rawPayload: [{'id': 'tsk-1'}],
        sessionExpiry: DateTime.now().add(const Duration(minutes: 30)),
      );

      final snapshot = await cache.getSnapshot(
        accountId: 'usr-1',
        scope: 'org-1',
        destination: 'tasks',
      );

      expect(snapshot, isNotNull);
      expect(snapshot!.expiresAt.isBefore(DateTime.now().add(const Duration(hours: 1))), isTrue);
    });

    test('512 KiB capacity eviction: evicts oldest snapshots when limit exceeded', () async {
      // Create large payload ~150 KiB
      final chunk = List.generate(25, (i) => {
        'id': 'tsk-$i',
        'title': 'Task $i${'A' * 6000}', // ~6KB per item -> ~150KB per snapshot
      });

      // Save 4 snapshots sequentially (total ~600 KiB > 512 KiB cap)
      await cache.saveSnapshot(accountId: 'usr-1', scope: 'org-1', destination: 'snap-1', rawPayload: chunk);
      await cache.saveSnapshot(accountId: 'usr-1', scope: 'org-1', destination: 'snap-2', rawPayload: chunk);
      await cache.saveSnapshot(accountId: 'usr-1', scope: 'org-1', destination: 'snap-3', rawPayload: chunk);
      await cache.saveSnapshot(accountId: 'usr-1', scope: 'org-1', destination: 'snap-4', rawPayload: chunk);

      // Snap-1 must have been evicted to respect the 512 KiB cap
      final snap1 = await cache.getSnapshot(accountId: 'usr-1', scope: 'org-1', destination: 'snap-1');
      expect(snap1, isNull);

      // The latest snapshot must be present
      final snap4 = await cache.getSnapshot(accountId: 'usr-1', scope: 'org-1', destination: 'snap-4');
      expect(snap4, isNotNull);
    });

    test('clearScope deletes only entries for the specified organization (REQ-008)', () async {
      await cache.saveSnapshot(accountId: 'usr-1', scope: 'org-1', destination: 'tasks', rawPayload: [{'id': 't1'}]);
      await cache.saveSnapshot(accountId: 'usr-1', scope: 'org-2', destination: 'tasks', rawPayload: [{'id': 't2'}]);

      await cache.clearScope(accountId: 'usr-1', scope: 'org-1');

      expect(await cache.getSnapshot(accountId: 'usr-1', scope: 'org-1', destination: 'tasks'), isNull);
      expect(await cache.getSnapshot(accountId: 'usr-1', scope: 'org-2', destination: 'tasks'), isNotNull);
    });

    test('clearAccount clears all data for that user on sign out or account switch (REQ-005)', () async {
      await cache.saveSnapshot(accountId: 'usr-1', scope: 'org-1', destination: 'tasks', rawPayload: [{'id': 't1'}]);
      await cache.saveSnapshot(accountId: 'usr-2', scope: 'org-1', destination: 'tasks', rawPayload: [{'id': 't2'}]);

      await cache.clearAccount('usr-1');

      expect(await cache.getSnapshot(accountId: 'usr-1', scope: 'org-1', destination: 'tasks'), isNull);
      expect(await cache.getSnapshot(accountId: 'usr-2', scope: 'org-1', destination: 'tasks'), isNotNull);
    });

    test('Corrupt storage handling: corrupted JSON safely deleted without throwing', () async {
      final key = SecureCacheService.buildCacheKey(
        accountId: 'usr-1',
        scope: 'org-1',
        destination: 'tasks',
      );
      await storage.write(key: key, value: 'INVALID_CORRUPTED_JSON{{{{{');

      final result = await cache.getSnapshot(accountId: 'usr-1', scope: 'org-1', destination: 'tasks');
      expect(result, isNull);
      expect(await storage.read(key: key), isNull);
    });
  });
}
