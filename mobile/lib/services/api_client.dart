import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'secure_cache_service.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, [this.statusCode]);

  @override
  String toString() => message;
}

class NetworkException extends ApiException {
  NetworkException(super.message);
}

class AuthenticationException extends ApiException {
  AuthenticationException(super.message, [super.statusCode]);
}

class AuthorizationException extends ApiException {
  AuthorizationException(super.message, [super.statusCode]);
}

class ValidationException extends ApiException {
  ValidationException(super.message, [super.statusCode]);
}

class ConflictException extends ApiException {
  ConflictException(super.message, [super.statusCode]);
}

class ApiClient {
  static const String defaultAndroidEmulatorBaseUrl = 'http://10.0.2.2:3000/api';
  static const String defaultLocalhostBaseUrl = 'http://127.0.0.1:3000/api';

  final String baseUrl;
  final http.Client httpClient;
  final SecureStorageAdapter storage;

  Completer<String?>? _refreshCompleter;

  ApiClient({
    String? baseUrl,
    http.Client? httpClient,
    SecureStorageAdapter? storageAdapter,
  })  : baseUrl = baseUrl ?? _resolveDefaultBaseUrl(),
        httpClient = httpClient ?? http.Client(),
        storage = storageAdapter ?? FlutterSecureStorageAdapter();

  static String _resolveDefaultBaseUrl() {
    try {
      if (Platform.isAndroid) {
        return defaultAndroidEmulatorBaseUrl;
      }
    } catch (_) {}
    return defaultLocalhostBaseUrl;
  }

