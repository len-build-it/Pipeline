import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/data/app_repository.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/screens/home_shell.dart';
import 'package:mobile/services/api_client.dart';
import 'package:mobile/services/secure_cache_service.dart';

const _organizations = [
  {'id': 'org-1', 'name': 'AqOne', 'status': 'active', 'role': 'Owner', 'membership_status': 'active'},
  {'id': 'org-2', 'name': 'Dev Guild', 'status': 'active', 'role': 'Owner', 'membership_status': 'active'},
];

Map<String, dynamic> _user() => {
  'id': 'usr-owner',
  'email': 'owner@example.com',
  'displayName': 'Test Owner',
  'status': 'active',
  'isOwner': true,
  'isGlobalOwner': true,
  'memberships': [
    {'orgId': 'org-1', 'role': 'Owner', 'status': 'active'},
    {'orgId': 'org-2', 'role': 'Owner', 'status': 'active'},
  ],
};

Map<String, dynamic> _member(String id, String orgId, String name) => {
  'id': id,
  'userId': 'usr-$id',
  'orgId': orgId,
  'displayName': name,
  'email': '$id@example.com',
  'avatarColor': '#0F766E',
  'role': 'Member',
  'status': 'active',
  'joinedAt': '2026-01-01',
  'skills': <String>[],
  'interests': <String>[],
  'notes': '',
};

Map<String, dynamic> _task(String id, String orgId, String title) => {
  'id': id,
  'orgId': orgId,
  'title': title,
  'description': 'Synthetic fixture',
  'creatorId': 'usr-owner',
  'creatorName': 'Test Owner',
  'status': 'Backlog',
  'priority': 'Medium',
  'labels': <String>[],
  'archived': false,
  'version': 1,
  'updatedAt': '2026-01-01T00:00:00Z',
  'comments': <Map<String, dynamic>>[],
};

Map<String, dynamic> _announcement(String id, List<String> orgIds, String title) => {
  'id': id,
  'title': title,
  'body': 'Synthetic fixture',
  'authorId': 'usr-owner',
  'authorName': 'Test Owner',
  'targetOrganizations': orgIds,
  'publicationStatus': 'Published',
  'publishedAt': '2026-01-01',
  'archived': false,
};

http.Response _json(Map<String, dynamic> value, [int status = 200]) => http.Response(jsonEncode(value), status, headers: {'content-type': 'application/json'});

class _DelayedOrganizationCache extends SecureCacheService {
  final started = Completer<void>();
  final release = Completer<void>();

  _DelayedOrganizationCache({required super.storageAdapter});

  @override
  Future<void> clearOrganization({required String accountId, required String organizationId}) async {
    if (!started.isCompleted) started.complete();
    await release.future;
    await super.clearOrganization(accountId: accountId, organizationId: organizationId);
  }
}

