import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/data/app_repository.dart';
import 'package:mobile/data/finance_controller.dart';
import 'package:mobile/data/synthetic_data.dart';
import 'package:mobile/main.dart';
import 'package:mobile/models/finance_models.dart';
import 'package:mobile/screens/finance_screen.dart';
import 'package:mobile/services/api_client.dart';
import 'package:mobile/services/finance_api.dart';
import 'package:mobile/services/secure_cache_service.dart';
import 'package:mobile/theme.dart';

/// Stands in for the server: canned finance payloads per organization, with switches for failure cases.
class FakeFinanceServer {
  final List<http.Request> requests = [];
  bool offline = false;
  bool deny = false;
  int patchConflictsRemaining = 0;
  String role = 'Member';
  bool isOwner = false;

  static const organizations = [
    {'id': 'org-k', 'name': 'Kestrel Bakery Co-op'},
    {'id': 'org-m', 'name': 'Mossy Trail Runners'},
    {'id': 'org-z', 'name': 'Zeta <Lab> & Co'},
  ];

  Map<String, dynamic> _auth() => {
        'user': {'id': 'usr-sam', 'email': 'sam@example.com', 'displayName': 'Sam Taylor', 'status': 'active', 'isOwner': isOwner},
        'accessToken': 'access-token',
        'refreshToken': 'refresh-token',
        'organizations': [
          for (final org in organizations) {...org, 'status': 'active', 'role': role, 'membership_status': 'active'},
        ],
      };

  static Map<String, dynamic> expense(String id, String amount, {int version = 1, bool voided = false, String description = 'Bus fare'}) => {
        'id': id,
        'occurredOn': '2026-10-02',
        'amount': amount,
        'category': 'Travel',
        'description': description,
        'vendor': 'Victory Liner',
        'reference': null,
        'source': 'manual',
        'version': version,
        'voided': voided,
        'updatedByName': 'Alex Rivera',
        'updatedAt': '2026-10-02T03:00:00.000Z',
      };

  Map<String, dynamic> _report(String orgId, String month) {
    if (orgId == 'org-m') {
      return {
        'month': month,
        'asOf': '2026-10-03',
        'totals': {'budget': '0.00', 'actual': '7.00', 'remaining': '-7.00', 'unbudgetedActual': '7.00', 'status': 'unbudgeted'},
        'categories': [
          {'category': 'Race fees', 'budgetId': null, 'budgetVersion': null, 'budget': null, 'actual': '7.00', 'remaining': null, 'expenseCount': 1, 'status': 'unbudgeted'},
        ],
        'trend': [
          {'month': month, 'actual': '7.00', 'expenseCount': 1},
        ],
        'forecast': null,
      };
    }
    return {
      'month': month,
      'asOf': '2026-10-03',
      'totals': {'budget': '600.00', 'actual': '1000273.63', 'remaining': '-999673.63', 'unbudgetedActual': '33.33', 'status': 'over'},
      'categories': [
        {'category': 'Snacks', 'budgetId': null, 'budgetVersion': null, 'budget': null, 'actual': '33.33', 'remaining': null, 'expenseCount': 1, 'status': 'unbudgeted'},
        {'category': 'Supplies', 'budgetId': 'bud-1', 'budgetVersion': 2, 'budget': '100.00', 'actual': '120.30', 'remaining': '-20.30', 'expenseCount': 2, 'status': 'over'},
        {'category': 'Travel', 'budgetId': 'bud-2', 'budgetVersion': 1, 'budget': '500.00', 'actual': '120.00', 'remaining': '380.00', 'expenseCount': 1, 'status': 'under'},
      ],
      'trend': [
        {'month': '2026-09', 'actual': '0.10', 'expenseCount': 1},
        {'month': month, 'actual': '1000273.63', 'expenseCount': 4},
      ],
      'forecast': {
        'estimate': '10336160.84',
        'monthToDate': '1000273.63',
        'elapsedDays': 3,
        'daysInMonth': 31,
        'basis': 'Month-to-date actual spending × days in the month ÷ elapsed days including today, rounded to the nearest centavo.',
      },
    };
  }

