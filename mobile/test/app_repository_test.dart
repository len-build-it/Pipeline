import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/data/app_repository.dart';
import 'package:mobile/models/models.dart';
import 'package:mobile/services/api_client.dart';
import 'package:mobile/services/secure_cache_service.dart';

void main() {
  group('AppRepository Sync, Offline Reads & Write Restrictions (FEAT-005)', () {
    late InMemoryStorageAdapter storage;
    late SecureCacheService cache;

    setUp(() {
      storage = InMemoryStorageAdapter();
      cache = SecureCacheService(storageAdapter: storage);
    });

    test('Successful online refresh updates records and writes bounded cache', () async {
      final mockClient = MockClient((request) async {
        if (request.url.path == '/api/auth/me') {
          return http.Response(
            jsonEncode({
              'user': {
                'id': 'usr-len',
                'email': 'len@example.com',
                'displayName': 'Len',
                'avatarColor': '#0F766E',
                'status': 'active',
                'isGlobalOwner': true,
                'skills': ['Architecture'],
                'interests': ['Systems'],
                'memberships': [
                  {'orgId': 'org-1', 'role': 'Owner', 'status': 'active'},
                ],
              },
            }),
            200,
          );
        } else if (request.url.path == '/api/members') {
          return http.Response(
            jsonEncode({
              'members': [
                {
                  'id': 'mem-1',
                  'userId': 'usr-len',
                  'orgId': 'org-1',
                  'displayName': 'Len',
                  'email': 'len@example.com',
                  'avatarColor': '#0F766E',
                  'role': 'Owner',
                  'status': 'active',
                  'joinedAt': '2026-08-01',
                  'skills': ['Architecture'],
                  'interests': ['Systems'],
                  'notes': 'Sensitive owner notes',
                },
              ],
            }),
            200,
          );
        } else if (request.url.path == '/api/tasks') {
          return http.Response(
            jsonEncode({
              'tasks': [
                {
                  'id': 'tsk-1',
                  'organizationId': 'org-1',
                  'title': 'Online Task 1',
                  'description': 'Task description',
                  'creatorId': 'usr-len',
                  'creatorName': 'Len',
                  'status': 'Backlog',
                  'priority': 'High',
                  'dueDate': '2026-09-30',
                  'labels': ['backend'],
                  'version': 1,
                  'archived': false,
                  'updatedAt': '2026-09-17T00:00:00Z',
                  'comments': [],
                },
              ],
            }),
            200,
          );
        } else if (request.url.path == '/api/announcements') {
          return http.Response(
            jsonEncode({
              'announcements': [
                {
                  'id': 'ann-1',
                  'title': 'Live Announcement',
                  'body': 'Content body',
                  'authorId': 'usr-len',
                  'authorName': 'Len',
                  'targetOrganizations': ['org-1'],
                  'publicationStatus': 'Published',
                  'publishedAt': '2026-09-17',
                  'archived': false,
                },
              ],
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      final apiClient = ApiClient(
        baseUrl: 'http://127.0.0.1:3000/api',
        httpClient: mockClient,
        storageAdapter: storage,
      );

      final repo = AppRepository(
        apiClient: apiClient,
        cacheService: cache,
      );

      repo.setScope('org-1');
      await repo.refreshCurrentScope();

      expect(repo.isOffline, isFalse);
      expect(repo.isStale, isFalse);
      expect(repo.cacheAge, isNull);
      expect(repo.getScopedTasks().any((t) => t.id == 'tsk-1'), isTrue);

      // Verify snapshots were saved in cache
      final tasksSnapshot = await cache.getSnapshot(
        accountId: 'usr-len',
        scope: 'org-1',
        destination: 'tasks',
      );
      expect(tasksSnapshot, isNotNull);
      final cachedTasks = tasksSnapshot!.payload as List;
      expect(cachedTasks.length, equals(1));
      expect(cachedTasks[0]['title'], equals('Online Task 1'));
    });

    test('Network failure loads cached snapshot and enables stale indicator (REQ-002, REQ-003)', () async {
      // Pre-populate cache with snapshot
      await cache.saveSnapshot(
        accountId: 'usr-offline',
        scope: 'org-1',
        destination: 'tasks',
        rawPayload: [
          {
            'id': 'tsk-cached-99',
            'orgId': 'org-1',
            'title': 'Cached Offline Task',
            'description': 'Description from cache',
            'creator': 'usr-offline',
            'creatorName': 'Offline User',
            'status': 'In progress',
            'priority': 'Medium',
            'labels': ['mobile'],
            'version': 1,
            'archived': false,
            'updatedAt': '2026-09-16T10:00:00Z',
          },
        ],
      );

      // Mock client that fails with connection refused
      final mockClient = MockClient((request) async {
        throw http.ClientException('Failed to connect to host');
      });

      final apiClient = ApiClient(
        baseUrl: 'http://127.0.0.1:3000/api',
        httpClient: mockClient,
        storageAdapter: storage,
      );

      final repo = AppRepository(
        apiClient: apiClient,
        cacheService: cache,
      );

      // Set user and scope to match cache
      repo.switchPersona(const UserAccount(
        id: 'usr-offline',
        email: 'offline@example.com',
        displayName: 'Offline User',
        avatarColor: Color(0xFF0F766E),
        status: 'active',
        isGlobalOwner: false,
        skills: [],
        interests: [],
        memberships: [
          UserMembership(orgId: 'org-1', role: 'Member', status: 'active'),
        ],
      ));
      repo.setScope('org-1');

      await repo.refreshCurrentScope();

      // Verified offline state
      expect(repo.isOffline, isTrue);
      expect(repo.isStale, isTrue);
      expect(repo.cacheAge, isNotNull);

      final tasks = repo.getScopedTasks();
      expect(tasks.any((t) => t.id == 'tsk-cached-99'), isTrue);
      expect(tasks.firstWhere((t) => t.id == 'tsk-cached-99').title, equals('Cached Offline Task'));
    });

    test('Disabled offline writes: mutations rejected with explanatory message (UI-REQ-008)', () {
      final repo = AppRepository(
        cacheService: cache,
        isDemoOnly: false,
      );

      // Put repository into offline state
      repo.setOffline(true);

      // 1. Create task
      final taskSuccess = repo.createTask(
        orgId: 'org-1',
        title: 'Offline task attempt',
        description: 'Should fail',
        priority: 'High',
      );
      expect(taskSuccess, isFalse);
      expect(repo.errorMessage, contains('Cannot create tasks while offline'));

      // 2. Update status
      final statusSuccess = repo.updateTaskStatus('tsk-101', 'Done');
      expect(statusSuccess, isFalse);
      expect(repo.errorMessage, contains('Cannot update task status while offline'));

      // 3. Add comment
      final commentSuccess = repo.addTaskComment('tsk-101', 'Offline comment');
      expect(commentSuccess, isFalse);
      expect(repo.errorMessage, contains('Cannot add comments while offline'));

      // 4. Archive task
      final archiveSuccess = repo.archiveTask('tsk-101');
      expect(archiveSuccess, isFalse);
      expect(repo.errorMessage, contains('Cannot archive tasks while offline'));

      // 5. Invite member
      final inviteSuccess = repo.inviteMember(email: 'new@example.com', orgId: 'org-1', role: 'Member');
      expect(inviteSuccess, isFalse);
      expect(repo.errorMessage, contains('Cannot invite members while offline'));

      // 6. Create announcement
      final annSuccess = repo.createAnnouncement(
        title: 'Offline Announcement',
        body: 'Body',
        targetOrgs: ['org-1'],
        publishNow: false,
      );
      expect(annSuccess, isFalse);
      expect(repo.errorMessage, contains('Cannot create announcements while offline'));
    });

    test('403 Forbidden clears scope cache and denies access without showing stale data (REQ-008)', () async {
      // Pre-populate cache for org-1
      await cache.saveSnapshot(
        accountId: 'usr-jordan',
        scope: 'org-1',
        destination: 'tasks',
        rawPayload: [{'id': 'secret-task'}],
      );

      final mockClient = MockClient((request) async {
        if (request.url.path == '/api/auth/me') {
          return http.Response(
            jsonEncode({
              'user': {
                'id': 'usr-jordan',
                'email': 'jordan@example.com',
                'displayName': 'Jordan Lee',
                'avatarColor': '#EA580C',
                'status': 'active',
                'isGlobalOwner': false,
                'skills': [],
                'interests': [],
                'memberships': [
                  {'orgId': 'org-2', 'role': 'Lead', 'status': 'active'},
                ],
              },
            }),
            200,
          );
        }
        return http.Response(jsonEncode({'message': 'Active membership required'}), 403);
      });

      final apiClient = ApiClient(
        baseUrl: 'http://127.0.0.1:3000/api',
        httpClient: mockClient,
        storageAdapter: storage,
      );

      final repo = AppRepository(
        apiClient: apiClient,
        cacheService: cache,
      );

      repo.switchPersona(const UserAccount(
        id: 'usr-jordan',
        email: 'jordan@example.com',
        displayName: 'Jordan Lee',
        avatarColor: Color(0xFFEA580C),
        status: 'active',
        isGlobalOwner: false,
        skills: [],
        interests: [],
        memberships: [
          UserMembership(orgId: 'org-2', role: 'Lead', status: 'active'),
        ],
      ));

      // Attempt to access unassigned org-1
      repo.setScope('org-1');
      await repo.refreshCurrentScope();

      // Access denied and org-1 cache purged
      expect(repo.hasAccessToScope, isFalse);
      final snapAfter = await cache.getSnapshot(
        accountId: 'usr-jordan',
        scope: 'org-1',
        destination: 'tasks',
      );
      expect(snapAfter, isNull);
    });

    test('Sign out clears protected cache for current account (REQ-005)', () async {
      await cache.saveSnapshot(
        accountId: 'usr-owner',
        scope: 'org-1',
        destination: 'tasks',
        rawPayload: [{'id': 't1'}],
      );

      final mockClient = MockClient((request) async {
        return http.Response(jsonEncode({'message': 'Logged out'}), 200);
      });

      final apiClient = ApiClient(
        baseUrl: 'http://127.0.0.1:3000/api',
        httpClient: mockClient,
        storageAdapter: storage,
      );

      final repo = AppRepository(
        apiClient: apiClient,
        cacheService: cache,
      );

      await repo.logout();

      final snapAfter = await cache.getSnapshot(
        accountId: 'usr-owner',
        scope: 'org-1',
        destination: 'tasks',
      );
      expect(snapAfter, isNull);
    });
  });
}
