import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/data/app_repository.dart';
import 'package:mobile/services/api_client.dart';
import 'package:mobile/services/secure_cache_service.dart';

const organizations = [
  {
    'id': 'org-live',
    'name': 'Live Team',
    'status': 'active',
    'role': 'Member',
    'membership_status': 'active',
  },
];
Map<String, dynamic> account() => {
  'user': {
    'id': 'user-live',
    'email': 'test@example.com',
    'displayName': 'Test Member',
    'status': 'active',
    'isOwner': false,
  },
  'organizations': organizations,
};
http.Response json(Map<String, dynamic> data, [int status = 200]) =>
    http.Response(jsonEncode(data), status);

AppRepository repository(
  InMemoryStorageAdapter storage,
  Future<http.Response> Function(http.Request) handler,
) => AppRepository(
  apiClient: ApiClient(
    storageAdapter: storage,
    httpClient: MockClient(handler),
  ),
  cacheService: SecureCacheService(storageAdapter: storage),
);
Future<http.Response> live(http.Request request) async {
  if (request.url.path.endsWith('/auth/login') ||
      request.url.path.endsWith('/auth/refresh')) {
    return json({
      ...account(),
      'accessToken': 'access',
      'refreshToken': 'refresh',
      'sessionId': 'session',
      'expiresAt': DateTime.now()
          .add(const Duration(days: 7))
          .toIso8601String(),
    });
  }
  if (request.url.path.endsWith('/auth/me')) {
    if (!request.headers.containsKey('authorization')) return json({}, 401);
    return json(account());
  }
  return json({'members': [], 'tasks': [], 'announcements': []});
}
