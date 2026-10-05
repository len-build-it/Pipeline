import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/data/app_repository.dart';
import 'package:mobile/main.dart';
import 'package:mobile/screens/invitation_screen.dart';
import 'package:mobile/services/secure_cache_service.dart';
import 'support/auth_entry_fixtures.dart' as fixtures;

const token =
    'abababababababababababababababababababababababababababababababab';
Map<String, dynamic> preview({bool valid = true, String status = 'pending'}) =>
    {
      'valid': valid,
      'status': status,
      'email': 'test@example.com',
      'organizationId': 'org-live',
      'organizationName': 'Live Team',
      'role': 'Member',
    };
Future<void> openInvitation(WidgetTester tester, AppRepository repo) async {
  await tester.pumpWidget(TeamManagerApp(initialRepo: repo));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Have an invitation? Create account'));
  await tester.pumpAndSettle();
  await tester.enterText(
    find.byKey(const Key('invitation-code')),
    'http://127.0.0.1:3000/#invite?token=$token&email=test%40example.com',
  );
  await tester.tap(find.text('Continue'));
  await tester.pumpAndSettle();
}

void main() {
  test(
    'invitation parser accepts raw code or existing URL and rejects arbitrary text',
    () {
      expect(invitationCode(token), token);
      expect(invitationCode('https://example.com/?token=$token'), token);
      expect(
        invitationCode('http://127.0.0.1:3000/#invite?token=$token'),
        token,
      );
      expect(invitationCode('ftp://example.com/?token=$token'), isNull);
      expect(invitationCode('incorrect'), isNull);
      expect(invitationCode('https://example.com/?token=%XX'), isNull);
    },
  );

  testWidgets(
    'new invitee previews, validates matching email, creates then signs in using singular path',
    (tester) async {
      final requests = <http.Request>[];
      final repo = fixtures.repository(InMemoryStorageAdapter(), (
        request,
      ) async {
        requests.add(request);
        if (request.url.path.endsWith('/invitation/$token')) {
          return fixtures.json(preview());
        }
        if (request.url.path.endsWith('/invitation/accept')) {
          return fixtures.json({
            'success': true,
            'userId': 'user-live',
            'organizationId': 'org-live',
            'role': 'Member',
          });
        }
        return fixtures.live(request);
      });
      await openInvitation(tester, repo);
      expect(find.text('Invitation email: test@example.com'), findsOneWidget);
      expect(
        find.text('You are invited to Live Team as Member.'),
        findsOneWidget,
      );
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'other@example.com');
      await tester.enterText(fields.at(1), 'New Member');
      await tester.enterText(fields.at(2), 'spaces are okay');
      await tester.ensureVisible(find.text('Create account and join'));
      await tester.tap(find.text('Create account and join'));
      await tester.pumpAndSettle();
      expect(
        find.text('Use the email address shown in your invitation.'),
        findsOneWidget,
      );
      expect(requests.where((r) => r.method == 'POST'), isEmpty);
      await tester.enterText(fields.at(0), 'test@example.com');
      await tester.ensureVisible(find.text('Create account and join'));
      await tester.tap(find.text('Create account and join'));
      await tester.pumpAndSettle();
      expect(
        requests
            .where((r) => r.method == 'POST')
            .map((r) => r.url.path)
            .take(2),
        ['/api/auth/invitation/accept', '/api/auth/login'],
      );
      expect(repo.currentScope, 'org-live');
      expect(find.text('Overview'), findsWidgets);
      expect(
        await repo.apiClient.storage.read(key: 'invitation_token'),
        isNull,
      );
    },
  );

  testWidgets(
    'existing account signs in, confirms join and sends bearer without password',
    (tester) async {
      http.Request? acceptance;
      final repo = fixtures.repository(InMemoryStorageAdapter(), (
        request,
      ) async {
        if (request.url.path.endsWith('/invitation/$token')) {
          return fixtures.json(preview());
        }
        if (request.url.path.endsWith('/invitation/accept')) {
          acceptance = request;
          return fixtures.json({'success': true, 'organizationId': 'org-live'});
        }
        return fixtures.live(request);
      });
      await openInvitation(tester, repo);
      await tester.ensureVisible(find.text('Already have an account? Sign in'));
      await tester.tap(find.text('Already have an account? Sign in'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextFormField).last,
        'fixture password',
      );
      await tester.tap(find.byKey(const Key('btn-sign-in')));
      await tester.pumpAndSettle();
      expect(acceptance, isNull);
      await tester.ensureVisible(find.text('Accept invitation'));
      await tester.tap(find.text('Accept invitation'));
      await tester.pumpAndSettle();
      expect(acceptance!.headers['authorization'], 'Bearer access');
      expect(jsonDecode(acceptance!.body).containsKey('password'), isFalse);
      expect(find.text('Overview'), findsWidgets);
    },
  );

  testWidgets(
    'a mismatched signed-in account cannot submit invitation acceptance',
    (tester) async {
      var acceptances = 0;
      final repo = fixtures.repository(InMemoryStorageAdapter(), (
        request,
      ) async {
        if (request.url.path.endsWith('/invitation/$token')) {
          return fixtures.json({
            ...preview(),
            'email': 'invited-other@example.com',
          });
        }
        if (request.url.path.endsWith('/invitation/accept')) acceptances++;
        return fixtures.live(request);
      });
      await openInvitation(tester, repo);
      await repo.login('test@example.com', 'fixture password');
      await tester.pumpAndSettle();
      // The page is rebuilt after returning from its sign-in route in normal use.
      await tester.ensureVisible(find.text('Already have an account? Sign in'));
      await tester.tap(find.text('Already have an account? Sign in'));
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Accept invitation'));
      await tester.tap(find.text('Accept invitation'));
      await tester.pumpAndSettle();
      expect(
        find.text('Sign in with the email address shown in your invitation.'),
        findsOneWidget,
      );
      expect(acceptances, 0);
    },
  );

  testWidgets(
    'network retry and expired or consumed previews are actionable and never join',
    (tester) async {
      var attempts = 0;
      final repo = fixtures.repository(InMemoryStorageAdapter(), (_) async {
        attempts++;
        if (attempts == 1) {
          throw const SocketException('private invitation URL');
        }
        return fixtures.json(
          preview(valid: false, status: attempts == 2 ? 'expired' : 'accepted'),
        );
      });
      await openInvitation(tester, repo);
      expect(find.textContaining('Unable to connect.'), findsOneWidget);
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(find.textContaining('has expired'), findsOneWidget);
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(find.textContaining('already been used'), findsOneWidget);
      expect(repo.hasSession, isFalse);
    },
  );
}
