import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/app_repository.dart';
import 'package:mobile/services/api_client.dart';
import 'package:mobile/services/secure_cache_service.dart';

void main() {
  final baseUrl = Platform.environment['AUTH_LIVE_API'];
  test(
    'real auth routes preview, create, login, restore, bind existing account and reject replay',
    () async {
      final owner = ApiClient(
        baseUrl: baseUrl,
        storageAdapter: InMemoryStorageAdapter(),
      );
      await owner.login('len@example.com', 'password123456');
      final email =
          'mobile_${DateTime.now().microsecondsSinceEpoch}@example.com';
      final invitation = await owner.request(
        method: 'POST',
        path: '/organizations/org-1/invitations',
        body: {'email': email, 'role': 'Member'},
      );
      final token = invitation['token'] as String;
      final storage = InMemoryStorageAdapter();
      final api = ApiClient(baseUrl: baseUrl, storageAdapter: storage);
      final preview = await api.previewInvitation(token);
      expect(preview['valid'], isTrue);
      expect(preview['email'], email);
      expect(preview['organizationName'], 'AqOne');
      final accepted = await api.acceptInvitation(
        token: token,
        email: email,
        password: 'synthetic invitation password',
        displayName: 'Mobile Invitee',
      );
      expect(accepted['success'], isTrue);
      expect(accepted.containsKey('accessToken'), isFalse);
      final repo = AppRepository(
        apiClient: api,
        cacheService: SecureCacheService(storageAdapter: storage),
      );
      expect(
        await repo.login(email, 'synthetic invitation password'),
        isTrue,
        reason: repo.errorMessage,
      );
      await repo.openInvitedOrganization('org-1');
      expect(repo.currentScope, 'org-1');
      final restarted = AppRepository(
        apiClient: ApiClient(baseUrl: baseUrl, storageAdapter: storage),
        cacheService: SecureCacheService(storageAdapter: storage),
      );
      expect(await restarted.restoreSession(), isTrue);
      expect(restarted.currentUser.email, email);
      expect(restarted.currentScope, 'org-1');
      await expectLater(
        api.acceptInvitation(token: token, email: email),
        throwsA(isA<ValidationException>()),
      );
      await restarted.logout();

      final existing = await owner.request(
        method: 'POST',
        path: '/organizations/org-1/invitations',
        body: {'email': 'jordan@example.com', 'role': 'Member'},
      );
      final existingToken = existing['token'] as String;
      final member = ApiClient(
        baseUrl: baseUrl,
        storageAdapter: InMemoryStorageAdapter(),
      );
      await expectLater(
        member.acceptInvitation(
          token: existingToken,
          email: 'jordan@example.com',
        ),
        throwsA(isA<AuthorizationException>()),
      );
      await member.login('sam@example.com', 'password123456');
      await expectLater(
        member.acceptInvitation(
          token: existingToken,
          email: 'jordan@example.com',
        ),
        throwsA(isA<AuthorizationException>()),
      );
      await member.logout();
      await member.login('jordan@example.com', 'password123456');
      expect(
        (await member.acceptInvitation(
          token: existingToken,
          email: 'jordan@example.com',
        ))['success'],
        isTrue,
      );
      final me = await member.getCurrentUser();
      expect(
        (me['organizations'] as List).any((org) => org['id'] == 'org-1'),
        isTrue,
      );
      await member.logout();
      await owner.logout();
    },
    skip: baseUrl == null ? 'AUTH_LIVE_API is not set' : null,
  );
}