void main() {
  group('FEAT-007 mobile denial cleanup', () {
    test('final 401 after refresh and retry clears current account state and requires sign-in', () async {
      final storage = InMemoryStorageAdapter();
      final cache = SecureCacheService(storageAdapter: storage);
      var revoked = false;
      var meCalls = 0;
      var refreshCalls = 0;
      final client = MockClient((request) async {
        if (request.url.path == '/api/auth/login') {
          return _json({'user': _user(), 'organizations': _organizations, 'accessToken': 'old-access', 'refreshToken': 'refresh-token'});
        }
        if (request.url.path == '/api/auth/me') {
          meCalls++;
          return revoked ? _json({'message': 'Session revoked'}, 401) : _json({'user': _user(), 'organizations': _organizations});
        }
        if (request.url.path == '/api/auth/refresh') {
          refreshCalls++;
          return _json({'accessToken': 'new-access', 'refreshToken': 'new-refresh'});
        }
        if (request.url.path == '/api/announcements') {
          return _json({'announcements': []});
        }
        if (request.url.path.endsWith('/members')) {
          return _json({'members': []});
        }
        if (request.url.path.endsWith('/tasks')) {
          return _json({'tasks': []});
        }
        return _json({'message': 'Not found'}, 404);
      });
      final api = ApiClient(baseUrl: 'http://127.0.0.1:3000/api', httpClient: client, storageAdapter: storage);
      final repo = AppRepository(apiClient: api, cacheService: cache);
      repo.setScope('org-1');

      expect(await repo.login('owner@example.com', 'synthetic-password'), isTrue);
      expect(repo.hasSession, isTrue);
      repo.setMembers([MemberRecord.fromJson(_member('mem-1', 'org-1', 'Protected member'))]);
      repo.setTasks([TaskItem.fromJson(_task('tsk-1', 'org-1', 'Protected task'))]);
      repo.setAnnouncements([
        AnnouncementItem.fromJson(_announcement('ann-1', ['org-1'], 'Protected announcement')),
      ]);
      for (final destination in ['members', 'tasks', 'announcements']) {
        await cache.saveSnapshot(
          accountId: 'usr-owner',
          scope: 'org-1',
          destination: destination,
          rawPayload: destination == 'members'
              ? [_member('mem-1', 'org-1', 'Protected member')]
              : destination == 'tasks'
              ? [_task('tsk-1', 'org-1', 'Protected task')]
              : [
                  _announcement('ann-1', ['org-1'], 'Protected announcement'),
                ],
        );
        await cache.saveSnapshot(accountId: 'usr-other', scope: 'org-1', destination: destination, rawPayload: []);
      }

      revoked = true;
      await repo.refreshCurrentScope();

      expect(meCalls, 3, reason: 'the failed refresh attempt must be followed by exactly one request retry');
      expect(refreshCalls, 1);
      expect(repo.requiresSignIn, isTrue);
      expect(repo.hasSession, isFalse);
      expect(repo.currentUser.id, isEmpty);
      expect(repo.organizations, isEmpty);
      expect(repo.allMembers, isEmpty);
      expect(repo.allTasks, isEmpty);
      expect(repo.allAnnouncements, isEmpty);
      expect(await api.getAccessToken(), isNull);
      expect(await api.getRefreshToken(), isNull);
      for (final destination in ['members', 'tasks', 'announcements']) {
        expect(await cache.getSnapshot(accountId: 'usr-owner', scope: 'org-1', destination: destination), isNull);
        expect(await cache.getSnapshot(accountId: 'usr-other', scope: 'org-1', destination: destination), isNotNull);
      }
    });

    test('403 from account validation clears the full account instead of misattributing a scope', () async {
      final storage = InMemoryStorageAdapter();
      final cache = SecureCacheService(storageAdapter: storage);
      final client = MockClient((request) async => _json({'message': 'Account is inactive'}, 403));
      final api = ApiClient(
        baseUrl: 'http://127.0.0.1:3000/api',
        httpClient: client,
        storageAdapter: storage,
      );
      await api.saveTokens(accessToken: 'test-access', refreshToken: 'test-refresh');
      final repo = AppRepository(apiClient: api, cacheService: cache);
      for (final destination in ['members', 'tasks', 'announcements']) {
        await cache.saveSnapshot(accountId: 'usr-owner', scope: 'org-1', destination: destination, rawPayload: []);
        await cache.saveSnapshot(accountId: 'usr-other', scope: 'org-1', destination: destination, rawPayload: []);
      }

      await repo.refreshCurrentScope();

      expect(repo.requiresAuthorization, isTrue);
      expect(repo.requiresSignIn, isFalse);
      expect(repo.allMembers, isEmpty);
      expect(repo.allTasks, isEmpty);
      expect(repo.allAnnouncements, isEmpty);
      expect(repo.organizations, isEmpty);
      expect(await api.getAccessToken(), isNull);
      expect(await api.getRefreshToken(), isNull);
      for (final destination in ['members', 'tasks', 'announcements']) {
        expect(await cache.getSnapshot(accountId: 'usr-owner', scope: 'org-1', destination: destination), isNull);
        expect(await cache.getSnapshot(accountId: 'usr-other', scope: 'org-1', destination: destination), isNotNull);
      }
    });

    test('403 clears only the denied organization from memory and combined caches', () async {
      final storage = InMemoryStorageAdapter();
      final cache = SecureCacheService(storageAdapter: storage);
      final client = MockClient((request) async {
        if (request.url.path == '/api/auth/me') {
          return _json({'user': _user(), 'organizations': _organizations});
        }
        if (request.url.path == '/api/organizations/org-1/members') {
          return _json({'message': 'Membership revoked'}, 403);
        }
        if (request.url.path.endsWith('/members')) {
          return _json({'members': []});
        }
        if (request.url.path.endsWith('/tasks')) {
          return _json({'tasks': []});
        }
        if (request.url.path == '/api/announcements') {
          return _json({'announcements': []});
        }
        return _json({'message': 'Not found'}, 404);
      });
      final repo = AppRepository(
        apiClient: ApiClient(baseUrl: 'http://127.0.0.1:3000/api', httpClient: client, storageAdapter: storage),
        cacheService: cache,
      )..setScope('org-1');
      repo.setMembers([MemberRecord.fromJson(_member('mem-1', 'org-1', 'Denied member')), MemberRecord.fromJson(_member('mem-2', 'org-2', 'Allowed member'))]);
      repo.setTasks([TaskItem.fromJson(_task('tsk-1', 'org-1', 'Denied task')), TaskItem.fromJson(_task('tsk-2', 'org-2', 'Allowed task'))]);
      repo.setAnnouncements([
        AnnouncementItem.fromJson(_announcement('ann-1', ['org-1'], 'Denied announcement')),
        AnnouncementItem.fromJson(_announcement('ann-2', ['org-1', 'org-2'], 'Shared announcement')),
        AnnouncementItem.fromJson(_announcement('ann-3', ['org-2'], 'Allowed announcement')),
      ]);
      for (final destination in ['members', 'tasks', 'announcements']) {
        final rows = destination == 'members'
            ? [_member('mem-1', 'org-1', 'Denied member'), _member('mem-2', 'org-2', 'Allowed member')]
            : destination == 'tasks'
            ? [_task('tsk-1', 'org-1', 'Denied task'), _task('tsk-2', 'org-2', 'Allowed task')]
            : [
                _announcement('ann-1', ['org-1'], 'Denied announcement'),
                _announcement('ann-2', ['org-1', 'org-2'], 'Shared announcement'),
                _announcement('ann-3', ['org-2'], 'Allowed announcement'),
              ];
        await cache.saveSnapshot(accountId: 'usr-owner', scope: 'all', destination: destination, rawPayload: rows);
        await cache.saveSnapshot(accountId: 'usr-owner', scope: 'org-1', destination: destination, rawPayload: rows);
        await cache.saveSnapshot(accountId: 'usr-owner', scope: 'org-2', destination: destination, rawPayload: rows);
        await cache.saveSnapshot(accountId: 'usr-other', scope: 'org-1', destination: destination, rawPayload: rows);
      }

      await repo.refreshCurrentScope();

      expect(repo.hasAccessToScope, isFalse);
      expect(repo.allMembers.map((record) => record.id), ['mem-2']);
      expect(repo.allTasks.map((record) => record.id), ['tsk-2']);
      expect(repo.allAnnouncements.map((record) => record.id), ['ann-2', 'ann-3']);
      expect(repo.allAnnouncements.first.targetOrgs, ['org-2']);
      for (final destination in ['members', 'tasks', 'announcements']) {
        expect(await cache.getSnapshot(accountId: 'usr-owner', scope: 'org-1', destination: destination), isNull);
        expect(await cache.getSnapshot(accountId: 'usr-owner', scope: 'org-2', destination: destination), isNotNull);
        final combined = await cache.getSnapshot(accountId: 'usr-owner', scope: 'all', destination: destination);
        expect(combined, isNotNull);
        if (destination != 'announcements') {
          expect((combined!.payload as List).every((row) => (row['orgId'] ?? row['organizationId']) != 'org-1'), isTrue);
        } else {
          expect((combined!.payload as List).map((row) => row['id']), ['ann-2', 'ann-3']);
          expect((combined.payload as List).first['targetOrganizations'], ['org-2']);
        }
        expect(await cache.getSnapshot(accountId: 'usr-other', scope: 'org-1', destination: destination), isNotNull);
      }

      repo.setScope('org-2');
      expect(repo.hasAccessToScope, isTrue);
      expect(repo.getScopedMembers().single.displayName, 'Allowed member');
      repo.setScope('org-1');
      expect(repo.hasAccessToScope, isFalse);
      expect(repo.getScopedMembers(), isEmpty);
    });

    testWidgets('403 keeps every protected destination gated until organization cache cleanup completes', (tester) async {
      final storage = InMemoryStorageAdapter();
      final cache = _DelayedOrganizationCache(storageAdapter: storage);
      final client = MockClient((request) async {
        if (request.url.path == '/api/auth/me') {
          return _json({'user': _user(), 'organizations': _organizations});
        }
        if (request.url.path == '/api/organizations/org-1/members') {
          return _json({'message': 'Membership revoked'}, 403);
        }
        return _json({'message': 'Not found'}, 404);
      });
      final repo = AppRepository(
        apiClient: ApiClient(baseUrl: 'http://127.0.0.1:3000/api', httpClient: client, storageAdapter: storage),
        cacheService: cache,
      )..setScope('org-1');
      repo.setMembers([
        MemberRecord.fromJson(_member('mem-1', 'org-1', 'Protected member')),
        MemberRecord.fromJson(_member('mem-2', 'org-2', 'Allowed member')),
      ]);
      repo.setTasks([TaskItem.fromJson(_task('tsk-1', 'org-1', 'Protected task')), TaskItem.fromJson(_task('tsk-2', 'org-2', 'Allowed task'))]);
      repo.setAnnouncements([
        AnnouncementItem.fromJson(_announcement('ann-1', ['org-1'], 'Protected announcement')),
        AnnouncementItem.fromJson(_announcement('ann-2', ['org-2'], 'Allowed announcement')),
      ]);
      await tester.pumpWidget(MaterialApp(home: HomeShell(repo: repo)));

      await tester.tap(find.byIcon(Icons.people_outline));
      await tester.pumpAndSettle();
      expect(find.text('Protected member'), findsOneWidget);
      await tester.tap(find.byIcon(Icons.check_box_outlined));
      await tester.pumpAndSettle();
      expect(find.text('Protected task'), findsOneWidget);
      await tester.tap(find.byIcon(Icons.campaign_outlined));
      await tester.pumpAndSettle();
      expect(find.text('Protected announcement'), findsOneWidget);
      await tester.tap(find.byIcon(Icons.dashboard_outlined));
      await tester.pumpAndSettle();

      final refresh = repo.refreshCurrentScope();
      for (var i = 0; i < 10 && !cache.started.isCompleted; i++) {
        await tester.pump();
      }
      expect(cache.started.isCompleted, isTrue);
      expect(repo.hasAccessToScope, isFalse);
      expect(find.text('Access to this organization was denied. Choose another organization to continue.'), findsOneWidget);
      expect(repo.allMembers.map((record) => record.orgId), ['org-2']);
      expect(repo.allTasks.map((record) => record.orgId), ['org-2']);
      expect(repo.allAnnouncements.map((record) => record.targetOrgs), [
        ['org-2'],
      ]);

      for (final icon in [Icons.people_outline, Icons.check_box_outlined, Icons.campaign_outlined]) {
        await tester.tap(find.byIcon(icon));
        await tester.pump();
        expect(find.text('Protected member'), findsNothing);
        expect(find.text('Protected task'), findsNothing);
        expect(find.text('Protected announcement'), findsNothing);
      }

      cache.release.complete();
      await refresh;
      await tester.pumpAndSettle();
      repo.setScope('org-2');
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.check_box_outlined));
      await tester.pumpAndSettle();
      expect(find.text('Allowed task'), findsOneWidget);
    });

    testWidgets('401 replaces the application shell with a sign-in gate', (tester) async {
      final storage = InMemoryStorageAdapter();
      var revoked = false;
      final client = MockClient((request) async {
        if (request.url.path == '/api/auth/me') {
          return revoked ? _json({'message': 'Session revoked'}, 401) : _json({'user': _user(), 'organizations': _organizations});
        }
        if (request.url.path == '/api/auth/refresh') {
          return _json({'accessToken': 'new-access', 'refreshToken': 'new-refresh'});
        }
        return _json({'members': [], 'tasks': [], 'announcements': []});
      });
      final api = ApiClient(baseUrl: 'http://127.0.0.1:3000/api', httpClient: client, storageAdapter: storage);
      await api.saveTokens(accessToken: 'old-access', refreshToken: 'refresh-token');
      final repo = AppRepository(
        apiClient: api,
        cacheService: SecureCacheService(storageAdapter: storage),
      );
      await tester.pumpWidget(MaterialApp(home: HomeShell(repo: repo)));
      expect(find.text('Actionable Tasks'), findsOneWidget);

      revoked = true;
      await repo.refreshCurrentScope();
      await tester.pumpAndSettle();

      expect(repo.requiresSignIn, isTrue);
      expect(find.text('Your session expired. Sign in again to continue.'), findsOneWidget);
      expect(find.byKey(const Key('btn-session-sign-in')), findsOneWidget);
      expect(find.text('Actionable Tasks'), findsNothing);
      expect(find.text('Sign In to Account'), findsNothing);
    });
  });
}