  // Token storage
  Future<String?> getAccessToken() => storage.read(key: 'auth_access_token');
  Future<String?> getRefreshToken() => storage.read(key: 'auth_refresh_token');

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    DateTime? sessionExpiry,
  }) async {
    await storage.write(key: 'auth_access_token', value: accessToken);
    await storage.write(key: 'auth_refresh_token', value: refreshToken);
    if (sessionExpiry != null) {
      await storage.write(key: 'auth_session_expiry', value: sessionExpiry.toIso8601String());
    }
  }

  Future<void> clearTokens() async {
    await storage.delete(key: 'auth_access_token');
    await storage.delete(key: 'auth_refresh_token');
    await storage.delete(key: 'auth_session_expiry');
  }

  Future<DateTime?> getSessionExpiry() async {
    final raw = await storage.read(key: 'auth_session_expiry');
    if (raw == null || raw.isEmpty) return null;
    try {
      return DateTime.parse(raw);
    } catch (_) {
      return null;
    }
  }

  // Serialized token refresh
  Future<String?> _refreshAccessTokenSerialized() async {
    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }

    _refreshCompleter = Completer<String?>();

    try {
      final currentRefreshToken = await getRefreshToken();
      if (currentRefreshToken == null || currentRefreshToken.isEmpty) {
        await clearTokens();
        _refreshCompleter!.complete(null);
        return null;
      }

      final uri = Uri.parse('$baseUrl/auth/refresh');
      final response = await httpClient.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'refreshToken': currentRefreshToken}),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final newAccessToken = data['accessToken'] as String?;
        final newRefreshToken = data['refreshToken'] as String?;

        if (newAccessToken != null && newRefreshToken != null) {
          await saveTokens(
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          );
          _refreshCompleter!.complete(newAccessToken);
          return newAccessToken;
        }
      }

      // Refresh failed or returned 401/403
      await clearTokens();
      _refreshCompleter!.complete(null);
      return null;
    } catch (e) {
      // If network error during refresh, do NOT clear tokens immediately (might be temporary offline)
      if (e is SocketException || e is http.ClientException || e is TimeoutException) {
        _refreshCompleter!.completeError(NetworkException('Unable to reach server to refresh session: $e'));
      } else {
        await clearTokens();
        _refreshCompleter!.complete(null);
      }
      return null;
    } finally {
      _refreshCompleter = null;
    }
  }

  Future<dynamic> request({
    required String method,
    required String path,
    Map<String, String>? queryParams,
    dynamic body,
    bool requiresAuth = true,
  }) async {
    Uri uri = Uri.parse('$baseUrl$path');
    if (queryParams != null && queryParams.isNotEmpty) {
      uri = uri.replace(queryParameters: queryParams);
    }

    final headers = <String, String>{
      'Accept': 'application/json',
    };

    if (body != null) {
      headers['Content-Type'] = 'application/json';
    }

    String? token;
    if (requiresAuth) {
      token = await getAccessToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    http.Response response;
    try {
      response = await _sendWithTimeout(method, uri, headers, body);
    } catch (e) {
      if (e is SocketException || e is http.ClientException || e is TimeoutException) {
        throw NetworkException('Network error connecting to $uri: $e');
      }
      rethrow;
    }

    // Handle 401 with serialized token refresh
    if (response.statusCode == 401 && requiresAuth) {
      final newToken = await _refreshAccessTokenSerialized();
      if (newToken != null) {
        headers['Authorization'] = 'Bearer $newToken';
        try {
          response = await _sendWithTimeout(method, uri, headers, body);
        } catch (e) {
          if (e is SocketException || e is http.ClientException || e is TimeoutException) {
            throw NetworkException('Network error connecting to $uri: $e');
          }
          rethrow;
        }
      } else {
        throw AuthenticationException('Authentication session expired or revoked (401).', 401);
      }
    }

    return _handleResponse(response);
  }

  Future<http.Response> _sendWithTimeout(
    String method,
    Uri uri,
    Map<String, String> headers,
    dynamic body,
  ) async {
    final payload = body != null ? jsonEncode(body) : null;
    switch (method.toUpperCase()) {
      case 'GET':
        return httpClient.get(uri, headers: headers).timeout(const Duration(seconds: 15));
      case 'POST':
        return httpClient.post(uri, headers: headers, body: payload).timeout(const Duration(seconds: 15));
      case 'PATCH':
        return httpClient.patch(uri, headers: headers, body: payload).timeout(const Duration(seconds: 15));
      case 'DELETE':
        return httpClient.delete(uri, headers: headers, body: payload).timeout(const Duration(seconds: 15));
      default:
        throw ArgumentError('Unsupported HTTP method: $method');
    }
  }

  dynamic _handleResponse(http.Response response) {
    dynamic jsonBody;
    try {
      if (response.body.isNotEmpty) {
        jsonBody = jsonDecode(response.body);
      }
    } catch (_) {
      jsonBody = response.body;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonBody;
    }

    String message = 'Server error (${response.statusCode})';
    if (jsonBody is Map && jsonBody['message'] != null) {
      message = jsonBody['message'].toString();
    } else if (jsonBody is String && jsonBody.isNotEmpty) {
      message = jsonBody;
    }

    if (response.statusCode == 401) {
      throw AuthenticationException(message, response.statusCode);
    } else if (response.statusCode == 403) {
      throw AuthorizationException(message, response.statusCode);
    } else if (response.statusCode == 409) {
      throw ConflictException(message, response.statusCode);
    } else if (response.statusCode == 400) {
      throw ValidationException(message, response.statusCode);
    } else {
      throw ApiException(message, response.statusCode);
    }
  }

  // Auth endpoints
  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await request(
      method: 'POST',
      path: '/auth/login',
      body: {'email': email, 'password': password},
      requiresAuth: false,
    );
    final data = res as Map<String, dynamic>;
    final accessToken = data['accessToken'] as String?;
    final refreshToken = data['refreshToken'] as String?;
    if (accessToken != null && refreshToken != null) {
      await saveTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
        sessionExpiry: DateTime.now().add(const Duration(days: 30)),
      );
    }
    return data;
  }

  Future<Map<String, dynamic>> getCurrentUser() async {
    final res = await request(method: 'GET', path: '/auth/me');
    return res as Map<String, dynamic>;
  }

  Future<void> logout() async {
    try {
      final rt = await getRefreshToken();
      await request(
        method: 'POST',
        path: '/auth/logout',
        body: {'refreshToken': rt},
      );
    } catch (_) {
      // Best effort remote logout
    } finally {
      await clearTokens();
    }
  }

  Future<Map<String, dynamic>> acceptInvitation({
    required String token,
    required String email,
    required String password,
    required String displayName,
  }) async {
    final res = await request(
      method: 'POST',
      path: '/auth/invitations/accept',
      body: {
        'token': token,
        'email': email,
        'password': password,
        'displayName': displayName,
      },
      requiresAuth: false,
    );
    return res as Map<String, dynamic>;
  }

  // Overview endpoint
  Future<Map<String, dynamic>> getOverview(String scope) async {
    final res = await request(
      method: 'GET',
      path: '/overview',
      queryParams: {'scope': scope},
    );
    return res as Map<String, dynamic>;
  }

  // Members endpoints
  Future<Map<String, dynamic>> getMembers(
    String scope, {
    int page = 1,
    int limit = 25,
    String? search,
    String? role,
    String? status,
  }) async {
    final params = {
      'scope': scope,
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (role != null && role.isNotEmpty) params['role'] = role;
    if (status != null && status.isNotEmpty) params['status'] = status;

    final res = await request(
      method: 'GET',
      path: '/members',
      queryParams: params,
    );
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> inviteMember({
    required String organizationId,
    required String email,
    required String role,
  }) async {
    final res = await request(
      method: 'POST',
      path: '/members/invitations',
      body: {
        'organizationId': organizationId,
        'email': email,
        'role': role,
      },
    );
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateMemberNotes(String memberId, String notes) async {
    final res = await request(
      method: 'PATCH',
      path: '/members/$memberId/notes',
      body: {'notes': notes},
    );
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateMemberStatus(String memberId, String status) async {
    final res = await request(
      method: 'PATCH',
      path: '/members/$memberId/status',
      body: {'status': status},
    );
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateMemberRole(String memberId, String role) async {
    final res = await request(
      method: 'PATCH',
      path: '/members/$memberId/role',
      body: {'role': role},
    );
    return res as Map<String, dynamic>;
  }

  // Tasks endpoints
  Future<Map<String, dynamic>> getTasks(
    String scope, {
    int page = 1,
    int limit = 25,
    String? status,
    String? priority,
    String? assigneeId,
    String? label,
    String? search,
    bool? overdue,
    bool? archived,
  }) async {
    final params = {
      'scope': scope,
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (status != null && status.isNotEmpty) params['status'] = status;
    if (priority != null && priority.isNotEmpty) params['priority'] = priority;
    if (assigneeId != null && assigneeId.isNotEmpty) params['assigneeId'] = assigneeId;
    if (label != null && label.isNotEmpty) params['label'] = label;
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (overdue != null) params['overdue'] = overdue.toString();
    if (archived != null) params['archived'] = archived.toString();

    final res = await request(
      method: 'GET',
      path: '/tasks',
      queryParams: params,
    );
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getTask(String taskId) async {
    final res = await request(method: 'GET', path: '/tasks/$taskId');
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createTask({
    required String organizationId,
    required String title,
    String description = '',
    String priority = 'Medium',
    String? assigneeId,
    String? dueDate,
    List<String> labels = const [],
  }) async {
    final body = {
      'organizationId': organizationId,
      'title': title,
      'description': description,
      'priority': priority,
      'labels': labels,
    };
    if (assigneeId != null && assigneeId.isNotEmpty) body['assigneeId'] = assigneeId;
    if (dueDate != null && dueDate.isNotEmpty) body['dueDate'] = dueDate;

    final res = await request(method: 'POST', path: '/tasks', body: body);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateTask(
    String taskId, {
    required int version,
    String? title,
    String? description,
    String? priority,
    String? status,
    String? assigneeId,
    String? dueDate,
    List<String>? labels,
  }) async {
    final body = <String, dynamic>{'version': version};
    if (title != null) body['title'] = title;
    if (description != null) body['description'] = description;
    if (priority != null) body['priority'] = priority;
    if (status != null) body['status'] = status;
    if (assigneeId != null) body['assigneeId'] = assigneeId;
    if (dueDate != null) body['dueDate'] = dueDate;
    if (labels != null) body['labels'] = labels;

    final res = await request(method: 'PATCH', path: '/tasks/$taskId', body: body);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateTaskStatus(String taskId, String status, int version) async {
    final res = await request(
      method: 'PATCH',
      path: '/tasks/$taskId/status',
      body: {'status': status, 'version': version},
    );
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> archiveTask(String taskId) async {
    final res = await request(method: 'POST', path: '/tasks/$taskId/archive');
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> addTaskComment(String taskId, String body) async {
    final res = await request(
      method: 'POST',
      path: '/tasks/$taskId/comments',
      body: {'body': body},
    );
    return res as Map<String, dynamic>;
  }

  Future<void> deleteTaskComment(String commentId) async {
    await request(method: 'DELETE', path: '/tasks/comments/$commentId');
  }

  // Announcements endpoints
  Future<Map<String, dynamic>> getAnnouncements(
    String scope, {
    int page = 1,
    int limit = 25,
    String? search,
    String? status,
    bool? archived,
  }) async {
    final params = {
      'scope': scope,
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (status != null && status.isNotEmpty) params['status'] = status;
    if (archived != null) params['archived'] = archived.toString();

    final res = await request(
      method: 'GET',
      path: '/announcements',
      queryParams: params,
    );
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getAnnouncement(String announcementId) async {
    final res = await request(method: 'GET', path: '/announcements/$announcementId');
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createAnnouncement({
    required String title,
    required String body,
    required List<String> targetOrganizations,
    bool publishNow = false,
  }) async {
    final res = await request(
      method: 'POST',
      path: '/announcements',
      body: {
        'title': title,
        'body': body,
        'targetOrganizations': targetOrganizations,
        'status': publishNow ? 'Published' : 'Draft',
      },
    );
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> publishAnnouncement(String announcementId) async {
    final res = await request(
      method: 'POST',
      path: '/announcements/$announcementId/publish',
    );
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> archiveAnnouncement(String announcementId) async {
    final res = await request(
      method: 'POST',
      path: '/announcements/$announcementId/archive',
    );
    return res as Map<String, dynamic>;
  }
}
