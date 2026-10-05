import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/main.dart';
import 'package:mobile/data/app_repository.dart';
import 'package:mobile/services/api_client.dart';
import 'package:mobile/services/secure_cache_service.dart';
import 'package:mobile/services/session_context_store.dart';

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

void main() {
  test(
    'restores credentials with session ID, memory-only access and permitted scope',
    () async {
      final storage = InMemoryStorageAdapter();
      final first = repository(storage, live);
      expect(await first.login('test@example.com', 'fixture password'), isTrue);
      await first.selectScope('org-live');
      expect(await storage.read(key: 'auth_access_token'), isNull);
      final context = await SessionContextStore(storage).read();
      expect(context!.scope, 'org-live');
      final requests = <http.Request>[];
      final restarted = repository(storage, (request) async {
        requests.add(request);
        return live(request);
      });
      expect(await restarted.apiClient.getAccessToken(), isNull);
      expect(await restarted.restoreSession(), isTrue);
      expect(restarted.currentScope, 'org-live');
      expect(
        jsonDecode(
          requests.firstWhere((r) => r.url.path.endsWith('/refresh')).body,
        )['sessionId'],
        'session',
      );
      await restarted.logout();
      expect(jsonDecode(requests.last.body)['sessionId'], 'session');
      expect(restarted.currentUser.id, isEmpty);
      expect(await storage.read(key: 'auth_account_context'), isNull);
    },
  );

  test(
    'cold offline restore requires eligible same-account snapshots',
    () async {
      final storage = InMemoryStorageAdapter();
      final online = repository(storage, live);
      await online.login('test@example.com', 'fixture password');
      final offline = repository(
        storage,
        (_) async => throw const SocketException('offline'),
      );
      expect(await offline.restoreSession(), isTrue);
      expect(offline.isOffline, isTrue);
      expect(offline.currentUser.id, 'user-live');
      await offline.cacheService.clearAccount('user-live');
      final empty = repository(
        storage,
        (_) async => throw const SocketException('offline'),
      );
      expect(await empty.restoreSession(), isFalse);
      expect(empty.allTasks, isEmpty);
      expect(await empty.apiClient.getRefreshToken(), 'refresh');
    },
  );

  test(
    'known expiry and revoked session clear credentials and protected data',
    () async {
      for (final expired in [true, false]) {
        final storage = InMemoryStorageAdapter();
        final online = repository(storage, live);
        await online.login('test@example.com', 'fixture password');
        if (expired) {
          await storage.write(
            key: 'auth_session_expiry',
            value: DateTime.now()
                .subtract(const Duration(seconds: 1))
                .toIso8601String(),
          );
        }
        final revoked = repository(storage, (_) async => json({}, 401));
        expect(await revoked.restoreSession(), isFalse);
        expect(revoked.currentUser.id, isEmpty);
        expect(revoked.allMembers, isEmpty);
        expect(await revoked.apiClient.getRefreshToken(), isNull);
      }
    },
  );

  test(
    'removed organization restores a safe currently permitted default',
    () async {
      final storage = InMemoryStorageAdapter();
      await repository(
        storage,
        live,
      ).login('test@example.com', 'fixture password');
      final restarted = repository(storage, (request) async {
        if (request.url.path.endsWith('/auth/me') &&
            request.headers.containsKey('authorization')) {
          return json({
            ...account(),
            'organizations': [
              {...organizations.first, 'id': 'org-new', 'name': 'New Team'},
            ],
          });
        }
        return live(request);
      });
      expect(await restarted.restoreSession(), isTrue);
      expect(restarted.currentScope, 'org-new');
    },
  );

  testWidgets(
    'fresh launch is blank sign-in; validation, traversal and visibility work',
    (tester) async {
      var calls = 0;
      final repo = repository(InMemoryStorageAdapter(), (_) async {
        calls++;
        return json({}, 401);
      });
      await tester.pumpWidget(TeamManagerApp(initialRepo: repo));
      await tester.pumpAndSettle();
      expect(calls, 0);
      expect(find.text('Overview'), findsNothing);
      expect(find.text('Len'), findsNothing);
      expect(
        tester
            .widget<TextFormField>(find.byKey(const Key('sign-in-email')))
            .controller!
            .text,
        isEmpty,
      );
      await tester.tap(find.byKey(const Key('btn-sign-in')));
      await tester.pumpAndSettle();
      expect(find.text('Enter a valid email address.'), findsOneWidget);
      expect(
        tester
            .widget<EditableText>(find.byType(EditableText).first)
            .focusNode
            .hasFocus,
        isTrue,
      );
      await tester.enterText(
        find.byKey(const Key('sign-in-email')),
        'test@example.com',
      );
      await tester.testTextInput.receiveAction(TextInputAction.next);
      await tester.pump();
      expect(
        tester
            .widget<EditableText>(find.byType(EditableText).last)
            .focusNode
            .hasFocus,
        isTrue,
      );
      await tester.tap(find.byTooltip('Show password'));
      await tester.pump();
      expect(find.byTooltip('Hide password'), findsOneWidget);
      expect(calls, 0);
    },
  );

  testWidgets(
    'keyboard submission prevents duplicates and keeps email after generic error',
    (tester) async {
      final response = Completer<http.Response>();
      var calls = 0;
      final repo = repository(InMemoryStorageAdapter(), (_) {
        calls++;
        return response.future;
      });
      await tester.pumpWidget(TeamManagerApp(initialRepo: repo));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('sign-in-email')),
        'test@example.com',
      );
      await tester.enterText(
        find.byType(TextFormField).last,
        'fixture password',
      );
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();
      expect(find.text('Signing in...'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      response.complete(json({'message': 'secret account detail'}, 401));
      await tester.pumpAndSettle();
      expect(calls, 1);
      expect(find.text('secret account detail'), findsNothing);
      expect(
        tester
            .widget<TextFormField>(find.byKey(const Key('sign-in-email')))
            .controller!
            .text,
        'test@example.com',
      );
    },
  );

  testWidgets(
    '200 percent text with keyboard keeps primary action scrollable and targets at least 48',
    (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      tester.view.viewInsets = const FakeViewPadding(bottom: 260);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await tester.pumpWidget(
        TeamManagerApp(initialRepo: repository(InMemoryStorageAdapter(), live)),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('btn-sign-in')));
      await tester.pumpAndSettle();
      expect(
        tester.getSize(find.byType(FilledButton)).height,
        greaterThanOrEqualTo(48),
      );
      expect(
        tester.getSize(find.byTooltip('Show password')).height,
        greaterThanOrEqualTo(48),
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'sign-out removes authenticated destination and detail navigation',
    (tester) async {
      final repo = repository(InMemoryStorageAdapter(), live);
      await tester.pumpWidget(TeamManagerApp(initialRepo: repo));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('sign-in-email')),
        'test@example.com',
      );
      await tester.enterText(
        find.byType(TextFormField).last,
        'fixture password',
      );
      await tester.tap(find.byKey(const Key('btn-sign-in')));
      await tester.pumpAndSettle();
      expect(find.text('Overview'), findsWidgets);
      final navigator = tester.state<NavigatorState>(
        find.byType(Navigator).last,
      );
      navigator.push(
        MaterialPageRoute<void>(
          builder: (_) => const Scaffold(body: Text('Protected detail')),
        ),
      );
      await tester.pumpAndSettle();
      await repo.logout();
      await tester.pumpAndSettle();
      expect(find.text('Protected detail'), findsNothing);
      expect(find.byKey(const Key('sign-in-email')), findsOneWidget);
    },
  );
}