  http.Response _json(Object body, [int status = 200]) =>
      http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json; charset=utf-8'});

  Future<http.Response> handle(http.Request request) async {
    // A request made while offline never reaches the server, so it is not recorded.
    if (offline) throw http.ClientException('Connection refused', request.url);
    requests.add(request);
    final path = request.url.path;

    if (path == '/api/auth/login' || path == '/api/auth/me') return _json(_auth());
    if (path == '/api/announcements') return _json({'announcements': []});

    final match = RegExp(r'^/api/organizations/([^/]+)/(.*)$').firstMatch(path);
    if (match == null) return _json({'message': 'Route not found.'}, 404);
    final orgId = match.group(1)!;
    final rest = match.group(2)!;

    if (rest == 'members') return _json({'members': []});
    if (rest == 'tasks') return _json({'tasks': []});
    if (deny) return _json({'message': 'Inaccessible organization.'}, 403);

    if (rest == 'finance/report') return _json(_report(orgId, request.url.queryParameters['month']!));
    if (rest == 'finance/categories') return _json({'categories': ['Snacks', 'Supplies', 'Travel']});
    if (rest == 'finance/activity') {
      return _json({
        'events': [
          {
            'entityType': 'expense',
            'action': 'update',
            'actorName': 'Alex Rivera',
            'createdAt': '2026-10-02T03:00:00.000Z',
            'metadata': {'before': {'amount': '100.00'}, 'after': {'amount': '120.00'}},
          },
        ],
      });
    }
    if (rest == 'finance/expenses' && request.method == 'GET') {
      final voided = request.url.queryParameters['includeVoided'] == 'true';
      return _json({
        'expenses': [
          expense('exp-1', '120.00'),
          if (voided) expense('exp-9', '55.00', voided: true, description: 'Cancelled trip'),
        ],
        'total': voided ? 2 : 1,
        'totalAmount': '120.00',
      });
    }
    if (rest == 'finance/expenses' && request.method == 'POST') {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      return _json({...expense('exp-new', body['amount'] as String), ...body, 'updatedByName': 'Sam Taylor'}, 201);
    }
    if (rest == 'finance/expenses/exp-1' && request.method == 'GET') return _json(expense('exp-1', '333.33', version: 5));
    if (rest == 'finance/expenses/exp-1' && request.method == 'PATCH') {
      if (patchConflictsRemaining > 0) {
        patchConflictsRemaining--;
        return _json({'message': 'This expense was changed by another member. Refresh and review before saving.'}, 409);
      }
      return _json(expense('exp-1', '150.00', version: 6));
    }
    if (rest == 'finance/expenses/exp-1/void') return _json(expense('exp-1', '120.00', version: 2, voided: true));
    if (rest == 'finance/budgets' && request.method == 'POST') {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      return _json({'id': 'bud-new', ...body, 'version': 1, 'updatedByName': 'Sam Taylor'}, 201);
    }
    if (rest == 'finance/budgets/bud-1' && request.method == 'PATCH') {
      return _json({'id': 'bud-1', 'month': '2026-10', 'category': 'Supplies', 'amount': '150.00', 'version': 3, 'updatedByName': 'Sam Taylor'});
    }
    return _json({'message': 'Route not found.'}, 404);
  }

  Iterable<http.Request> writes() => requests.where((r) => r.method != 'GET' && !r.url.path.startsWith('/api/auth'));
}

ApiClient clientFor(FakeFinanceServer server) => ApiClient(
      baseUrl: 'http://127.0.0.1:3000/api',
      httpClient: MockClient(server.handle),
      storageAdapter: InMemoryStorageAdapter(),
    );

Future<AppRepository> signedInRepository(FakeFinanceServer server, {String? scope = 'org-k'}) async {
  final repo = AppRepository(
    apiClient: clientFor(server),
    cacheService: SecureCacheService(storageAdapter: InMemoryStorageAdapter()),
  );
  final signedIn = await repo.login('sam@example.com', 'password123456');
  expect(signedIn, isTrue, reason: repo.errorMessage);
  if (scope != null) repo.setScope(scope);
  return repo;
}

void usePhoneScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2340);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.reset);
}

Future<AppRepository> pumpFinance(WidgetTester tester, FakeFinanceServer server, {String scope = 'org-k', double textScale = 1.0}) async {
  usePhoneScreen(tester);
  final repo = (await tester.runAsync(() => signedInRepository(server, scope: scope)))!;
  await tester.pumpWidget(MaterialApp(
    theme: buildAppTheme(),
    home: MediaQuery(
      data: MediaQueryData(size: const Size(360, 780), textScaler: TextScaler.linear(textScale)),
      child: FinanceScreen(repo: repo),
    ),
  ));
  await settle(tester);
  return repo;
}

/// Lets the mocked HTTP calls complete, then renders the result.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump();
  }
  await tester.pumpAndSettle();
}

Future<void> scrollTo(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(finder, 200, scrollable: find.byType(Scrollable).first);
  await tester.pumpAndSettle();
}

void main() {
  group('Finance formatting and rules (FEAT-006)', () {
    test('formatPhp groups thousands and keeps the server digits', () {
      expect(formatPhp('1250.5'), 'PHP 1,250.50');
      expect(formatPhp('0.05'), 'PHP 0.05');
      expect(formatPhp('999999999.99'), 'PHP 999,999,999.99');
      expect(formatPhp('-999673.63'), '-PHP 999,673.63');
      expect(formatPhp('10336160.84'), 'PHP 10,336,160.84');
      expect(formatPhp('12'), 'PHP 12.00');
    });

    test('amount input accepts positive two-decimal values only', () {
      for (final valid in ['1', '0.01', '1250.50', '999999999.99', '7.5']) {
        expect(isValidAmountInput(valid), isTrue, reason: valid);
      }
      for (final invalid in ['', '0', '0.00', '-1', '1.999', '1,000', '1e3', '1000000000', 'abc', '.5']) {
        expect(isValidAmountInput(invalid), isFalse, reason: invalid);
      }
    });

    test('manilaToday follows the Asia/Manila calendar', () {
      expect(manilaToday(DateTime.utc(2026, 10, 3, 16, 30)), '2026-10-04');
      expect(manilaToday(DateTime.utc(2026, 10, 3, 15, 59)), '2026-10-03');
    });

    test('month ranges cover leap years', () {
      expect(FinanceController.lastDayOf('2028-02'), '2028-02-29');
      expect(FinanceController.lastDayOf('2026-02'), '2026-02-28');
      expect(FinanceController.lastDayOf('2026-12'), '2026-12-31');
    });

    test('a change history entry names the member and the allowlisted values', () {
      final event = FinanceEvent.fromJson({
        'entityType': 'expense',
        'action': 'update',
        'actorName': 'Sam Taylor',
        'createdAt': '2026-10-02T03:00:00.000Z',
        'metadata': {'before': {'amount': '40.00', 'category': 'A'}, 'after': {'amount': '45.50', 'category': 'B'}},
      });
      expect(event.summary, 'Sam Taylor changed expense: Amount PHP 40.00 → PHP 45.50, Category A → B');
    });
  });

  group('FinanceController: online-only records (REQ-011, REQ-012)', () {
    late FakeFinanceServer server;
    late FinanceController controller;

    setUp(() {
      server = FakeFinanceServer();
      controller = FinanceController(FinanceApi(clientFor(server), 'org-k'), month: '2026-10');
    });

    test('load reads report, register, categories, and history for the organization and month', () async {
      await controller.load();

      expect(controller.problem, FinanceProblem.none);
      expect(controller.report!.actual, '1000273.63');
      expect(controller.report!.forecast!.estimate, '10336160.84');
      expect(controller.expensePage!.totalAmount, '120.00');
      expect(controller.categories, ['Snacks', 'Supplies', 'Travel']);
      expect(controller.recentChanges.single.actorName, 'Alex Rivera');

      final paths = server.requests.map((r) => r.url.path).toSet();
      expect(paths.every((path) => path.startsWith('/api/organizations/org-k/finance/')), isTrue);
      final registerQuery = server.requests.firstWhere((r) => r.url.path.endsWith('/expenses')).url.queryParameters;
      expect(registerQuery['from'], '2026-10-01');
      expect(registerQuery['to'], '2026-10-31');
    });

    test('going offline clears the figures instead of showing stale ones', () async {
      await controller.load();
      expect(controller.hasData, isTrue);

      server.offline = true;
      await controller.load();
      expect(controller.problem, FinanceProblem.offline);
      expect(controller.hasData, isFalse);
      expect(controller.recentChanges, isEmpty);
      expect(controller.problemMessage, contains('not stored on this device'));

      server.offline = false;
      await controller.load();
      expect(controller.problem, FinanceProblem.none);
      expect(controller.hasData, isTrue);
    });

    test('an offline save is rejected with an explanation and is not queued', () async {
      await controller.load();
      server.offline = true;
      final result = await controller.recordExpense(
        const ExpenseInput(occurredOn: '2026-10-03', amount: '10.00', category: 'Travel', description: 'Offline'),
      );
      expect(result.succeeded, isFalse);
      expect(result.message, offlineFinanceMessage);

      // Reconnecting sends nothing that was attempted while offline.
      server.offline = false;
      server.requests.clear();
      await controller.load();
      expect(server.writes(), isEmpty);
    });

    test('a denied organization is reported as no access', () async {
      server.deny = true;
      await controller.load();
      expect(controller.problem, FinanceProblem.denied);
      expect(controller.hasData, isFalse);
    });

    test('a stale edit is reported as a conflict', () async {
      await controller.load();
      server.patchConflictsRemaining = 1;
      final result = await controller.changeExpense(
        'exp-1',
        const ExpenseInput(occurredOn: '2026-10-02', amount: '150.00', category: 'Travel', description: 'Bus fare'),
        1,
      );
      expect(result.isConflict, isTrue);
      expect(result.message, contains('changed by another member'));
    });

    test('amounts are sent as decimal strings', () async {
      await controller.recordExpense(
        const ExpenseInput(occurredOn: '2026-10-03', amount: '0.10', category: 'Travel', description: 'Coins'),
      );
      final body = jsonDecode(server.writes().single.body) as Map<String, dynamic>;
      expect(body['amount'], '0.10');
      expect(body['amount'], isA<String>());
    });
  });

  group('Finance screen', () {
    testWidgets('demo data has no finance: the screen asks the member to sign in', (tester) async {
      usePhoneScreen(tester);
      await tester.pumpWidget(MaterialApp(home: FinanceScreen(repo: SyntheticDataRepository())));
      await tester.pumpAndSettle();
      expect(find.text('Sign in to use Finance'), findsOneWidget);
      expect(find.byKey(const Key('finance-record-expense')), findsNothing);
    });

    testWidgets('shows organization, currency, and the server totals and estimate unchanged', (tester) async {
      final server = FakeFinanceServer();
      await pumpFinance(tester, server);

      expect(find.text('Kestrel Bakery Co-op'), findsOneWidget);
      expect(find.textContaining('Currency: PHP'), findsOneWidget);

      Finder within(String statKey, String text) =>
          find.descendant(of: find.byKey(Key('finance-stat-$statKey')), matching: find.textContaining(text));
      expect(within('budget', 'PHP 600.00'), findsOneWidget);
      expect(within('actual', 'PHP 1,000,273.63'), findsOneWidget);
      expect(within('actual', 'Includes PHP 33.33 without a budget'), findsOneWidget);
      expect(within('remaining', 'Over budget by'), findsOneWidget);
      expect(within('remaining', 'PHP 999,673.63'), findsOneWidget);
      await scrollTo(tester, find.byKey(const Key('finance-stat-forecast')));
      expect(within('forecast', 'PHP 10,336,160.84'), findsOneWidget);
      expect(within('forecast', 'Estimate, not actual: 3 of 31 days elapsed'), findsOneWidget);
    });

    testWidgets('category lines state figures and status in words', (tester) async {
      final server = FakeFinanceServer();
      await pumpFinance(tester, server);

      await scrollTo(tester, find.byKey(const Key('category-line-Travel')));
      expect(find.text('PHP 33.33 spent · No budget set'), findsOneWidget);
      expect(find.text('PHP 120.30 of PHP 100.00 · Over budget by PHP 20.30'), findsOneWidget);
      expect(find.text('Status: Over budget'), findsOneWidget);
      expect(find.text('PHP 120.00 of PHP 500.00 · Remaining PHP 380.00'), findsOneWidget);
      expect(find.text('Status: Within budget'), findsOneWidget);
    });

    testWidgets('trend, register, change history, and the web spreadsheet signpost are shown', (tester) async {
      final server = FakeFinanceServer();
      await pumpFinance(tester, server);

      await scrollTo(tester, find.textContaining('2026-09: PHP 0.10'));
      expect(find.textContaining('PHP 1,000,273.63 · 4 expense(s)'), findsOneWidget);

      await scrollTo(tester, find.byKey(const Key('finance-expense-total')));
      expect(find.text('1 expense(s) · Total of non-void expenses: PHP 120.00'), findsOneWidget);
      await scrollTo(tester, find.byKey(const Key('expense-exp-1')));
      expect(find.textContaining('Last changed by Alex Rivera'), findsOneWidget);

      await scrollTo(tester, find.textContaining('Alex Rivera changed expense'));
      expect(find.textContaining('Amount PHP 100.00 → PHP 120.00'), findsOneWidget);

      await scrollTo(tester, find.text('Spreadsheet import and export'));
      expect(find.textContaining('open Finance in the web dashboard'), findsOneWidget);
    });

    testWidgets('switching organization loads that organization only', (tester) async {
      final server = FakeFinanceServer();
      await pumpFinance(tester, server);
      server.requests.clear();

      await tester.tap(find.byKey(const Key('finance-organization')));
      await tester.pumpAndSettle();
      expect(find.text('Zeta <Lab> & Co'), findsWidgets);
      await tester.tap(find.text('Mossy Trail Runners').last);
      await settle(tester);

      expect(server.requests.every((r) => r.url.path.startsWith('/api/organizations/org-m/finance/')), isTrue);
      expect(find.descendant(of: find.byKey(const Key('finance-stat-actual')), matching: find.text('PHP 7.00')), findsOneWidget);
      await scrollTo(tester, find.byKey(const Key('finance-stat-forecast')));
      expect(find.text('Not available'), findsOneWidget);
    });

    testWidgets('in the combined scope the owner chooses an organization before anything loads', (tester) async {
      final server = FakeFinanceServer()..isOwner = true;
      usePhoneScreen(tester);
      final repo = (await tester.runAsync(() => signedInRepository(server, scope: null)))!;
      expect(repo.currentScope, 'all');
      server.requests.clear();

      await tester.pumpWidget(MaterialApp(home: FinanceScreen(repo: repo)));
      await settle(tester);
      expect(find.text('Choose an organization'), findsOneWidget);
      expect(find.byKey(const Key('finance-record-expense')), findsNothing);
      expect(server.requests, isEmpty);

      await tester.tap(find.byKey(const Key('finance-organization')));
      await tester.pumpAndSettle();
      // The combined scope itself is not offered: finance belongs to one organization.
      expect(find.text('All Organizations'), findsNothing);
      await tester.tap(find.text('Mossy Trail Runners').last);
      await settle(tester);
      expect(server.requests.every((r) => r.url.path.startsWith('/api/organizations/org-m/finance/')), isTrue);
      expect(find.byKey(const Key('finance-stat-actual')), findsOneWidget);
    });

    testWidgets('a Member can record an expense; invalid input is caught before any request', (tester) async {
      final server = FakeFinanceServer()..role = 'Member';
      await pumpFinance(tester, server);

      await tester.tap(find.byKey(const Key('finance-record-expense')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('expense-amount')), '1,250.50');
      await tester.enterText(find.byKey(const Key('expense-category')), 'Travel');
      await tester.enterText(find.byKey(const Key('expense-description')), 'Van rental');
      await tester.tap(find.byKey(const Key('expense-save')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Enter a positive amount'), findsOneWidget);
      expect(server.writes(), isEmpty);

      await tester.enterText(find.byKey(const Key('expense-amount')), '1250.50');
      await tester.tap(find.byKey(const Key('expense-save')));
      await settle(tester);

      final body = jsonDecode(server.writes().single.body) as Map<String, dynamic>;
      expect(body['amount'], '1250.50');
      expect(body['category'], 'Travel');
      expect(body['description'], 'Van rental');
      expect(body['occurredOn'], manilaToday());
      expect(find.text('Expense recorded.'), findsOneWidget);
      expect(find.byKey(const Key('expense-save')), findsNothing);
    });

    testWidgets('an offline save keeps the dialog and everything the member typed, then succeeds after reconnecting', (tester) async {
      final server = FakeFinanceServer();
      await pumpFinance(tester, server);

      await tester.tap(find.byKey(const Key('finance-record-expense')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('expense-amount')), '42.00');
      await tester.enterText(find.byKey(const Key('expense-category')), 'Travel');
      await tester.enterText(find.byKey(const Key('expense-description')), 'Written while offline');

      server.offline = true;
      await tester.tap(find.byKey(const Key('expense-save')));
      await settle(tester);
      expect(find.byKey(const Key('finance-form-problem')), findsOneWidget);
      expect(find.textContaining('nothing was saved'), findsOneWidget);
      expect(find.text('Written while offline'), findsOneWidget);
      expect(find.text('42.00'), findsOneWidget);

      server.offline = false;
      await tester.tap(find.byKey(const Key('expense-save')));
      await settle(tester);
      expect(find.byKey(const Key('expense-save')), findsNothing);
      expect(server.writes().where((r) => r.url.path.endsWith('/expenses')).length, 1);
    });

    testWidgets('a stale edit shows the latest values, keeps the input, and saves on retry with the new version', (tester) async {
      final server = FakeFinanceServer()..patchConflictsRemaining = 1;
      await pumpFinance(tester, server);

      await scrollTo(tester, find.byKey(const Key('expense-actions-exp-1')));
      await tester.tap(find.byKey(const Key('expense-actions-exp-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Edit'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('expense-description')), 'Bus fare, revised');
      await tester.tap(find.byKey(const Key('expense-save')));
      await settle(tester);

      expect(find.textContaining('changed by another member'), findsOneWidget);
      expect(find.textContaining('PHP 333.33'), findsOneWidget);
      expect(find.text('Bus fare, revised'), findsOneWidget);

      await tester.tap(find.byKey(const Key('expense-save')));
      await settle(tester);
      final patches = server.writes().where((r) => r.method == 'PATCH').toList();
      expect(patches.length, 2);
      expect((jsonDecode(patches[0].body) as Map<String, dynamic>)['version'], 1);
      expect((jsonDecode(patches[1].body) as Map<String, dynamic>)['version'], 5);
      expect(find.byKey(const Key('expense-save')), findsNothing);
    });

    testWidgets('voiding asks for confirmation and void expenses can be shown', (tester) async {
      final server = FakeFinanceServer();
      await pumpFinance(tester, server);

      await scrollTo(tester, find.byKey(const Key('expense-actions-exp-1')));
      await tester.tap(find.byKey(const Key('expense-actions-exp-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Void'));
      await tester.pumpAndSettle();
      expect(find.text('Void this expense?'), findsOneWidget);
      await tester.tap(find.byKey(const Key('confirm-void')));
      await settle(tester);
      expect(server.writes().single.url.path, '/api/organizations/org-k/finance/expenses/exp-1/void');
      expect((jsonDecode(server.writes().single.body) as Map<String, dynamic>)['version'], 1);

      await scrollTo(tester, find.byKey(const Key('finance-show-voided')));
      await tester.tap(find.byKey(const Key('finance-show-voided')));
      await settle(tester);
      await scrollTo(tester, find.byKey(const Key('expense-exp-9')));
      expect(find.text('Cancelled trip (Void)'), findsOneWidget);
      expect(find.byKey(const Key('expense-actions-exp-9')), findsNothing);
    });

    testWidgets('budgets can be set for a new category and changed for an existing one', (tester) async {
      final server = FakeFinanceServer();
      await pumpFinance(tester, server);

      await scrollTo(tester, find.text('Set budget for Snacks'));
      await tester.tap(find.text('Set budget for Snacks'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(TextFormField, 'Snacks'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('budget-amount')), '50');
      await tester.tap(find.byKey(const Key('budget-save')));
      await settle(tester);
      final created = jsonDecode(server.writes().single.body) as Map<String, dynamic>;
      expect(created, {'month': manilaToday().substring(0, 7), 'category': 'Snacks', 'amount': '50'});

      await scrollTo(tester, find.text('Change budget for Supplies'));
      await tester.tap(find.text('Change budget for Supplies'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('budget-amount')), '150.00');
      await tester.tap(find.byKey(const Key('budget-save')));
      await settle(tester);
      final changed = jsonDecode(server.writes().last.body) as Map<String, dynamic>;
      expect(changed, {'amount': '150.00', 'version': 2});
    });

    testWidgets('offline and denied states explain themselves; retry reconnects', (tester) async {
      final server = FakeFinanceServer()..offline = true;
      // Sign-in happens online; the connection drops before Finance opens.
      server.offline = false;
      final repo = (await tester.runAsync(() => signedInRepository(server)))!;
      server.offline = true;
      usePhoneScreen(tester);
      await tester.pumpWidget(MaterialApp(home: FinanceScreen(repo: repo)));
      await settle(tester);

      expect(find.text('Finance needs a connection'), findsOneWidget);
      expect(find.byKey(const Key('finance-record-expense')), findsNothing);
      expect(find.byKey(const Key('finance-stat-actual')), findsNothing);

      server.offline = false;
      await tester.tap(find.byKey(const Key('finance-retry')));
      await settle(tester);
      expect(find.byKey(const Key('finance-stat-actual')), findsOneWidget);

      server.deny = true;
      await tester.tap(find.byKey(const Key('finance-refresh')));
      await settle(tester);
      expect(find.text('No access to this organization'), findsOneWidget);
      expect(find.byKey(const Key('finance-stat-actual')), findsNothing);
      expect(find.byKey(const Key('finance-retry')), findsNothing);
    });

    testWidgets('200 percent text scaling lays out the workspace and dialogs without overflow', (tester) async {
      final server = FakeFinanceServer();
      await pumpFinance(tester, server, textScale: 2.0);
      expect(tester.takeException(), isNull);

      for (final target in [
        find.byKey(const Key('finance-stat-forecast')),
        find.byKey(const Key('category-line-Travel')),
        find.byKey(const Key('expense-exp-1')),
        find.text('Spreadsheet import and export'),
      ]) {
        await scrollTo(tester, target);
        expect(tester.takeException(), isNull);
      }

      await tester.tap(find.byKey(const Key('finance-record-expense')));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.byKey(const Key('expense-amount')), findsOneWidget);
    });

    testWidgets('controls meet Android tap target and labeling guidelines', (tester) async {
      final handle = tester.ensureSemantics();
      final server = FakeFinanceServer();
      await pumpFinance(tester, server);

      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));

      await scrollTo(tester, find.byKey(const Key('expense-actions-exp-1')));
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));

      await tester.tap(find.byKey(const Key('finance-record-expense')));
      await tester.pumpAndSettle();
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      handle.dispose();
    });
  });

  group('Finance as a secondary destination', () {
    testWidgets('the bottom bar keeps four destinations and Finance opens from a labeled entry', (tester) async {
      usePhoneScreen(tester);
      await tester.pumpWidget(TeamManagerApp(initialRepo: SyntheticDataRepository()));
      await tester.pumpAndSettle();

      expect(find.byType(NavigationDestination), findsNWidgets(4));
      expect(find.text('Finance: budgets and expenses'), findsOneWidget);

      await tester.tap(find.byKey(const Key('btn-open-finance')));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, 'Finance'), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('popup-persona')));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(PopupMenuItem<String>, 'Finance'), findsOneWidget);
    });
  });
}
