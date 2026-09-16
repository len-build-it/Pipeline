import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/services/api_client.dart';
import 'package:mobile/services/secure_cache_service.dart';

void main() {
  group('ApiClient Authentication & Error Discrimination (REQ-001, REQ-008)', () {
    late InMemoryStorageAdapter storage;

    setUp(() {
      storage = InMemoryStorageAdapter();
    });

    test('Network error throws NetworkException without clearing tokens', () async {
      final mockClient = MockClient((request) async {
        throw const SocketException('Connection refused');
      });

      final client = ApiClient(
        baseUrl: 'http://127.0.0.1:3000/api',
        httpClient: mockClient,
        storageAdapter: storage,
      );

      await client.saveTokens(
        accessToken: 'access_123',
        refreshToken: 'refresh_123',
      );

      await expectLater(
        () => client.request(method: 'GET', path: '/tasks'),
        throwsA(isA<NetworkException>()),
      );

      // Tokens must NOT be cleared on network failure (might be intermittent offline)
      expect(await client.getAccessToken(), equals('access_123'));
    });

    test('401 triggers serialized token refresh and retries with new token', () async {
      int tasksCalls = 0;
      int refreshCalls = 0;

      final mockClient = MockClient((request) async {
        if (request.url.path == '/api/tasks') {
          tasksCalls++;
          final auth = request.headers['authorization'];
          if (auth == 'Bearer old_token') {
            return http.Response(jsonEncode({'message': 'Unauthorized'}), 401);
          } else if (auth == 'Bearer new_token') {
            return http.Response(jsonEncode({'tasks': []}), 200);
          }
          return http.Response(jsonEncode({'message': 'Invalid token'}), 401);
        } else if (request.url.path == '/api/auth/refresh') {
          refreshCalls++;
          final body = jsonDecode(request.body);
          if (body['refreshToken'] == 'old_refresh') {
            return http.Response(
              jsonEncode({
                'accessToken': 'new_token',
                'refreshToken': 'new_refresh',
              }),
              200,
            );
          }
          return http.Response(jsonEncode({'message': 'Invalid refresh token'}), 401);
        }
        return http.Response('Not found', 404);
      });

      final client = ApiClient(
        baseUrl: 'http://127.0.0.1:3000/api',
        httpClient: mockClient,
        storageAdapter: storage,
      );

      await client.saveTokens(
        accessToken: 'old_token',
        refreshToken: 'old_refresh',
      );

      final res = await client.request(method: 'GET', path: '/tasks');
      expect(res, isNotNull);
      expect(tasksCalls, equals(2)); // initial 401 + retry with new token
      expect(refreshCalls, equals(1));
      expect(await client.getAccessToken(), equals('new_token'));
      expect(await client.getRefreshToken(), equals('new_refresh'));
    });

    test('Failed refresh (revoked session) clears tokens and throws AuthenticationException', () async {
      final mockClient = MockClient((request) async {
        if (request.url.path == '/api/tasks') {
          return http.Response(jsonEncode({'message': 'Session revoked'}), 401);
        } else if (request.url.path == '/api/auth/refresh') {
          return http.Response(jsonEncode({'message': 'Refresh token expired'}), 401);
        }
        return http.Response('Not found', 404);
      });

      final client = ApiClient(
        baseUrl: 'http://127.0.0.1:3000/api',
        httpClient: mockClient,
        storageAdapter: storage,
      );

      await client.saveTokens(
        accessToken: 'revoked_token',
        refreshToken: 'revoked_refresh',
      );

      await expectLater(
        () => client.request(method: 'GET', path: '/tasks'),
        throwsA(isA<AuthenticationException>()),
      );

      // Tokens must be cleared on failed refresh
      expect(await client.getAccessToken(), isNull);
      expect(await client.getRefreshToken(), isNull);
    });

    test('403 Forbidden throws AuthorizationException with server message', () async {
      final mockClient = MockClient((request) async {
        return http.Response(jsonEncode({'message': 'Active membership required'}), 403);
      });

      final client = ApiClient(
        baseUrl: 'http://127.0.0.1:3000/api',
        httpClient: mockClient,
        storageAdapter: storage,
      );

      await client.saveTokens(accessToken: 'tok', refreshToken: 'ref');

      await expectLater(
        () => client.request(method: 'GET', path: '/members'),
        throwsA(
          predicate((e) => e is AuthorizationException && e.message == 'Active membership required'),
        ),
      );
    });

    test('409 Conflict throws ConflictException', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'message': 'This task was modified by another user'}),
          409,
        );
      });

      final client = ApiClient(
        baseUrl: 'http://127.0.0.1:3000/api',
        httpClient: mockClient,
        storageAdapter: storage,
      );

      await client.saveTokens(accessToken: 'tok', refreshToken: 'ref');

      await expectLater(
        () => client.request(method: 'PATCH', path: '/tasks/1', body: {'version': 1}),
        throwsA(isA<ConflictException>()),
      );
    });

    test('400 Bad Request throws ValidationException', () async {
      final mockClient = MockClient((request) async {
        return http.Response(jsonEncode({'message': 'Task title is required'}), 400);
      });

      final client = ApiClient(
        baseUrl: 'http://127.0.0.1:3000/api',
        httpClient: mockClient,
        storageAdapter: storage,
      );

      await client.saveTokens(accessToken: 'tok', refreshToken: 'ref');

      await expectLater(
        () => client.request(method: 'POST', path: '/tasks', body: {}),
        throwsA(isA<ValidationException>()),
      );
    });
  });
}
